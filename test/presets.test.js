import test from 'node:test';
import assert from 'node:assert/strict';
import { LoopGuardState, GUARD_PRESETS } from '../lib/guard-state.js';

test('GUARD_PRESETS exports valid strict, balanced, and autonomous configurations (#144)', () => {
  assert.ok(GUARD_PRESETS.strict, 'strict preset must exist');
  assert.ok(GUARD_PRESETS.balanced, 'balanced preset must exist');
  assert.ok(GUARD_PRESETS.autonomous, 'autonomous preset must exist');

  for (const [name, preset] of Object.entries(GUARD_PRESETS)) {
    assert.equal(preset.name, name);
    assert.ok(preset.maxToolAttemptsPerTurn > 0);
    assert.ok(preset.maxCallsPerRepeatGroup > 0);
    assert.equal(preset.errorThrashingGuard, true);
    assert.ok(preset.maxConsecutiveFailures >= 2);
    assert.equal(preset.adaptiveSteering, true);
  }
});

test('applying preset dynamically updates LoopGuardState limits (#144)', () => {
  const guard = new LoopGuardState({});
  assert.equal(guard.config.maxToolAttemptsPerTurn, 64);

  // Switch to strict preset
  guard.updateConfig(GUARD_PRESETS.strict);
  assert.equal(guard.config.maxToolAttemptsPerTurn, 10);
  assert.equal(guard.config.maxCallsPerRepeatGroup, 2);
  assert.equal(guard.config.strictToolLimit, 1);
  assert.equal(guard.config.maxConsecutiveFailures, 3);

  // Switch to autonomous preset
  guard.updateConfig(GUARD_PRESETS.autonomous);
  assert.equal(guard.config.maxToolAttemptsPerTurn, 32);
  assert.equal(guard.config.maxCallsPerRepeatGroup, 5);
  assert.equal(guard.config.strictToolLimit, 3);
});
