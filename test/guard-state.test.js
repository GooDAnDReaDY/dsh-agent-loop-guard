import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LoopGuardState,
  callFingerprint,
  callRepeatFingerprint,
  hasStopRequest,
  nonNegativeInteger,
  positiveInteger,
} from '../lib/guard-state.js';

const config = {
  maxToolAttemptsPerTurn: 8,
  maxProgressToolCallsPerTurn: 16,
  maxCallsPerRepeatGroup: 5,
  blockExactDuplicates: true,
};

test('canonical fingerprint ignores object key order', () => {
  assert.equal(callFingerprint('search', { b: 2, a: 1 }), callFingerprint('search', { a: 1, b: 2 }));
});

test('repeat fingerprint ignores formatting-only whitespace differences', () => {
  assert.equal(callRepeatFingerprint('bash', { command: ' curl  /issues ' }), callRepeatFingerprint('bash', { command: 'curl /issues' }));
});

test('five exact consecutive calls are allowed and the sixth is blocked', () => {
  const state = new LoopGuardState(config);
  state.beginTurn('agent-1', 1, false);
  for (let index = 0; index < 5; index += 1) {
    assert.equal(state.denyReason('agent-1', 'search', { q: 'DSH' }, 'call-' + index), undefined);
  }
  assert.match(state.denyReason('agent-1', 'search', { q: 'DSH' }, 'call-5'), /DUPLICATE/);
});

test('tool attempts have a hard per-turn cap', () => {
  const state = new LoopGuardState(config);
  state.beginTurn('agent-1', 1, false);
  for (let index = 0; index < 8; index += 1) assert.equal(state.denyReason('agent-1', 'tool-' + index, { index }), undefined);
  assert.match(state.denyReason('agent-1', 'other', {}), /LIMIT/);
});

test('zero disables only the aggregate ordinary-call cap', () => {
  const state = new LoopGuardState({ ...config, maxToolAttemptsPerTurn: 0 });
  state.beginTurn('agent-1', 1, false);
  for (let index = 0; index < 10; index += 1) assert.equal(state.denyReason('agent-1', 'tool-' + index, { index }), undefined);
});

test('progress tools do not consume the ordinary budget but remain bounded', () => {
  const state = new LoopGuardState({
    ...config,
    maxToolAttemptsPerTurn: 2,
    maxProgressToolCallsPerTurn: 2,
  });
  state.beginTurn('agent-1', 1, false);
  assert.equal(state.denyReason('agent-1', 'bash', { command: 'pwd' }), undefined);
  assert.equal(state.denyReason('agent-1', 'todo_write', { todos: [{ content: 'one', status: 'in_progress' }] }), undefined);
  assert.equal(state.denyReason('agent-1', 'bash', { command: 'ls' }), undefined);
  assert.equal(state.denyReason('agent-1', 'todo_write', { todos: [{ content: 'two', status: 'in_progress' }] }), undefined);
  assert.match(state.denyReason('agent-1', 'bash', { command: 'date' }), /LIMIT/);
  assert.match(state.denyReason('agent-1', 'todo_write', { todos: [{ content: 'three', status: 'in_progress' }] }), /PROGRESS_LIMIT/);
});

test('a call denied by a later guard can be retried without duplicate accounting', () => {
  const state = new LoopGuardState({ ...config, maxToolAttemptsPerTurn: 2 });
  state.beginTurn('agent-1', 1, false);
  assert.equal(state.denyReason('agent-1', 'edit', { path: 'package.json', oldText: 'a', newText: 'b' }, 'edit-1'), undefined);
  state.releaseCall('agent-1', 'edit-1');
  assert.equal(state.denyReason('agent-1', 'read', { path: 'package.json' }, 'read-1'), undefined);
  assert.equal(state.denyReason('agent-1', 'edit', { path: 'package.json', oldText: 'a', newText: 'b' }, 'edit-2'), undefined);
});

test('progress-tool near duplicates remain protected after five allowed calls', () => {
  const state = new LoopGuardState({ ...config, maxProgressToolCallsPerTurn: 8 });
  state.beginTurn('agent-1', 1, false);
  for (let index = 0; index < 5; index += 1) {
    assert.equal(state.denyReason('agent-1', 'todo_write', { todos: [{ content: 'one', status: 'pending' }] }), undefined);
  }
  assert.match(state.denyReason('agent-1', 'todo_write', { todos: [{ content: '  one  ', status: 'pending' }] }), /REPEAT/);
});

test('same tool with different commands is not capped by tool name', () => {
  const state = new LoopGuardState(config);
  state.beginTurn('agent-1', 1, false);
  for (const path of ['/issues', '/labels', '/pulls', '/issues/6/comments']) {
    assert.equal(state.denyReason('agent-1', 'bash', { command: 'curl ' + path }), undefined);
  }
});

test('formatting-equivalent repeat group allows five calls and blocks the sixth', () => {
  const state = new LoopGuardState(config);
  state.beginTurn('agent-1', 1, false);
  for (const command of ['curl /issues', ' curl  /issues ', 'curl\n/issues', 'curl   /issues', 'curl /issues ']) {
    assert.equal(state.denyReason('agent-1', 'bash', { command }), undefined);
  }
  assert.match(state.denyReason('agent-1', 'bash', { command: 'curl  /issues' }), /REPEAT/);
});

test('a different call resets the consecutive repeat run', () => {
  const state = new LoopGuardState(config);
  state.beginTurn('agent-1', 1, false);
  for (let index = 0; index < 5; index += 1) {
    assert.equal(state.denyReason('agent-1', 'search', { q: 'DSH' }), undefined);
  }
  assert.equal(state.denyReason('agent-1', 'read', { path: 'README.md' }), undefined);
  assert.equal(state.denyReason('agent-1', 'search', { q: 'DSH' }), undefined);
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
  for (let index = 0; index < 5; index += 1) {
    assert.equal(state.denyReason('agent-1', 'search', { command: 'curl /search' }), undefined);
  }
  assert.match(state.denyReason('agent-1', 'search', { command: 'curl /search' }), /DUPLICATE/);
  state.beginTurn('agent-1', 2, false);
  assert.equal(state.denyReason('agent-1', 'search', { command: 'curl /search' }), undefined);
});

test('safe integer limits accept zero only for the aggregate cap', () => {
  assert.equal(positiveInteger(3, 8), 3);
  assert.equal(positiveInteger(0, 8), 8);
  assert.equal(nonNegativeInteger(0, 64), 0);
  assert.equal(nonNegativeInteger(1.5, 64), 64);
});

