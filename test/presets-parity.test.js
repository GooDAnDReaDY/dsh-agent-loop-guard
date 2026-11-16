import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GUARD_PRESETS, LoopGuardState } from '../lib/guard-state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('GUARD_PRESETS and CLIENT_PRESETS have 1:1 parameter parity (#159)', () => {
  const clientPresetsCode = fs.readFileSync(path.join(__dirname, '../src/client/30-presets.js'), 'utf-8');

  // Extract CLIENT_PRESETS object using Function
  const match = /const CLIENT_PRESETS\s*=\s*(\{[\s\S]*?\n\s*\});/.exec(clientPresetsCode);
  assert.ok(match, 'CLIENT_PRESETS must be found in src/client/30-presets.js');

  const CLIENT_PRESETS = new Function('return ' + match[1])();

  const presetNames = ['strict', 'balanced', 'autonomous'];
  for (const name of presetNames) {
    const serverPreset = GUARD_PRESETS[name];
    const clientPreset = CLIENT_PRESETS[name];

    assert.ok(serverPreset, `server GUARD_PRESETS.${name} must exist`);
    assert.ok(clientPreset, `client CLIENT_PRESETS.${name} must exist`);

    for (const [key, clientVal] of Object.entries(clientPreset)) {
      assert.equal(
        serverPreset[key],
        clientVal,
        `Preset "${name}" field "${key}" must match: server=${serverPreset[key]}, client=${clientVal}`
      );
    }
  }
});

test('LoopGuardState constructor default maxUnchangedReadsPerTarget matches schema default 3 (#159)', () => {
  const guard = new LoopGuardState();
  assert.equal(guard.config.maxUnchangedReadsPerTarget, 3);
});

