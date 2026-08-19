import test from 'node:test';
import assert from 'node:assert/strict';
import { LoopGuardState, callFingerprint, hasStopRequest, positiveInteger } from '../lib/guard-state.js';

const config = { maxToolAttemptsPerTurn: 8, maxCallsPerToolPerTurn: 3, blockExactDuplicates: true };

test('canonical fingerprint ignores object key order', () => {
  assert.equal(callFingerprint('search', { b: 2, a: 1 }), callFingerprint('search', { a: 1, b: 2 }));
});

test('exact duplicate is blocked after the first allowed call', () => {
  const state = new LoopGuardState(config);
  state.beginTurn('agent-1', 1, false);
  assert.equal(state.denyReason('agent-1', 'search', { q: 'DSH' }), undefined);
  assert.match(state.denyReason('agent-1', 'search', { q: 'DSH' }), /DUPLICATE/);
});

test('tool attempts have a hard per-turn cap', () => {
  const state = new LoopGuardState(config);
  state.beginTurn('agent-1', 1, false);
  for (let index = 0; index < 8; index += 1) assert.equal(state.denyReason('agent-1', 'tool-' + index, { index }), undefined);
  assert.match(state.denyReason('agent-1', 'other', {}), /LIMIT/);
});

test('same tool is capped even with different arguments', () => {
  const state = new LoopGuardState(config);
  state.beginTurn('agent-1', 1, false);
  for (let index = 0; index < 3; index += 1) assert.equal(state.denyReason('agent-1', 'search', { index }), undefined);
  assert.match(state.denyReason('agent-1', 'search', { index: 4 }), /REPEAT/);
});

test('a stop or loop request puts the active turn in no-tools mode', () => {
  const messages = [{ source: { kind: 'user' }, content: [{ type: 'text', text: 'Остановись и ответь, у тебя петля' }] }];
  assert.equal(hasStopRequest(messages), true);
  const state = new LoopGuardState(config);
  state.beginTurn('agent-1', 1, true);
  assert.match(state.denyReason('agent-1', 'bash', { command: 'pwd' }), /STOP/);
});

test('a new turn resets limits and non-array content is safe', () => {
  assert.equal(hasStopRequest([{ source: { kind: 'user' }, content: 'stop' }]), false);
  const state = new LoopGuardState(config);
  state.beginTurn('agent-1', 1, false);
  for (let index = 0; index < 3; index += 1) state.denyReason('agent-1', 'search', { index });
  assert.match(state.denyReason('agent-1', 'search', { index: 4 }), /REPEAT/);
  state.beginTurn('agent-1', 2, false);
  assert.equal(state.denyReason('agent-1', 'search', { index: 4 }), undefined);
});

test('only positive safe integers are accepted as limits', () => {
  assert.equal(positiveInteger(3, 8), 3);
  assert.equal(positiveInteger(1.5, 8), 8);
  assert.equal(positiveInteger(0, 8), 8);
});
