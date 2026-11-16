import test from 'node:test';
import assert from 'node:assert/strict';
import { AssistantOutputGuardState } from '../lib/assistant-output-state.js';

test('Orphaned tool call in turn 1 does not suppress output loop detection in turn 2 (#155)', () => {
  const state = new AssistantOutputGuardState({ maxRepeatedAssistantLines: 2 });
  const session = 'session-orphaned-tool';

  // Turn 1: tool call started but aborted without markToolResult
  state.markToolCall(session, 'aborted-call-1');
  assert.equal(state.hasActiveTool(session), true);

  // Turn 1 ends
  state.endTurn(session);
  assert.equal(state.hasActiveTool(session), false, 'endTurn must clear activeTools');

  // Turn 2 begins: model loops assistant lines
  state.observeText(session, { turn: 2, step: 1, text: 'repeating line\n' });
  const hit = state.observeText(session, { turn: 2, step: 1, text: 'repeating line\n' });
  assert.ok(hit, 'Output guard must trigger in turn 2 even if turn 1 tool was aborted');
  assert.equal(hit.count, 2);
});

test('user message resets activeTools and restores output loop detection (#155)', () => {
  const state = new AssistantOutputGuardState({ maxRepeatedAssistantLines: 2 });
  const session = 'session-user-reset-tools';

  state.markToolCall(session, 'stale-call');
  assert.equal(state.hasActiveTool(session), true);

  state.resetForUser(session);
  assert.equal(state.hasActiveTool(session), false, 'resetForUser must clear activeTools');

  state.observeText(session, { turn: 1, step: 1, text: 'loop line\n' });
  const hit = state.observeText(session, { turn: 1, step: 1, text: 'loop line\n' });
  assert.ok(hit);
  assert.equal(hit.count, 2);
});

test('activeTools size is bounded to prevent unbounded memory growth (#155)', () => {
  const state = new AssistantOutputGuardState();
  const session = 'session-bounded-set';

  for (let i = 0; i < 100; i++) {
    state.markToolCall(session, `call-${i}`);
  }

  const s = state.stateFor(session);
  assert.ok(s.activeTools.size <= 64, 'activeTools must be bounded to at most 64 entries');
});

