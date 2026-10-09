import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LoopGuardState,
  callFingerprint,
  callRepeatFingerprint,
  resultFingerprint,
  hasStopRequest,
  nonNegativeInteger,
  positiveInteger,
} from '../lib/guard-state.js';

const config = {
  maxToolAttemptsPerTurn: 8,
  maxProgressToolCallsPerTurn: 16,
  maxCallsPerRepeatGroup: 5,
  blockExactDuplicates: false,
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
  assert.match(reason, /LOOP_GUARD_REPEAT/);
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
  state.recordResult('agent-4', { callId: 'edit-1' });
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
  const state = new LoopGuardState({ ...config, maxCallsPerRepeatGroup: 1, blockExactDuplicates: true, onViolation: (event) => events.push(event) });
  state.beginTurn('agent-10', 1, false);
  assert.equal(state.denyReason('agent-10', 'read', { path: 'x', token: 'secret-value', command: 'curl -H "Authorization: token secret-value"' }, 'read-1'), undefined);
  state.commitCall('agent-10', 'read-1');
  state.recordResult('agent-10', { callId: 'read-1', result: { value: 'same' } });
  assert.equal(state.denyReason('agent-10', 'read', { path: 'x', token: 'secret-value', command: 'curl -H "Authorization: token secret-value"' }, 'read-2'), undefined);
  state.commitCall('agent-10', 'read-2');
  state.recordResult('agent-10', { callId: 'read-2', result: { value: 'same' } });
  assert.match(state.denyReason('agent-10', 'read', { path: 'x', token: 'secret-value', command: 'curl -H "Authorization: token secret-value"' }, 'read-3'), /DUPLICATE/);
  assert.match(state.denyReason('agent-10', 'read', { path: 'x', token: 'secret-value', command: 'curl -H "Authorization: token secret-value"' }, 'read-4'), /DUPLICATE/);
  assert.equal(events.length, 2);
  assert.equal(events[0].code, 'LOOP_GUARD_DUPLICATE');
  assert.equal(events[0].arguments.token, '[redacted]');
  assert.equal(events[1].code, 'LOOP_GUARD_DUPLICATE');
  assert.equal(events[1].progressEpoch, 1);
});

