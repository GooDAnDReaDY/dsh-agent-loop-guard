import test from 'node:test';
import assert from 'node:assert/strict';
import { LoopGuardState } from '../lib/guard-state.js';

test('Smart Steering allows recovery attempt after error thrashing before escalation (#149)', () => {
  const guard = new LoopGuardState({
    errorThrashingGuard: true,
    maxConsecutiveFailures: 2,
    adaptiveSteering: true,
  });

  const agent = 'agent-thrash-recovery';
  guard.beginTurn(agent, 1, false);

  // Failure 1
  assert.equal(guard.denyReason(agent, 'read_file', { path: 'missing.txt' }, 'c1'), undefined);
  guard.commitCall(agent, 'c1');
  guard.recordResult(agent, { callId: 'c1', result: { error: 'FS_ENOENT: no such file' } });

  // Failure 2: reaches threshold (2 consecutive failures)
  assert.equal(guard.denyReason(agent, 'read_file', { path: 'missing2.txt' }, 'c2'), undefined);
  guard.commitCall(agent, 'c2');
  guard.recordResult(agent, { callId: 'c2', result: { error: 'FS_ENOENT: no such file' } });

  // Attempt 3: Triggers adaptive steering warning (steered)
  const steerWarning = guard.denyReason(agent, 'read_file', { path: 'missing3.txt' }, 'c3');
  assert.ok(steerWarning);
  assert.match(steerWarning, /\[LOOP_GUARD_STEER\]/);
  assert.match(steerWarning, /identical failures/);
  assert.equal(guard.stateFor(agent).answerOnly, false);
  assert.equal(guard.metrics.steeredCount, 1);

  // Recovery attempt: Agent switches to a different tool to recover (e.g. search_files)
  // CRITICAL: This call MUST NOT be blocked immediately by errorThrashingGuard! (#149)
  const recoveryCall = guard.denyReason(agent, 'search_files', { query: 'backup' }, 'c-recovery');
  assert.equal(recoveryCall, undefined, 'Recovery attempt must be allowed to execute');
  guard.commitCall(agent, 'c-recovery');

  // Recovery succeeds!
  guard.recordResult(agent, { callId: 'c-recovery', result: { files: ['backup.txt'] } });

  // State is now recovered: consecutiveFailures reset to 0
  assert.equal(guard.stateFor(agent).consecutiveFailures, 0);

  // Next tool call can proceed normally
  assert.equal(guard.denyReason(agent, 'read_file', { path: 'backup.txt' }, 'c-next'), undefined);
});

test('Unsuccessful recovery attempt after error thrashing escalates to hard violation (#149)', () => {
  const guard = new LoopGuardState({
    errorThrashingGuard: true,
    maxConsecutiveFailures: 2,
    adaptiveSteering: true,
  });

  const agent = 'agent-thrash-escalate';
  guard.beginTurn(agent, 1, false);

  // 2 consecutive failures
  for (let i = 1; i <= 2; i++) {
    guard.denyReason(agent, 'tool_a', { i }, `f-${i}`);
    guard.commitCall(agent, `f-${i}`);
    guard.recordResult(agent, { callId: `f-${i}`, result: { error: 'fatal error' } });
  }

  // 3rd call steered
  const steer = guard.denyReason(agent, 'tool_a', { v: 3 }, 'steer-1');
  assert.match(steer, /\[LOOP_GUARD_STEER\]/);

  // 4th call: recovery attempt allowed
  assert.equal(guard.denyReason(agent, 'tool_b', { attempt: 1 }, 'rec-1'), undefined);
  guard.commitCall(agent, 'rec-1');

  // Recovery attempt fails too!
  guard.recordResult(agent, { callId: 'rec-1', result: { error: 'still failing' } });

  // 5th call: Escalation!
  const hardDenial = guard.denyReason(agent, 'tool_b', { attempt: 2 }, 'esc-1');
  assert.match(hardDenial, /LOOP_GUARD_ERROR_THRASHING/);
  assert.equal(guard.stateFor(agent).answerOnly, true);
});

