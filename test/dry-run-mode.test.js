import test from 'node:test';
import assert from 'node:assert/strict';
import { LoopGuardState } from '../lib/guard-state.js';
import { AssistantOutputGuardState } from '../lib/assistant-output-state.js';

test('dryRunMode: tool violations return undefined (no denial) and do not set answerOnly (#162)', () => {
  const guard = new LoopGuardState({
    dryRunMode: true,
    blockExactDuplicates: true,
    maxCallsPerRepeatGroup: 1,
  });

  const agent = 'agent-dryrun';
  guard.beginTurn(agent, 1, false);

  // Exact duplicate call
  guard.denyReason(agent, 'read_file', { path: 'a.txt' }, 'c1');
  guard.commitCall(agent, 'c1');

  // 2nd identical call: in dryRunMode, must return undefined!
  const denial = guard.denyReason(agent, 'read_file', { path: 'a.txt' }, 'c2');
  assert.equal(denial, undefined, 'dryRunMode must not return a denial message');
  assert.equal(guard.stateFor(agent).answerOnly, false, 'dryRunMode must not latch into answerOnly');

  // Violation is still recorded in telemetry metrics
  assert.equal(guard.metrics.totalViolations, 1);
  assert.equal(guard.metrics.byCode.LOOP_GUARD_DUPLICATE, 1);
});

test('dryRunMode: incidents indicate dryRun status (#162)', () => {
  const guard = new LoopGuardState({
    dryRunMode: true,
    blockExactDuplicates: true,
  });

  const agent = 'agent-dryrun-meta';
  guard.beginTurn(agent, 1, false);

  guard.denyReason(agent, 'test_tool', { x: 1 }, 'c1');
  guard.commitCall(agent, 'c1');
  guard.denyReason(agent, 'test_tool', { x: 1 }, 'c2');

  const telemetry = guard.getTelemetry();
  assert.equal(telemetry.dryRunMode, true);
  assert.ok(telemetry.incidents.length > 0);
});

