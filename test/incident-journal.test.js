import test from 'node:test';
import assert from 'node:assert/strict';
import { LoopGuardState } from '../lib/guard-state.js';

test('incident journal records violations and steering events with metadata (#143)', () => {
  const guard = new LoopGuardState({
    maxCallsPerRepeatGroup: 2,
    blockExactDuplicates: true,
    adaptiveSteering: true,
  });

  const agent = 'agent-journal-1';
  guard.beginTurn(agent, 1, false);

  // Call 1
  guard.denyReason(agent, 'read_file', { path: 'a.js' }, 'read-0');
  guard.commitCall(agent, 'read-0');
  guard.recordResult(agent, { callId: 'read-0', result: { content: '1' } });

  // Call 2
  guard.denyReason(agent, 'read_file', { path: 'a.js' }, 'read-1');
  guard.commitCall(agent, 'read-1');
  guard.recordResult(agent, { callId: 'read-1', result: { content: '1' } });

  // Call 3 triggers steering
  guard.denyReason(agent, 'read_file', { path: 'a.js' }, 'read-2');

  const telemetry = guard.getTelemetry();
  assert.ok(Array.isArray(telemetry.incidents), 'Telemetry must include incidents array');
  assert.equal(telemetry.incidents.length, 1);

  const inc = telemetry.incidents[0];
  assert.ok(inc.id.startsWith('inc-'));
  assert.equal(inc.code, 'LOOP_GUARD_STEER');
  assert.equal(inc.tool, 'read_file');
  assert.ok(inc.timestamp > 0);
  assert.ok(Array.isArray(inc.chain));
});

test('circular buffer bounds incidents to 30 and telemetry returns last 20 (#143)', () => {
  const guard = new LoopGuardState({});

  // Record 35 external violations
  for (let i = 1; i <= 35; i++) {
    guard.recordExternalViolation('LOOP_GUARD_OUTPUT', `Repeated line event ${i}`, { tool: 'assistant/output' });
  }

  assert.equal(guard.incidents.length, 30, 'Internal buffer must cap at 30');

  const telemetry = guard.getTelemetry();
  assert.equal(telemetry.incidents.length, 20, 'Telemetry view must return at most 20 incidents');
  // Telemetry is reversed (most recent first)
  assert.match(telemetry.incidents[0].reason, /event 35/);
  assert.match(telemetry.incidents[19].reason, /event 16/);
});

test('resetTelemetry clears incident history (#143)', () => {
  const guard = new LoopGuardState({});
  guard.recordExternalViolation('LOOP_GUARD_OUTPUT', 'Test event');

  assert.equal(guard.getTelemetry().incidents.length, 1);

  guard.resetTelemetry();
  assert.equal(guard.getTelemetry().incidents.length, 0);
  assert.equal(guard.incidents.length, 0);
});
