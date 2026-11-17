import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '..');
const srcDir = path.join(root, 'src', 'client');
const clientBundlePath = path.join(root, 'lib', 'client.js');

test('bundle parity: committed lib/client.js exactly matches concatenated src/client/* fragments', () => {
  assert.ok(fs.existsSync(srcDir), 'src/client directory must exist');
  assert.ok(fs.existsSync(clientBundlePath), 'lib/client.js must exist');

  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.js')).sort();
  assert.ok(files.length > 0, 'At least one fragment in src/client must exist');

  let expected = '';
  for (const f of files) {
    const fragment = fs.readFileSync(path.join(srcDir, f), 'utf8');
    expected += fragment;
    if (!expected.endsWith('\n')) expected += '\n';
  }

  const actual = fs.readFileSync(clientBundlePath, 'utf8');
  assert.equal(
    actual,
    expected,
    'lib/client.js is out of sync with src/client/*. Run npm run build:client to synchronize.'
  );

  const lineCount = actual.split('\n').length;
  assert.ok(lineCount < 600, `lib/client.js must stay under 600 lines budget (current: ${lineCount})`);
});
