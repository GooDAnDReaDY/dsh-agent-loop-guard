import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LoopGuardState,
  maskSessionId,
  redactTelemetryText,
} from '../lib/guard-state.js';

test('maskSessionId pseudonyms session IDs cleanly (#156)', () => {
  const id1 = maskSessionId('session:user-secret-token-12345');
  assert.match(id1, /^sess-[a-f0-9]{8}$/);
  assert.ok(!id1.includes('user-secret-token'));

  // Consistent hashing for same session
  const id2 = maskSessionId('session:user-secret-token-12345');
  assert.equal(id1, id2);

  // Different for different session
  const id3 = maskSessionId('session:another-user-67890');
  assert.notEqual(id1, id3);

  // Empty / null fallback
  assert.equal(maskSessionId(null), 'sess-unknown');
});

test('redactTelemetryText redacts absolute filesystem paths (#156)', () => {
  const unixText = 'Target "/home/vadim/secret_project/config/settings.json" quota exceeded';
  const redactedUnix = redactTelemetryText(unixText);
  assert.ok(!redactedUnix.includes('/home/vadim/secret_project'));
  assert.match(redactedUnix, /\.\.\.\/settings\.json/);

  const winText = 'Target "C:\\Users\\vadim\\SecretProject\\credentials.env" quota exceeded';
  const redactedWin = redactTelemetryText(winText);
  assert.ok(!redactedWin.includes('Users\\vadim'));
  assert.match(redactedWin, /\.\.\.\/credentials\.env/);
});

test('LoopGuardState telemetry incidents contain only redacted paths and pseudonymous sessions (#156)', () => {
  const guard = new LoopGuardState({
    targetQuotaGuard: true,
    maxReadsPerTarget: 1,
    adaptiveSteering: false,
  });

  const agentObj = {
    session: { id: 'super-confidential-user-session-id-999' },
  };

  guard.beginTurn(agentObj, 1, false);

  // 1st read
  guard.denyReason(agentObj, 'read_file', { path: '/var/www/internal/config.yml' }, 'r1');
  guard.commitCall(agentObj, 'r1');
  guard.recordResult(agentObj, { callId: 'r1', result: { ok: true } });

  // 2nd read exceeds quota -> generates incident
  guard.denyReason(agentObj, 'read_file', { path: '/var/www/internal/config.yml' }, 'r2');

  const telemetry = guard.getTelemetry();
  assert.ok(telemetry.incidents.length > 0);

  const inc = telemetry.incidents[0];
  // Session must not leak raw session id
  assert.ok(!inc.session.includes('super-confidential'));
  assert.match(inc.session, /^sess-[a-f0-9]{8}$/);

  // Reason must not leak full directory path
  assert.ok(!inc.reason.includes('/var/www/internal'));
  assert.match(inc.reason, /\.\.\.\/config\.yml/);
});

