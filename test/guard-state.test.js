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

function accept(state, agent, name, args, callId, result, extra = {}) {
  assert.equal(state.denyReason(agent, name, args, callId), undefined);
  state.commitCall(agent, callId);
  return state.recordResult(agent, { callId, result, ...extra });
}

test('canonical and normalized fingerprints keep full operation identity', () => {
  assert.equal(callFingerprint('search', { b: 2, a: 1 }), callFingerprint('search', { a: 1, b: 2 }));
  assert.equal(callRepeatFingerprint('bash', { command: ' curl  /issues ' }), callRepeatFingerprint('bash', { command: 'curl /issues' }));
  assert.notEqual(
    callRepeatFingerprint('bash', { command: 'curl -H "Authorization: Bearer [redacted]" http://gitea/api/issues' }),
    callRepeatFingerprint('bash', { command: 'curl -H "Authorization: Bearer [redacted]" http://gitea/api/pulls' }),
  );
});

test('same arguments with a changing result are legitimate productive iterations', () => {
  const state = new LoopGuardState(config);
  state.beginTurn('agent-1', 1, false);
  for (let index = 0; index < 12; index += 1) {
    const outcome = accept(state, 'agent-1', 'read', { path: 'status.json' }, 'read-' + index, { revision: index });
    assert.equal(outcome.productive, true);
  }
});

test('unchanged result after repeated identical calls is blocked as no-progress', () => {
  const state = new LoopGuardState(config);
  state.beginTurn('agent-2', 1, false);
  accept(state, 'agent-2', 'read', { path: 'status.json' }, 'read-0', { revision: 1 });
  for (let index = 1; index <= 5; index += 1) {
    assert.equal(state.denyReason('agent-2', 'read', { path: 'status.json' }, 'read-' + index), undefined);
    state.commitCall('agent-2', 'read-' + index);
    state.recordResult('agent-2', { callId: 'read-' + index, result: { revision: 1 } });
  }
  const reason = state.denyReason('agent-2', 'read', { path: 'status.json' }, 'read-6');
  assert.match(reason, /LOOP_GUARD_DUPLICATE/);
  assert.match(reason, /No productive progress/);
});

test('read-edit-read-edit is allowed when each result changes state', () => {
  const state = new LoopGuardState(config);
  state.beginTurn('agent-3', 1, false);
  accept(state, 'agent-3', 'read', { path: 'package.json' }, 'read-1', { sha: 'a' });
  accept(state, 'agent-3', 'edit', { path: 'package.json', oldText: 'a', newText: 'b' }, 'edit-1', { changed: true, sha: 'b' });
  accept(state, 'agent-3', 'read', { path: 'package.json' }, 'read-2', { sha: 'b' });
  accept(state, 'agent-3', 'edit', { path: 'package.json', oldText: 'b', newText: 'c' }, 'edit-2', { changed: true, sha: 'c' });
});

test('a denied edit can be retried after read produces a new result', () => {
  const state = new LoopGuardState({ ...config, maxToolAttemptsPerTurn: 2 });
  state.beginTurn('agent-4', 1, false);
  assert.equal(state.denyReason('agent-4', 'edit', { path: 'package.json', oldText: 'a', newText: 'b' }, 'edit-1'), undefined);
  state.releaseCall('agent-4', 'edit-1');
  accept(state, 'agent-4', 'read', { path: 'package.json' }, 'read-1', { sha: 'a' });
  assert.equal(state.denyReason('agent-4', 'edit', { path: 'package.json', oldText: 'a', newText: 'b' }, 'edit-2'), undefined);
});

test('aggregate budgets reset after a productive action', () => {
  const state = new LoopGuardState({ ...config, maxToolAttemptsPerTurn: 2 });
  state.beginTurn('agent-5', 1, false);
  accept(state, 'agent-5', 'bash', { command: 'read-a' }, 'a', { output: 'a' });
  accept(state, 'agent-5', 'bash', { command: 'read-b' }, 'b', { output: 'b' });
  assert.equal(state.denyReason('agent-5', 'bash', { command: 'read-c' }, 'c'), undefined);
});

