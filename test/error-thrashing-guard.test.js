import test from 'node:test';
import assert from 'node:assert/strict';
import { LoopGuardState, normalizeErrorSignature } from '../lib/guard-state.js';

test('normalizeErrorSignature extracts canonical signatures for common errors', () => {
  assert.equal(normalizeErrorSignature('ENOENT: no such file or directory, open "foo.txt"'), 'FS_ENOENT');
  assert.equal(normalizeErrorSignature(new Error('EACCES: permission denied, open "/etc/shadow"')), 'FS_EPERM');
  assert.equal(normalizeErrorSignature('Command failed with exit code 127: not found'), 'EXIT_127');
  assert.equal(normalizeErrorSignature('Request failed with status code 404 Not Found'), 'HTTP_404');
  assert.equal(normalizeErrorSignature('Connection timed out after 30000ms: ETIMEDOUT'), 'TIMEOUT');
  assert.equal(normalizeErrorSignature('ECONNREFUSED 127.0.0.1:8080'), 'CONN_REFUSED');
  assert.equal(normalizeErrorSignature('some custom error occurred'), 'some custom error occurred');
});

test('consecutive identical failures trigger LOOP_GUARD_ERROR_THRASHING (#141)', () => {
  const guard = new LoopGuardState({
    errorThrashingGuard: true,
    maxConsecutiveFailures: 3,
    adaptiveSteering: false,
  });

  const agent = 'agent-thrash-1';
  guard.beginTurn(agent, 1, false);

  // Attempt 1 fails
  assert.equal(guard.denyReason(agent, 'read_file', { path: 'a.js' }, 'c1'), undefined);
  guard.commitCall(agent, 'c1');
  guard.recordResult(agent, { callId: 'c1', error: 'ENOENT: no such file a.js' });

  // Attempt 2 fails with same error signature
  assert.equal(guard.denyReason(agent, 'read_file', { path: 'b.js' }, 'c2'), undefined);
  guard.commitCall(agent, 'c2');
  guard.recordResult(agent, { callId: 'c2', error: 'ENOENT: no such file b.js' });

  // Attempt 3 fails with same error signature
  assert.equal(guard.denyReason(agent, 'read_file', { path: 'c.js' }, 'c3'), undefined);
  guard.commitCall(agent, 'c3');
  guard.recordResult(agent, { callId: 'c3', error: 'ENOENT: no such file c.js' });

  // Attempt 4 should be denied with LOOP_GUARD_ERROR_THRASHING
  const denial = guard.denyReason(agent, 'read_file', { path: 'd.js' }, 'c4');
  assert.ok(denial, 'Should be denied');
  assert.match(denial, /LOOP_GUARD_ERROR_THRASHING/);
  assert.match(denial, /FS_ENOENT/);
  assert.equal(guard.metrics.byCode.LOOP_GUARD_ERROR_THRASHING, 1);
});

test('successful productive tool call resets error thrashing counters (#141)', () => {
  const guard = new LoopGuardState({
    errorThrashingGuard: true,
    maxConsecutiveFailures: 3,
    adaptiveSteering: false,
  });

  const agent = 'agent-thrash-2';
  guard.beginTurn(agent, 1, false);

  // 2 failures
  for (let i = 1; i <= 2; i++) {
    assert.equal(guard.denyReason(agent, 'read_file', { path: `missing${i}.txt` }, `c${i}`), undefined);
    guard.commitCall(agent, `c${i}`);
    guard.recordResult(agent, { callId: `c${i}`, error: 'ENOENT: not found' });
  }

  const state = guard.stateFor(agent);
  assert.equal(state.consecutiveFailures, 2);

  // Successful call
  assert.equal(guard.denyReason(agent, 'read_file', { path: 'found.txt' }, 'c3'), undefined);
  guard.commitCall(agent, 'c3');
  guard.recordResult(agent, { callId: 'c3', result: { content: 'hello world' } });

  assert.equal(state.consecutiveFailures, 0);
  assert.equal(state.lastErrorSignature, null);
  assert.equal(state.errorRepeatCount, 0);

  // Now next failures start from 0
  assert.equal(guard.denyReason(agent, 'read_file', { path: 'missing3.txt' }, 'c4'), undefined);
});

test('errorThrashingGuard: false disables error thrashing protection (#141)', () => {
  const guard = new LoopGuardState({
    errorThrashingGuard: false,
    maxConsecutiveFailures: 2,
    adaptiveSteering: false,
  });

  const agent = 'agent-thrash-3';
  guard.beginTurn(agent, 1, false);

  for (let i = 1; i <= 5; i++) {
    assert.equal(guard.denyReason(agent, 'read_file', { path: `missing${i}.txt` }, `c${i}`), undefined);
    guard.commitCall(agent, `c${i}`);
    guard.recordResult(agent, { callId: `c${i}`, error: 'EACCES: permission denied' });
  }

  assert.equal(guard.metrics.byCode.LOOP_GUARD_ERROR_THRASHING, 0);
});
