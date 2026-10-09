import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cleanScript = path.join(here, '..', 'scripts', 'clean-pack.mjs');
const packScript = path.join(here, '..', 'scripts', 'pack-release.mjs');

test('clean-pack removes scratch junk without deleting release tarballs (#101)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-clean-pack-test-'));
  try {
    const scratchTgz = path.join(tmpDir, 'test-pack.scratch.tgz');
    const releaseTgz = path.join(tmpDir, 'goodandready-dsh-agent-loop-guard-0.2.21.tgz');
    const junkLog = path.join(tmpDir, 'npm-debug.log');
    const normalFile = path.join(tmpDir, 'package.json');

    fs.writeFileSync(scratchTgz, 'scratch');
    fs.writeFileSync(releaseTgz, 'release tarball');
    fs.writeFileSync(junkLog, 'log');
    fs.writeFileSync(normalFile, '{}');

    const run = spawnSync(process.execPath, [cleanScript, tmpDir], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr || run.stdout);

    // Scratch and junk removed
    assert.equal(fs.existsSync(scratchTgz), false);
    assert.equal(fs.existsSync(junkLog), false);

    // Release tarball and normal files preserved
    assert.equal(fs.existsSync(releaseTgz), true);
    assert.equal(fs.existsSync(normalFile), true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('pack-release packages to specified artifacts directory and generates valid sha256 (#101)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-pack-release-test-'));
  try {
    const run = spawnSync(process.execPath, [packScript, tmpDir], {
      encoding: 'utf8',
      cwd: path.join(here, '..'),
    });
    assert.equal(run.status, 0, run.stderr || run.stdout);

    const entries = fs.readdirSync(tmpDir);
    const tgzFile = entries.find((f) => f.endsWith('.tgz'));
    const shaFile = entries.find((f) => f.endsWith('.sha256'));

    assert.ok(tgzFile, 'Expected .tgz artifact to be created');
    assert.ok(shaFile, 'Expected .sha256 checksum to be created');

    const shaContent = fs.readFileSync(path.join(tmpDir, shaFile), 'utf8');
    assert.match(shaContent, /^[a-f0-9]{64}\s+/);
    assert.ok(shaContent.includes(tgzFile));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});