test('result errors do not count as productive progress', () => {
  const state = new LoopGuardState({ ...config, maxCallsPerRepeatGroup: 2 });
  state.beginTurn('agent-11', 1, false);
  accept(state, 'agent-11', 'bash', { command: 'install' }, 'install-1', { error: 'failed' });
  assert.equal(state.denyReason('agent-11', 'bash', { command: 'install' }, 'install-2'), undefined);
  state.commitCall('agent-11', 'install-2');
  state.recordResult('agent-11', { callId: 'install-2', result: { error: 'failed' } });
  assert.match(state.denyReason('agent-11', 'bash', { command: 'install' }, 'install-3'), /REPEAT/);
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

test('stop request recognizes default EN and ZH policy keywords and ignores neutral text (#103)', () => {
  const userMsg = (text) => [{ source: { kind: 'user' }, content: [{ text }] }];
  const positiveEn = [
    'stop', 'STOP', 'Stop!', 'halt', 'HALT', 'cancel', 'Cancel', 'abort', 'ABORT',
    'terminate', 'answer', 'answer now', 'Answer now!'
  ];
  for (const word of positiveEn) {
    assert.equal(hasStopRequest(userMsg(word)), true, `expected "${word}" to be recognized as stop request`);
  }

  const positiveZh = [
    '停止', '请停止', '暂停', '请暂停执行', '取消', '取消操作',
    '终止', '请终止', '回答', '请回答', '死循环', '检测到死循环'
  ];
  for (const word of positiveZh) {
    assert.equal(hasStopRequest(userMsg(word)), true, `expected "${word}" to be recognized as stop request`);
  }

  const neutral = [
    'non-stop flight', 'answering machine', 'postponed'
  ];
  for (const text of neutral) {
    assert.equal(hasStopRequest(userMsg(text)), false, `expected "${text}" to NOT be recognized as stop request`);
  }
});

test('stop request supports configurable customPatterns (#103)', () => {
  const userMsg = (text) => [{ source: { kind: 'user' }, content: [{ text }] }];

  // Without custom patterns, words outside EN/ZH are not matched
  assert.equal(hasStopRequest(userMsg('стоп')), false);
  assert.equal(hasStopRequest(userMsg('хватит')), false);

  // With custom pattern array
  const customList = ['стоп', 'остановись', 'прекрати', 'хватит', 'ответь', 'петля'];
  for (const word of customList) {
    assert.equal(hasStopRequest(userMsg(word), customList), true, `expected custom "${word}" to match`);
  }

  // Regex pattern support
  const regexPattern = [/\b(?:break|pause)\b/iu];
  assert.equal(hasStopRequest(userMsg('break'), regexPattern), true);
  assert.equal(hasStopRequest(userMsg('breakfast'), regexPattern), false);
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
  assert.match(reason, /LOOP_GUARD_REPEAT/);
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
  assert.equal((t1.byCode.LOOP_GUARD_DUPLICATE || t1.byCode.LOOP_GUARD_REPEAT) >= 1, true);
  assert.equal(t1.lastViolation?.code === 'LOOP_GUARD_DUPLICATE' || t1.lastViolation?.code === 'LOOP_GUARD_REPEAT', true);

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
  assert.match(reason, /LOOP_GUARD_REPEAT/);
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
  const state = new LoopGuardState({ ...config, blockExactDuplicates: true });
  state.beginTurn('agent-guide', 1, false);
  accept(state, 'agent-guide', 'test_tool', { a: 1 }, 'g0', { out: 'same' });
  assert.equal(state.denyReason('agent-guide', 'test_tool', { a: 1 }, 'g1'), undefined);
  state.commitCall('agent-guide', 'g1');
  state.recordResult('agent-guide', { callId: 'g1', result: { out: 'same' } });

  const reason = state.denyReason('agent-guide', 'test_tool', { a: 1 }, 'g2');
  assert.match(reason, /ACTION REQUIRED:/);
  assert.match(reason, /Stop repeating this action/);
});

test('onViolation callback errors are safely caught and logged via logger.debug', () => {
  const logs = [];
  const fakeLogger = {
    debug: (msg) => logs.push(msg),
  };
  const state = new LoopGuardState({
    ...config,
    logger: fakeLogger,
    onViolation: () => {
      throw new Error('boom');
    },
  });
  state.beginTurn('agent-err', 1, true);
  const reason = state.denyReason('agent-err', 'tool', { a: 1 }, 'c1');
  assert.ok(reason);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /onViolation callback failed: boom/);
});



test('blockExactDuplicates: true immediately blocks second consecutive identical call without state change', () => {
  const state = new LoopGuardState({ ...config, blockExactDuplicates: true });
  state.beginTurn('agent-exact', 1, false);
  accept(state, 'agent-exact', 'read', { path: 'status.json' }, 'read-0', { revision: 1 });
  assert.equal(state.denyReason('agent-exact', 'read', { path: 'status.json' }, 'read-1'), undefined);
  state.commitCall('agent-exact', 'read-1');
  state.recordResult('agent-exact', { callId: 'read-1', result: { revision: 1 } });
  const reason = state.denyReason('agent-exact', 'read', { path: 'status.json' }, 'read-2');
  assert.match(reason, /LOOP_GUARD_DUPLICATE/);
});

test('blockExactDuplicates: false allows identical calls up to maxCallsPerRepeatGroup', () => {
  const state = new LoopGuardState({ ...config, maxCallsPerRepeatGroup: 3, blockExactDuplicates: false });
  state.beginTurn('agent-no-exact', 1, false);
  accept(state, 'agent-no-exact', 'read', { path: 'status.json' }, 'read-0', { revision: 1 });
  for (let i = 1; i <= 3; i++) {
    assert.equal(state.denyReason('agent-no-exact', 'read', { path: 'status.json' }, 'read-' + i), undefined);
    state.commitCall('agent-no-exact', 'read-' + i);
    state.recordResult('agent-no-exact', { callId: 'read-' + i, result: { revision: 1 } });
  }
  const reason = state.denyReason('agent-no-exact', 'read', { path: 'status.json' }, 'read-4');
  assert.match(reason, /LOOP_GUARD_REPEAT/);
});

test('disposeSession removes session state and decrements activeAgents count', () => {
  const state = new LoopGuardState(config);
  state.beginTurn({ session: { id: 'sess-123' } }, 1, false);
  assert.equal(state.getTelemetry().activeAgents, 1);
  state.disposeSession('sess-123');
  assert.equal(state.getTelemetry().activeAgents, 0);
});

test('uncommitted call released in recordResult decrements repeat and exact group counts', () => {
  const state = new LoopGuardState({ ...config, blockExactDuplicates: true, maxCallsPerRepeatGroup: 2 });
  state.beginTurn('agent-uncommitted', 1, false);
  accept(state, 'agent-uncommitted', 'read', { path: 'file.txt' }, 'c1', { text: 'v1' });
  // Reserve c2, but do not commit it
  assert.equal(state.denyReason('agent-uncommitted', 'read', { path: 'file.txt' }, 'c2'), undefined);
  // c2 is pending and uncommitted; recordResult releases it
  const res = state.recordResult('agent-uncommitted', { callId: 'c2' });
  assert.equal(res.productive, false);
  // Exact group count was decremented, so c3 is allowed
  assert.equal(state.denyReason('agent-uncommitted', 'read', { path: 'file.txt' }, 'c3'), undefined);
  state.commitCall('agent-uncommitted', 'c3');
  state.recordResult('agent-uncommitted', { callId: 'c3', result: { text: 'v1' } });
  // Now c4 is an exact duplicate after committed unproductive c3, so it is blocked
  const reason = state.denyReason('agent-uncommitted', 'read', { path: 'file.txt' }, 'c4');
  assert.match(reason, /LOOP_GUARD_DUPLICATE/);
});

test('large tool arguments and results are hashed into compact signatures', () => {
  const largeData = 'x'.repeat(10000);
  const fp = callFingerprint('read', { content: largeData });
  assert.equal(fp.startsWith('read:sha256:'), true);
  assert.equal(fp.length < 100, true);

  const rfp = resultFingerprint({ big: largeData });
  assert.equal(rfp.startsWith('sha256:'), true);
  assert.equal(rfp.length < 100, true);

  // Equal large data produces identical fingerprint
  assert.equal(callFingerprint('read', { content: largeData }), fp);
  assert.equal(resultFingerprint({ big: largeData }), rfp);

  // Different large data produces different fingerprint
  assert.notEqual(callFingerprint('read', { content: largeData + 'y' }), fp);
  assert.notEqual(resultFingerprint({ big: largeData + 'y' }), rfp);
});

test('subsequent calls after violation retain original violation code in telemetry instead of LOOP_GUARD_STOP', () => {
  const state = new LoopGuardState({ ...config, maxCallsPerRepeatGroup: 1, blockExactDuplicates: true });
  state.beginTurn('agent-tel2', 1, false);

  accept(state, 'agent-tel2', 'read', { file: 'same' }, 'c1', { v: 1 });
  accept(state, 'agent-tel2', 'read', { file: 'same' }, 'c2', { v: 1 });

  // First violation triggers LOOP_GUARD_DUPLICATE
  state.denyReason('agent-tel2', 'read', { file: 'same' }, 'c3');
  // Subsequent attempts in the same turn should retain LOOP_GUARD_DUPLICATE
  state.denyReason('agent-tel2', 'read', { file: 'same' }, 'c4');
  state.denyReason('agent-tel2', 'bash', { command: 'ls' }, 'c5');

  const telemetry = state.getTelemetry();
  assert.equal(telemetry.byCode.LOOP_GUARD_STOP || 0, 0);
  assert.equal(telemetry.byCode.LOOP_GUARD_DUPLICATE, 3);
});
