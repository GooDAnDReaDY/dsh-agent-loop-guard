import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  LoopGuardState,
  extractTargetKey,
  classifyToolAction,
  GUARD_PRESETS,
} from '../lib/guard-state.js';

test('extractTargetKey normalizes various target parameters across OS styles', () => {
  assert.equal(extractTargetKey('read_file', { path: 'src/index.js' }), 'src/index.js');
  assert.equal(extractTargetKey('read_file', { file: './src/index.js' }), 'src/index.js');
  const expectedDrive = process.platform === 'win32' ? 'c:/project/app/main.py' : 'c:/Project/App/main.py';
  assert.equal(extractTargetKey('edit_file', { filePath: 'C:\\Project\\App\\main.py' }), expectedDrive);
  assert.equal(extractTargetKey('cat', { target: '/var/log//syslog' }), '/var/log/syslog');
  assert.equal(extractTargetKey('fetch', { uri: 'file:///home/user/doc.txt' }), '/home/user/doc.txt');
  assert.equal(extractTargetKey('write', { dest: 'build/out/' }), 'build/out');
  assert.equal(extractTargetKey('copy', { destination: 'dist/bundle.js' }), 'dist/bundle.js');
  assert.equal(extractTargetKey('inspect', { params: { path: './lib/test.ts' } }), 'lib/test.ts');
  assert.equal(extractTargetKey('bash', { command: 'ls -la' }), null);
  assert.equal(extractTargetKey('read', null), null);

  // #151: dot-dot normalization
  assert.equal(extractTargetKey('read', { path: 'a/../b.txt' }), 'b.txt');
  assert.equal(extractTargetKey('read', { path: 'a/../b.txt' }), extractTargetKey('read', { path: 'b.txt' }));

  // #151: case preservation on non-win32
  if (process.platform !== 'win32') {
    assert.notEqual(extractTargetKey('read', { path: 'README.md' }), extractTargetKey('read', { path: 'readme.md' }));
  }

  // #151: symlink resolution
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'target-key-test-'));
  try {
    const realFile = path.join(tmpDir, 'real.txt');
    const linkFile = path.join(tmpDir, 'link.txt');
    fs.writeFileSync(realFile, 'data');
    fs.symlinkSync(realFile, linkFile);
    assert.equal(extractTargetKey('read', { path: linkFile }), extractTargetKey('read', { path: realFile }));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('classifyToolAction identifies common operation categories and avoids substring false positives (#150)', () => {
  assert.equal(classifyToolAction('read_file'), 'read');
  assert.equal(classifyToolAction('readFile'), 'read');
  assert.equal(classifyToolAction('cat'), 'read');
  assert.equal(classifyToolAction('inspect_file'), 'read');
  assert.equal(classifyToolAction('edit_file'), 'edit');
  assert.equal(classifyToolAction('patch_content'), 'edit');
  assert.equal(classifyToolAction('replace_in_file'), 'edit');
  assert.equal(classifyToolAction('write_file'), 'write');
  assert.equal(classifyToolAction('create_file'), 'write');
  assert.equal(classifyToolAction('delete_file'), 'delete');
  assert.equal(classifyToolAction('rm'), 'delete');
  assert.equal(classifyToolAction('execute_bash'), 'default');

  // #150 fixes
  assert.equal(classifyToolAction('format_code'), 'edit');
  assert.equal(classifyToolAction('confirm_changes'), 'default');
  assert.equal(classifyToolAction('perform_action'), 'default');
  assert.equal(classifyToolAction('transform_data'), 'default');
  assert.equal(classifyToolAction('review_changes'), 'default');
  assert.equal(classifyToolAction('preview_url'), 'default');
  assert.equal(classifyToolAction('locate_symbol'), 'default');
});

test('Target Quota Guard catches unchanged re-reads across slice variations and epoch resets (gh-3 reproduction)', () => {
  const guard = new LoopGuardState({
    targetQuotaGuard: true,
    maxUnchangedReadsPerTarget: 3,
    adaptiveSteering: false,
    blockExactDuplicates: true,
  });

  const agent = 'agent-gh3';
  guard.beginTurn(agent, 1, false);

  const file = 'backend/file_manager.py';
  const content = 'def process(): pass';

  // Read 1: initial read
  assert.equal(guard.denyReason(agent, 'read_file', { path: file, startLine: 1, endLine: 50 }, 'r1'), undefined);
  guard.commitCall(agent, 'r1');
  guard.recordResult(agent, { callId: 'r1', result: { content } });

  // Interleaving tool call that makes productive progress and increments progressEpoch
  assert.equal(guard.denyReason(agent, 'list_files', { path: '.' }, 'list1'), undefined);
  guard.commitCall(agent, 'list1');
  guard.recordResult(agent, { callId: 'list1', result: { files: ['a', 'b', 'c'] } });

  // Read 2: 1st unchanged re-read (different arguments, same unchanged content)
  assert.equal(guard.denyReason(agent, 'read_file', { path: file, startLine: 20, endLine: 70 }, 'r2'), undefined);
  guard.commitCall(agent, 'r2');
  guard.recordResult(agent, { callId: 'r2', result: { content } });

  // Another interleaving tool call
  assert.equal(guard.denyReason(agent, 'grep', { pattern: 'def' }, 'grep1'), undefined);
  guard.commitCall(agent, 'grep1');
  guard.recordResult(agent, { callId: 'grep1', result: { matches: [1] } });

  // Read 3: 2nd unchanged re-read (different arguments, same unchanged content)
  assert.equal(guard.denyReason(agent, 'read_file', { path: file, startLine: 1, endLine: 100 }, 'r3'), undefined);
  guard.commitCall(agent, 'r3');
  guard.recordResult(agent, { callId: 'r3', result: { content } });

  // Another interleaving tool call
  assert.equal(guard.denyReason(agent, 'todo_write', { todos: ['step2'] }, 'todo1'), undefined);
  guard.commitCall(agent, 'todo1');
  guard.recordResult(agent, { callId: 'todo1', result: { ok: true } });

  // Read 4: 3rd unchanged re-read
  assert.equal(guard.denyReason(agent, 'read_file', { path: file, startLine: 10, endLine: 40 }, 'r4'), undefined);
  guard.commitCall(agent, 'r4');
  guard.recordResult(agent, { callId: 'r4', result: { content } });

  // Read 5: exceeds maxUnchangedReadsPerTarget (3)! Denied!
  const denial = guard.denyReason(agent, 'read_file', { path: file, startLine: 5, endLine: 25 }, 'r5');
  assert.ok(denial, 'Should be denied by Target Quota Guard');
  assert.match(denial, /LOOP_GUARD_UNREFRESHED_READ/);
  assert.match(denial, /Target "backend\/file_manager\.py" has been read/);
  assert.equal(guard.metrics.byCode.LOOP_GUARD_UNREFRESHED_READ, 1);
});

test('Non-latching denial: agent is NOT locked in answerOnly initially and can work on other targets or cleanup tools', () => {
  const guard = new LoopGuardState({
    targetQuotaGuard: true,
    maxUnchangedReadsPerTarget: 2,
    adaptiveSteering: false,
  });

  const agent = 'agent-non-latch';
  guard.beginTurn(agent, 1, false);

  const fileA = 'target_a.txt';
  const fileB = 'target_b.txt';

  // Read fileA 3 times (1 initial + 2 unchanged re-reads)
  for (let i = 1; i <= 3; i++) {
    guard.denyReason(agent, 'read_file', { path: fileA, v: i }, `ra-${i}`);
    guard.commitCall(agent, `ra-${i}`);
    guard.recordResult(agent, { callId: `ra-${i}`, result: { data: 'constant-content' } });
  }

  // Attempt 4 on fileA should be rejected
  const denial = guard.denyReason(agent, 'read_file', { path: fileA, v: 4 }, 'ra-4');
  assert.match(denial, /LOOP_GUARD_UNREFRESHED_READ/);

  // CRITICAL: Agent must NOT be locked in answerOnly!
  const state = guard.stateFor(agent);
  assert.equal(state.answerOnly, false, 'Target denial must be non-latching initially');

  // Agent can still read fileB
  assert.equal(guard.denyReason(agent, 'read_file', { path: fileB }, 'rb-1'), undefined);

  // Agent can still execute cleanup shell command
  assert.equal(guard.denyReason(agent, 'bash', { command: 'rm /tmp/lock' }, 'cleanup-1'), undefined);
});

test('Target denial escalation: repeated target denials escalate to answerOnly (#148)', () => {
  const guard = new LoopGuardState({
    targetQuotaGuard: true,
    maxUnchangedReadsPerTarget: 2,
    adaptiveSteering: false,
  });

  const agent = 'agent-escalate';
  guard.beginTurn(agent, 1, false);

  const fileA = 'target_escalate.txt';

  // Read fileA 3 times to exhaust unchanged reads
  for (let i = 1; i <= 3; i++) {
    guard.denyReason(agent, 'read_file', { path: fileA, v: i }, `r-${i}`);
    guard.commitCall(agent, `r-${i}`);
    guard.recordResult(agent, { callId: `r-${i}`, result: { text: 'same' } });
  }

  // Denial 1 (non-latching)
  const d1 = guard.denyReason(agent, 'read_file', { path: fileA, v: 4 }, 'r-4');
  assert.match(d1, /LOOP_GUARD_UNREFRESHED_READ/);
  assert.equal(guard.stateFor(agent).answerOnly, false);

  // Denial 2 (non-latching)
  const d2 = guard.denyReason(agent, 'read_file', { path: fileA, v: 5 }, 'r-5');
  assert.match(d2, /LOOP_GUARD_UNREFRESHED_READ/);
  assert.equal(guard.stateFor(agent).answerOnly, false);

  // Denial 3: Escalates to hard answerOnly! (#148)
  const d3 = guard.denyReason(agent, 'read_file', { path: fileA, v: 6 }, 'r-6');
  assert.match(d3, /escalating to text-only mode/);
  assert.equal(guard.stateFor(agent).answerOnly, true);
  assert.ok(guard.metrics.targetDenials >= 3);
});

test('per-target quotas are per-turn and not reset on interleaved tool calls (#152)', () => {
  const guard = new LoopGuardState({
    targetQuotaGuard: true,
    maxReadsPerTarget: 2,
    adaptiveSteering: false,
  });

  const agent = 'agent-interleaved';
  guard.beginTurn(agent, 1, false);

  const fileA = 'docA.txt';
  const fileB = 'docB.txt';

  // Read A - 1st read
  assert.equal(guard.denyReason(agent, 'read_file', { path: fileA }, 'ra-1'), undefined);
  guard.commitCall(agent, 'ra-1');
  guard.recordResult(agent, { callId: 'ra-1', result: { text: 'content A1' } });

  // Read B - 1st read
  assert.equal(guard.denyReason(agent, 'read_file', { path: fileB }, 'rb-1'), undefined);
  guard.commitCall(agent, 'rb-1');
  guard.recordResult(agent, { callId: 'rb-1', result: { text: 'content B1' } });

  // Read A - 2nd read
  assert.equal(guard.denyReason(agent, 'read_file', { path: fileA }, 'ra-2'), undefined);
  guard.commitCall(agent, 'ra-2');
  guard.recordResult(agent, { callId: 'ra-2', result: { text: 'content A2' } });

  // Read B - 2nd read
  assert.equal(guard.denyReason(agent, 'read_file', { path: fileB }, 'rb-2'), undefined);
  guard.commitCall(agent, 'rb-2');
  guard.recordResult(agent, { callId: 'rb-2', result: { text: 'content B2' } });

  // Read A - 3rd read: MUST BE DENIED because maxReadsPerTarget = 2 (#152)
  const denial = guard.denyReason(agent, 'read_file', { path: fileA }, 'ra-3');
  assert.ok(denial, '3rd read on fileA must be denied by maxReadsPerTarget quota');
  assert.match(denial, /LOOP_GUARD_TARGET_QUOTA/);
  assert.match(denial, /Read quota \(2\) exceeded for target "docA\.txt"/);
});

test('successful modification resets unchanged read counter for that target', () => {
  const guard = new LoopGuardState({
    targetQuotaGuard: true,
    maxUnchangedReadsPerTarget: 2,
    adaptiveSteering: false,
  });

  const agent = 'agent-edit-reset';
  guard.beginTurn(agent, 1, false);

  const file = 'code.py';

  // Read unchanged 3 times (initial + 2 unchanged re-reads)
  for (let i = 1; i <= 3; i++) {
    assert.equal(guard.denyReason(agent, 'read_file', { path: file, i }, `r-${i}`), undefined);
    guard.commitCall(agent, `r-${i}`);
    guard.recordResult(agent, { callId: `r-${i}`, result: { text: 'old-content' } });
  }

  // Now edit file successfully
  assert.equal(guard.denyReason(agent, 'edit_file', { path: file, newContent: 'new-content' }, 'e-1'), undefined);
  guard.commitCall(agent, 'e-1');
  guard.recordResult(agent, { callId: 'e-1', result: { success: true } });

  // Subsequent read on the modified file is allowed (verification read)
  assert.equal(guard.denyReason(agent, 'read_file', { path: file }, 'r-verify'), undefined);
  guard.commitCall(agent, 'r-verify');
  guard.recordResult(agent, { callId: 'r-verify', result: { text: 'new-content' } });
});

test('adaptive steering warns on first target quota violation before hard denial', () => {
  const guard = new LoopGuardState({
    targetQuotaGuard: true,
    maxUnchangedReadsPerTarget: 2,
    adaptiveSteering: true,
  });

  const agent = 'agent-target-steer';
  guard.beginTurn(agent, 1, false);

  const file = 'doc.md';

  // 3 reads (1 initial + 2 unchanged re-reads)
  for (let i = 1; i <= 3; i++) {
    guard.denyReason(agent, 'read_file', { path: file, slice: i }, `r-${i}`);
    guard.commitCall(agent, `r-${i}`);
    guard.recordResult(agent, { callId: `r-${i}`, result: { text: 'same' } });
  }

  // 4th read exceeds limit (2 re-reads allowed) and triggers steering warning
  const steerWarning = guard.denyReason(agent, 'read_file', { path: file, slice: 4 }, 'r-4');
  assert.ok(steerWarning);
  assert.match(steerWarning, /\[LOOP_GUARD_STEER\] Warning:/);
  assert.match(steerWarning, /Target has been repeatedly read without changes/);
  assert.equal(guard.metrics.steeredCount, 1);
  assert.equal(guard.stateFor(agent).answerOnly, false);

  // Subsequent uncorrected read triggers actual non-latching call denial
  const hardDenial = guard.denyReason(agent, 'read_file', { path: file, slice: 5 }, 'r-5');
  assert.match(hardDenial, /LOOP_GUARD_UNREFRESHED_READ/);
});

test('GUARD_PRESETS include valid target quota limits', () => {
  for (const [name, preset] of Object.entries(GUARD_PRESETS)) {
    assert.equal(preset.targetQuotaGuard, true, `${name} must enable targetQuotaGuard`);
    assert.ok(preset.maxUnchangedReadsPerTarget >= 2, `${name} maxUnchangedReadsPerTarget >= 2`);
    assert.ok(preset.maxReadsPerTarget >= 4, `${name} maxReadsPerTarget >= 4`);
    assert.ok(preset.maxEditsPerTarget >= 5, `${name} maxEditsPerTarget >= 5`);
    assert.ok(preset.maxTargetAttempts >= 8, `${name} maxTargetAttempts >= 8`);
  }
});

