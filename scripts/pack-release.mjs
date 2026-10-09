#!/usr/bin/env node
// Pack plugin tarball into external artifacts directory and generate sha256 checksum.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const packageName = pkg.name.replace(/^@/, '').replace('/', '-');
const expectedTarballName = `${packageName}-${version}.tgz`;

// Build client before packing
const buildRun = spawnSync(process.execPath, [path.join(root, 'scripts/build-client.mjs')], {
  cwd: root,
  stdio: 'inherit',
});
if (buildRun.status !== 0) {
  process.exit(buildRun.status || 1);
}

// Destination directory for persistent artifacts
const targetDir = path.resolve(
  process.env.DSH_ARTIFACTS_DIR || process.argv[2] || path.join(process.env.HOME || '/home/vadim', '.dsh', 'artifacts')
);
if (!existsSync(targetDir)) {
  mkdirSync(targetDir, { recursive: true });
}

// Pack into target directory
const packRun = spawnSync('npm', ['pack', `--pack-destination=${targetDir}`], {
  cwd: root,
  encoding: 'utf8',
});
if (packRun.status !== 0) {
  console.error(packRun.stderr || packRun.stdout);
  process.exit(packRun.status || 1);
}

const tarballPath = path.join(targetDir, expectedTarballName);
if (!existsSync(tarballPath)) {
  console.error(`Expected tarball not found at ${tarballPath}`);
  process.exit(1);
}

const tarballBytes = readFileSync(tarballPath);
const sha256 = createHash('sha256').update(tarballBytes).digest('hex');
const shaPath = `${tarballPath}.sha256`;
writeFileSync(shaPath, `${sha256}  ${expectedTarballName}\n`, 'utf8');

console.log(`Packaged: ${tarballPath}`);
console.log(`Size:     ${tarballBytes.length} bytes`);
console.log(`SHA256:   ${sha256}`);