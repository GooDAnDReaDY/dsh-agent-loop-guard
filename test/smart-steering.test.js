import test from 'node:test';
import assert from 'node:assert/strict';
import { LoopGuardState } from '../lib/guard-state.js';

test('first violation triggers smart steering directive instead of immediate hard stop (#142)', () => {
  const guard = new LoopGuardState({
    maxCallsPerRepeatGroup: 2,
    blockExactDuplicates: true,
    adaptiveSteering: true,
  });

  const agent = 'agent-steer-1';
  guard.beginTurn(agent, 1, false);

  // Initial call (read-0) sets baseline state
  assert.equal(guard.denyReason(agent, 'read_file', { path: 'a.js' }, 'read-0'), undefined);
  guard.commitCall(agent, 'read-0');
  guard.recordResult(agent, { callId: 'read-0', result: { content: 'unchanged' } });

  // Call 1: duplicate call allowed once
  assert.equal(guard.denyReason(agent, 'read_file', { path: 'a.js' }, 'read-1'), undefined);
  guard.commitCall(agent, 'read-1');
  guard.recordResult(agent, { callId: 'read-1', result: { content: 'unchanged' } });

  // Call 2: duplicate call would trigger LOOP_GUARD_DUPLICATE.
  // With adaptiveSteering=true, this returns steering warning!
  const steerWarning = guard.denyReason(agent, 'read_file', { path: 'a.js' }, 'read-2');
  assert.ok(steerWarning, 'Should return a steering warning');
  assert.match(steerWarning, /\[LOOP_GUARD_STEER\] Warning:/);
  assert.match(steerWarning, /Tool "read_file" is repeating previous calls/);

  // Agent should NOT be locked in answerOnly mode yet!
  const state = guard.stateFor(agent);
  assert.equal(state.answerOnly, false);
  assert.equal(guard.metrics.steeredCount, 1);
  assert.equal(guard.getTelemetry().steeredCount, 1);
});

test('subsequent uncorrected call escalates to hard violation (#142)', () => {
  const guard = new LoopGuardState({
    maxCallsPerRepeatGroup: 2,
    blockExactDuplicates: true,
    adaptiveSteering: true,
  });

  const agent = 'agent-steer-2';
  guard.beginTurn(agent, 1, false);

  // Initial call & duplicate result
  assert.equal(guard.denyReason(agent, 'read_file', { path: 'a.js' }, 'read-0'), undefined);
  guard.commitCall(agent, 'read-0');
  guard.recordResult(agent, { callId: 'read-0', result: { content: 'unchanged' } });

  assert.equal(guard.denyReason(agent, 'read_file', { path: 'a.js' }, 'read-1'), undefined);
  guard.commitCall(agent, 'read-1');
  guard.recordResult(agent, { callId: 'read-1', result: { content: 'unchanged' } });

  // Call 2: steering triggered
  const steerWarning = guard.denyReason(agent, 'read_file', { path: 'a.js' }, 'read-2');
  assert.match(steerWarning, /\[LOOP_GUARD_STEER\]/);

  // Call 3: agent ignores warning and tries exact duplicate again -> HARD VIOLATION
  const hardDenial = guard.denyReason(agent, 'read_file', { path: 'a.js' }, 'read-3');
  assert.ok(hardDenial);
  assert.match(hardDenial, /\[LOOP_GUARD_DUPLICATE\]/);
  assert.match(hardDenial, /No productive progress was observed/);

  // Hard stop is now active
  const state = guard.stateFor(agent);
  assert.equal(state.answerOnly, true);
  assert.equal(guard.metrics.byCode.LOOP_GUARD_DUPLICATE, 1);
});

test('productive progress clears steering latch (#142)', () => {
  const guard = new LoopGuardState({
    maxCallsPerRepeatGroup: 2,
    blockExactDuplicates: true,
    adaptiveSteering: true,
  });

  const agent = 'agent-steer-3';
  guard.beginTurn(agent, 1, false);

  // Initial call & duplicate result
  assert.equal(guard.denyReason(agent, 'read_file', { path: 'a.js' }, 'read-0'), undefined);
  guard.commitCall(agent, 'read-0');
  guard.recordResult(agent, { callId: 'read-0', result: { content: 'unchanged' } });

  assert.equal(guard.denyReason(agent, 'read_file', { path: 'a.js' }, 'read-1'), undefined);
  guard.commitCall(agent, 'read-1');
  guard.recordResult(agent, { callId: 'read-1', result: { content: 'unchanged' } });

  // Steering triggered on call 2
  const steerWarning = guard.denyReason(agent, 'read_file', { path: 'a.js' }, 'read-2');
  assert.match(steerWarning, /\[LOOP_GUARD_STEER\]/);

  // Model heeds warning, chooses different tool/args that succeeds productively
  assert.equal(guard.denyReason(agent, 'search', { query: 'export' }, 'search-1'), undefined);
  guard.commitCall(agent, 'search-1');
  guard.recordResult(agent, { callId: 'search-1', result: { match: 'found line 10' } });

  const state = guard.stateFor(agent);
  assert.equal(state.steeredCodes?.size, 0, 'Steering latch should be reset after productive call');
});

test('stop request bypasses steering and halts immediately (#142)', () => {
  const guard = new LoopGuardState({
    adaptiveSteering: true,
  });

  const agent = 'agent-steer-4';
  guard.beginTurn(agent, 1, true); // stop requested

  const denial = guard.denyReason(agent, 'read_file', { path: 'a.js' }, 'c1');
  assert.match(denial, /\[LOOP_GUARD_STOP\]/);
  assert.equal(guard.stateFor(agent).answerOnly, true);
  assert.equal(guard.metrics.steeredCount, 0);
});