test('aggregate budget blocks a nonproductive exploratory run', () => {
  const state = new LoopGuardState({ ...config, maxToolAttemptsPerTurn: 2 });
  state.beginTurn('agent-6', 1, false);
  assert.equal(state.denyReason('agent-6', 'bash', { command: 'one' }, 'one'), undefined);
  state.commitCall('agent-6', 'one');
  state.recordResult('agent-6', { callId: 'one', result: { output: 'same' } });
  assert.equal(state.denyReason('agent-6', 'bash', { command: 'two' }, 'two'), undefined);
  state.commitCall('agent-6', 'two');
  state.recordResult('agent-6', { callId: 'two', result: { output: 'same' } });
  assert.equal(state.denyReason('agent-6', 'bash', { command: 'three' }, 'three'), undefined);
  state.commitCall('agent-6', 'three');
  state.recordResult('agent-6', { callId: 'three', result: { output: 'same' } });
  assert.match(state.denyReason('agent-6', 'bash', { command: 'four' }, 'four'), /LOOP_GUARD_LIMIT/);
});

test('progress tools have an independent no-progress budget', () => {
  const state = new LoopGuardState({ ...config, maxProgressToolCallsPerTurn: 2 });
  state.beginTurn('agent-7', 1, false);
  accept(state, 'agent-7', 'todo_write', { todos: ['one'] }, 'todo-1', { saved: true });
  assert.equal(state.denyReason('agent-7', 'todo_write', { todos: ['two'] }, 'todo-2'), undefined);
  state.commitCall('agent-7', 'todo-2');
  state.recordResult('agent-7', { callId: 'todo-2', result: { saved: true } });
  assert.equal(state.denyReason('agent-7', 'todo_write', { todos: ['three'] }, 'todo-3'), undefined);
});

test('distinct Gitea/curl operations are never collapsed by their common base URL', () => {
  const state = new LoopGuardState({ ...config, maxCallsPerRepeatGroup: 2 });
  state.beginTurn('agent-8', 1, false);
  const commands = [
    'curl -H "Authorization: Bearer [redacted]" -X POST http://gitea/api/issues',
    'curl -H "Authorization: Bearer [redacted]" -X POST http://gitea/api/pulls',
    'curl -H "Authorization: Bearer [redacted]" -X POST http://gitea/api/pulls/1/merge',
    'curl -H "Authorization: Bearer [redacted]" -X POST http://gitea/api/issues/1/comments',
    'curl -H "Authorization: Bearer [redacted]" -X PATCH http://gitea/api/issues/1',
  ];
  for (let index = 0; index < commands.length; index += 1) {
    assert.equal(state.denyReason('agent-8', 'bash', { command: commands[index] }, 'gitea-' + index), undefined);
  }
});

test('stop denial enters answer-only mode and next turn resets it', () => {
  const state = new LoopGuardState(config);
  state.beginTurn('agent-9', 1, true);
  assert.match(state.denyReason('agent-9', 'bash', { command: 'pwd' }), /LOOP_GUARD_STOP/);
  state.beginTurn('agent-9', 2, false);
  assert.equal(state.denyReason('agent-9', 'bash', { command: 'pwd' }), undefined);
});

test('loop denial logs structured progress context and subsequent calls stay stopped', () => {
  const events = [];
  const state = new LoopGuardState({ ...config, maxCallsPerRepeatGroup: 1, onViolation: (event) => events.push(event) });
  state.beginTurn('agent-10', 1, false);
  assert.equal(state.denyReason('agent-10', 'read', { path: 'x', token: 'secret-value', command: 'curl -H "Authorization: token secret-value"' }, 'read-1'), undefined);
  state.commitCall('agent-10', 'read-1');
  state.recordResult('agent-10', { callId: 'read-1', result: { value: 'same' } });
  assert.equal(state.denyReason('agent-10', 'read', { path: 'x', token: 'secret-value', command: 'curl -H "Authorization: token secret-value"' }, 'read-2'), undefined);
  state.commitCall('agent-10', 'read-2');
  state.recordResult('agent-10', { callId: 'read-2', result: { value: 'same' } });
  assert.match(state.denyReason('agent-10', 'read', { path: 'x', token: 'secret-value', command: 'curl -H "Authorization: token secret-value"' }, 'read-3'), /DUPLICATE/);
  assert.match(state.denyReason('agent-10', 'read', { path: 'x', token: 'secret-value', command: 'curl -H "Authorization: token secret-value"' }, 'read-4'), /LOOP_GUARD_STOP/);
  assert.equal(events.length, 2);
  assert.equal(events[0].code, 'LOOP_GUARD_DUPLICATE');
  assert.equal(events[0].arguments.token, '[redacted]');
  assert.equal(events[1].code, 'LOOP_GUARD_STOP');
  assert.equal(events[1].progressEpoch, 1);
});

