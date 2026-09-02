import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AssistantOutputGuardState,
  assistantTextFromMessage,
  normalizeAssistantLine,
  normalizeAssistantBlock,
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
      turn: 1, step: 1, index: 0, text: 'Reading 480-495.\n',
    }), undefined);
  }
  const hit = state.observeText('session-1', {
    turn: 1, step: 1, index: 0, text: 'Reading 480-495.\n',
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

test('repetition survives block, step, and turn boundaries', () => {
  const state = new AssistantOutputGuardState({ maxRepeatedAssistantLines: 5 });
  for (let count = 1; count <= 4; count += 1) {
    assert.equal(state.observeText('session-cross-step', {
      turn: count <= 2 ? 1 : 2,
      step: count === 1 || count === 3 ? 1 : 2,
      index: 0,
      text: 'Continuing reinstall.\n',
    }), undefined);
    state.endStep('session-cross-step');
  }
  const hit = state.observeMessage('session-cross-step', {
    id: 'final-message',
    turn: 3,
    step: 1,
    text: 'Continuing reinstall.\n',
  });
  assert.equal(hit.count, 5);
  assert.equal(state.hasTriggered('session-cross-step'), true);
});

test('different lines reset the consecutive run', () => {
  const state = new AssistantOutputGuardState({ maxRepeatedAssistantLines: 3 });
  state.observeText('session-3', { turn: 1, step: 1, text: 'same\n' });
  state.observeText('session-3', { turn: 1, step: 1, text: 'different\n' });
  state.observeText('session-3', { turn: 1, step: 1, text: 'same\n' });
  assert.equal(state.observeText('session-3', { turn: 1, step: 1, text: 'same\n' }), undefined);
});

test('final assistant message is a safe lossless fallback and is deduplicated', () => {
  const state = new AssistantOutputGuardState({ maxRepeatedAssistantLines: 2 });
  assert.equal(assistantTextFromMessage({ content: { type: 'text', text: 'bad' } }), '');
  assert.equal(assistantTextFromMessage({
    content: [{ type: 'text', text: 'same\n' }, { type: 'image', data: 'ignored' }],
  }), 'same\n');
  state.observeText('session-message', { turn: 1, step: 1, text: 'same\n' });
  assert.equal(state.observeMessage('session-message', {
    id: 'assistant-1', turn: 1, step: 1, text: 'same\n',
  }), undefined);
  const hit = state.observeMessage('session-message', {
    id: 'assistant-2', turn: 1, step: 1, text: 'same\n',
  });
  assert.equal(hit.count, 2);
  assert.equal(state.observeMessage('session-message', {
    id: 'assistant-2', turn: 1, step: 1, text: 'same\n',
  }), undefined);
});

test('pending final text is flushed at block end', () => {
  const state = new AssistantOutputGuardState({ maxRepeatedAssistantLines: 2 });
  state.observeText('session-pending', { turn: 1, step: 1, text: 'same\n' });
  state.observeText('session-pending', { turn: 1, step: 1, text: 'same' });
  const hit = state.endBlock('session-pending');
  assert.equal(hit.count, 2);
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

test('user message resets the session latch', () => {
  const state = new AssistantOutputGuardState({ maxRepeatedAssistantLines: 1 });
  assert.equal(state.observeText('session-user', { turn: 1, step: 1, text: 'one\n' }).count, 1);
  assert.equal(state.hasTriggered('session-user'), true);
  state.resetForUser('session-user');
  assert.equal(state.hasTriggered('session-user'), false);
  assert.equal(state.observeText('session-user', { turn: 2, step: 1, text: 'two\n' }).count, 1);
});

test('output guard threshold is configurable', () => {
  const state = new AssistantOutputGuardState({ maxRepeatedAssistantLines: 1 });
  const hit = state.observeText('session-6', { turn: 1, step: 1, text: 'one\n' });
  assert.equal(hit.count, 1);
});

test('assistant block normalization preserves meaningful line boundaries', () => {
  assert.equal(normalizeAssistantBlock('  alpha  \r\n beta\n'), 'alpha\nbeta');
  assert.equal(normalizeAssistantBlock('single line'), 'single line');
});

test('five repeated multi-line assistant blocks trigger the block guard', () => {
  const state = new AssistantOutputGuardState({ maxRepeatedAssistantLines: 5, maxRepeatedAssistantBlocks: 5 });
  for (let turn = 1; turn <= 4; turn += 1) {
    assert.equal(state.observeMessage('session-block-loop', {
      id: 'block-' + turn, turn, step: 1, text: 'Continuing reinstall.\nPatching the package.\n',
    }), undefined);
  }
  const hit = state.observeMessage('session-block-loop', {
    id: 'block-5', turn: 5, step: 1, text: 'Continuing reinstall.\nPatching the package.\n',
  });
  assert.equal(hit.count, 5);
  assert.match(hit.reason, /ASSISTANT_BLOCK/);
});

test('streamed block and final assistant message are counted once', () => {
  const state = new AssistantOutputGuardState({ maxRepeatedAssistantLines: 5, maxRepeatedAssistantBlocks: 2 });
  assert.equal(state.observeText('session-block-dedupe', { turn: 1, step: 1, text: 'alpha\n' }), undefined);
  assert.equal(state.observeText('session-block-dedupe', { turn: 1, step: 1, text: 'beta\n' }), undefined);
  assert.equal(state.endBlock('session-block-dedupe'), undefined);
  assert.equal(state.observeMessage('session-block-dedupe', {
    id: 'final-1', turn: 1, step: 1, text: 'alpha\nbeta\n',
  }), undefined);
  const hit = state.observeMessage('session-block-dedupe', {
    id: 'final-2', turn: 2, step: 1, text: 'alpha\nbeta\n',
  });
  assert.equal(hit.count, 2);
});
test('replay fixture detects narration across turns', async () => {
  const { readFile } = await import('node:fs/promises');
  const fixture = JSON.parse(await readFile(new URL('./fixtures/assistant-output-loop.json', import.meta.url), 'utf8'));
  const state = new AssistantOutputGuardState({ maxRepeatedAssistantLines: 5 });
  const hits = [];
  for (const event of fixture.events) {
    const hit = state.observeMessage(fixture.session, {
      id: event.message.id,
      turn: event.turn,
      step: event.step,
      text: assistantTextFromMessage(event.message),
    });
    if (hit) hits.push(hit);
  }
  assert.equal(hits.length, 1);
  assert.equal(hits[0].count, 5);
});
