#!/usr/bin/env node
// Remove scratch and temporary junk without touching release artifacts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetRoot = path.resolve(process.env.CLEAN_PACK_DIR || process.argv[2] || defaultRoot);

const junkNames = new Set([
  '.DS_Store',
  'Thumbs.db',
  'npm-debug.log',
  'yarn-error.log',
]);
const junkSuffixes = ['.tmp', '.bak', '.scratch.tgz', '-test.tgz'];

export function cleanPack(root = targetRoot) {
  let removed = 0;

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.worktrees') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      const lower = entry.name.toLowerCase();
      const bad = junkNames.has(entry.name) || junkSuffixes.some((suffix) => lower.endsWith(suffix));
      if (!bad) continue;
      try {
        fs.unlinkSync(full);
        removed += 1;
        console.error('removed', path.relative(root, full));
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
      }
    }
  }

  walk(root);
  return removed;
}

const isDirectRun = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const count = cleanPack(targetRoot);
  console.error(`clean-pack: removed ${count} scratch/junk file(s)`);
}