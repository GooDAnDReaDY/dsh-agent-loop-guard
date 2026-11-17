import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Config } from '../lib/index.js';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '..');

function extractTableKeys(markdown) {
  const matches = markdown.matchAll(/\|\s*`([a-zA-Z0-9]+)`\s*\|\s*`?[a-zA-Z0-9\[\]]+`?\s*\|/g);
  return new Set(Array.from(matches, (m) => m[1]));
}

test('docs consistency: all Config schema keys are documented across README.md, README.ru.md, README.zh.md', () => {
  const schemaKeys = Object.keys(Config.dict || {});
  assert.equal(schemaKeys.length, 28, 'Config schema must have exactly 28 keys');

  const files = ['README.md', 'README.ru.md', 'README.zh.md'];
  for (const file of files) {
    const fullPath = path.join(root, file);
    assert.ok(fs.existsSync(fullPath), `${file} must exist`);
    const content = fs.readFileSync(fullPath, 'utf8');
    const tableKeys = extractTableKeys(content);

    for (const key of schemaKeys) {
      assert.ok(
        tableKeys.has(key),
        `${file} configuration table is missing key: ${key}`
      );
    }
  }
});

test('docs consistency: stale stop words and deprecated slots are cleaned from docs', () => {
  const files = ['README.md', 'README.ru.md', 'README.zh.md'];
  for (const file of files) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(content, /`ответь`/, `${file} must not contain stale stop word ответь`);
    assert.doesNotMatch(content, /`петля`/, `${file} must not contain stale stop word петля`);
    assert.doesNotMatch(content, /settings\.plugin\.item,\s*order\s*95/, `${file} must not contain stale slot settings.plugin.item`);
  }
});
