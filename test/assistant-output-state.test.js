import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AssistantOutputGuardState,
  normalizeAssistantLine,
  positiveOutputLimit,
} from '../lib/assistant-output-state.js';

test('assistant line normalization collapses whitespace and ignores carriage returns', () => {
  assert.equal(normalizeAssistantLine('  Reading  480-495.\r '), 'Reading 480-495.');
  assert.equal(normalizeAssistantLine(''), '');
  assert.equal(positiveOutputLimit(5, 3), 5);
  assert.equal(positiveOutputLimit(0, 3), 3);
});

test('five repeated complete lines trigger the output guard', () => {
  const state = new AssistantOutputGuardState({ maxRepeatedAssistantLines: 5 });
  for (let index = 0; index < 4; index += 1) {
    assert.equal(state.observeText('session-1', {
      turn: 1,
      step: 1,
      index: 0,
      text: 'Reading 480-495.\n',
    }), undefined);
  }
  const hit = state.observeText('session-1', {
    turn: 1,
    step: 1,
    index: 0,
    text: 'Reading 480-495.\n',
  });
  assert.equal(hit.count, 5);
  assert.match(hit.reason, /ASSISTANT_OUTPUT/);
});

test('line repetition can be split across streaming chunks', () => {
  const state = new AssistantOutputGuardState({ maxRepeatedAssistantLines: 3 });
  assert.equal(state.observeText('session-2', { turn: 1, step: 1, text: 'Read 480-' }), undefined);
  assert.equal(state.observeText('session-2', { turn: 1, step: 1, text: '495.\nRead 480-495.\nRead 480-' }), undefined);
  const hit = state.observeText('session-2', { turn: 1, step: 1, text: '495.\n' });
  assert.equal(hit.count, 3);
});

test('different lines reset the consecutive run', () => {
  const state = new AssistantOutputGuardState({ maxRepeatedAssistantLines: 3 });
  state.observeText('session-3', { turn: 1, step: 1, text: 'same\n' });
  state.observeText('session-3', { turn: 1, step: 1, text: 'different\n' });
  state.observeText('session-3', { turn: 1, step: 1, text: 'same\n' });
  assert.equal(state.observeText('session-3', { turn: 1, step: 1, text: 'same\n' }), undefined);
});

test('new block and session disposal reset output state', () => {
  const state = new AssistantOutputGuardState({ maxRepeatedAssistantLines: 2 });
  state.observeText('session-4', { turn: 1, step: 1, index: 0, text: 'same\n' });
  assert.equal(state.observeText('session-4', { turn: 1, step: 2, index: 0, text: 'same\n' }), undefined);
  state.dispose('session-4');
  assert.equal(state.observeText('session-4', { turn: 1, step: 2, index: 0, text: 'same\n' }), undefined);
});

test('active tool calls suppress output cancellation and reset the text run', () => {
  const state = new AssistantOutputGuardState({ maxRepeatedAssistantLines: 2 });
  state.markToolCall('session-5', 'call-1');
  for (let index = 0; index < 4; index += 1) {
    assert.equal(state.observeText('session-5', { turn: 1, step: 1, text: 'same\n' }), undefined);
  }
  assert.equal(state.hasActiveTool('session-5'), true);
  state.markToolResult('session-5', 'call-1');
  assert.equal(state.observeText('session-5', { turn: 1, step: 1, text: 'same\n' }), undefined);
  const hit = state.observeText('session-5', { turn: 1, step: 1, text: 'same\n' });
  assert.equal(hit.count, 2);
});

test('output guard threshold is configurable', () => {
  const state = new AssistantOutputGuardState({ maxRepeatedAssistantLines: 1 });
  const hit = state.observeText('session-6', { turn: 1, step: 1, text: 'one\n' });
  assert.equal(hit.count, 1);
});