test('result errors do not count as productive progress', () => {
  const state = new LoopGuardState({ ...config, maxCallsPerRepeatGroup: 2 });
  state.beginTurn('agent-11', 1, false);
  accept(state, 'agent-11', 'bash', { command: 'install' }, 'install-1', { error: 'failed' });
  assert.equal(state.denyReason('agent-11', 'bash', { command: 'install' }, 'install-2'), undefined);
  state.commitCall('agent-11', 'install-2');
  state.recordResult('agent-11', { callId: 'install-2', result: { error: 'failed' } });
  assert.match(state.denyReason('agent-11', 'bash', { command: 'install' }, 'install-3'), /DUPLICATE/);
});

test('explicit progress token makes an otherwise equal result productive', () => {
  const state = new LoopGuardState({ ...config, maxCallsPerRepeatGroup: 1 });
  state.beginTurn('agent-12', 1, false);
  accept(state, 'agent-12', 'bash', { command: 'check' }, 'check-1', { output: 'same' }, { progressToken: 'state-a' });
  assert.equal(state.denyReason('agent-12', 'bash', { command: 'check' }, 'check-2'), undefined);
  state.commitCall('agent-12', 'check-2');
  const result = state.recordResult('agent-12', { callId: 'check-2', result: { output: 'same' }, progressToken: 'state-b' });
  assert.equal(result.productive, true);
});

test('non-array user content is safe', () => {
  assert.equal(hasStopRequest([{ source: { kind: 'user' }, content: 'stop' }]), false);
});

test('stop request recognizes all policy keywords and ignores neutral text', () => {
  const userMsg = (text) => [{ source: { kind: 'user' }, content: [{ text }] }];
  const positive = [
    'стоп', 'Стоп!', 'СТОП', 'остановись', 'остановить',
    'прекрати', 'хватит', 'ответь', 'петля', 'stop', 'STOP'
  ];
  for (const word of positive) {
    assert.equal(hasStopRequest(userMsg(word)), true, `expected "${word}" to be recognized as stop request`);
  }

  const neutral = [
    'остановка сервиса', 'стоп-кран', 'пистолет', 'стопка документов', 'стоп-сигнал'
  ];
  for (const text of neutral) {
    assert.equal(hasStopRequest(userMsg(text)), false, `expected "${text}" to NOT be recognized as stop request`);
  }
});

test('safe integer limits accept zero only for the aggregate cap', () => {
  assert.equal(positiveInteger(3, 8), 3);
  assert.equal(positiveInteger(0, 8), 8);
  assert.equal(nonNegativeInteger(0, 64), 0);
  assert.equal(nonNegativeInteger(1.5, 64), 64);
});

test('result with error: null or error: false counts as productive progress', () => {
  const state = new LoopGuardState(config);
  state.beginTurn('agent-null-err', 1, false);
  const outcome1 = accept(state, 'agent-null-err', 'api', { endpoint: '/users' }, 'call-1', { ok: true, data: [1, 2], error: null });
  assert.equal(outcome1.productive, true);
  const outcome2 = accept(state, 'agent-null-err', 'api', { endpoint: '/posts' }, 'call-2', { ok: true, data: [3, 4], error: false });
  assert.equal(outcome2.productive, true);
});

test('alternating identical calls between two tools without state change is blocked', () => {
  const state = new LoopGuardState({ ...config, maxCallsPerRepeatGroup: 3 });
  state.beginTurn('agent-alt', 1, false);
  const r1 = accept(state, 'agent-alt', 'read', { path: 'a.txt' }, 'call-a-1', { content: 'AAA' });
  assert.equal(r1.productive, true);
  const r2 = accept(state, 'agent-alt', 'read', { path: 'b.txt' }, 'call-b-1', { content: 'BBB' });
  assert.equal(r2.productive, true);

  for (let i = 2; i <= 4; i += 1) {
    const ra = accept(state, 'agent-alt', 'read', { path: 'a.txt' }, 'call-a-' + i, { content: 'AAA' });
    assert.equal(ra.productive, false);
    const rb = accept(state, 'agent-alt', 'read', { path: 'b.txt' }, 'call-b-' + i, { content: 'BBB' });
    assert.equal(rb.productive, false);
  }

  const reason = state.denyReason('agent-alt', 'read', { path: 'a.txt' }, 'call-a-5');
  assert.match(reason, /LOOP_GUARD_DUPLICATE/);
});

test('telemetry tracks violations and resets correctly', () => {
  const state = new LoopGuardState(config);
  state.beginTurn('agent-tel', 1, false);

  assert.equal(state.getTelemetry().totalViolations, 0);
  accept(state, 'agent-tel', 'read', { file: 'x' }, 'c1', { v: 1 });
  for (let i = 2; i <= 6; i += 1) {
    state.denyReason('agent-tel', 'read', { file: 'x' }, 'c' + i);
    state.commitCall('agent-tel', 'c' + i);
    state.recordResult('agent-tel', { callId: 'c' + i, result: { v: 1 } });
  }

  // Trigger violation
  state.denyReason('agent-tel', 'read', { file: 'x' }, 'c7');
  const t1 = state.getTelemetry();
  assert.equal(t1.totalViolations >= 1, true);
  assert.equal(t1.byCode.LOOP_GUARD_DUPLICATE >= 1, true);
  assert.equal(t1.lastViolation?.code, 'LOOP_GUARD_DUPLICATE');

  // External violation (e.g. output loop)
  state.recordExternalViolation('LOOP_GUARD_OUTPUT', 'five repeated lines');
  const t2 = state.getTelemetry();
  assert.equal(t2.byCode.LOOP_GUARD_OUTPUT, 1);

  // Reset
  state.resetTelemetry();
  assert.equal(state.getTelemetry().totalViolations, 0);
});

test('strict tools apply lower repeat threshold', () => {
  const state = new LoopGuardState({
    ...config,
    maxCallsPerRepeatGroup: 6,
    strictTools: ['danger_tool'],
    strictToolLimit: 2,
  });
  state.beginTurn('agent-strict', 1, false);

  accept(state, 'agent-strict', 'danger_tool', { cmd: 'rm' }, 'd0', { ok: true });
  accept(state, 'agent-strict', 'danger_tool', { cmd: 'rm' }, 'd1', { ok: true });
  accept(state, 'agent-strict', 'danger_tool', { cmd: 'rm' }, 'd2', { ok: true });

  const reason = state.denyReason('agent-strict', 'danger_tool', { cmd: 'rm' }, 'd3');
  assert.match(reason, /LOOP_GUARD_DUPLICATE/);
});

test('dry run mode records violations without blocking execution', () => {
  const state = new LoopGuardState({
    ...config,
    maxCallsPerRepeatGroup: 2,
    dryRunMode: true,
  });
  state.beginTurn('agent-dry', 1, false);

  accept(state, 'agent-dry', 'read', { f: 1 }, 'dry0', { res: 1 });
  accept(state, 'agent-dry', 'read', { f: 1 }, 'dry1', { res: 1 });
  accept(state, 'agent-dry', 'read', { f: 1 }, 'dry2', { res: 1 });

  // Exceeds limit, but dryRunMode should return undefined
  const reason = state.denyReason('agent-dry', 'read', { f: 1 }, 'dry3');
  assert.equal(reason, undefined);
  // Telemetry is still recorded!
  assert.equal(state.getTelemetry().totalViolations >= 1, true);
});

test('actionable guidance is returned on duplicate rejection', () => {
  const state = new LoopGuardState({ ...config, maxCallsPerRepeatGroup: 2 });
  state.beginTurn('agent-guide', 1, false);
  accept(state, 'agent-guide', 'test_tool', { a: 1 }, 'g0', { out: 'same' });
  accept(state, 'agent-guide', 'test_tool', { a: 1 }, 'g1', { out: 'same' });
  accept(state, 'agent-guide', 'test_tool', { a: 1 }, 'g2', { out: 'same' });

  const reason = state.denyReason('agent-guide', 'test_tool', { a: 1 }, 'g3');
  assert.match(reason, /ACTION REQUIRED:/);
  assert.match(reason, /Stop repeating this action/);
});


