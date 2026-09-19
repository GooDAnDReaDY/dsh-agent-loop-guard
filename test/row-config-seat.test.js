// Guard for the Plugins-page settings seat (slot `plugins.row.config`).
//
// The row seat is what the current DSH core renders: the Plugins page opens it
// from a row's "configure" control, keyed `<package name>#<row id>` exactly as
// cordis.patch.yml declares the row. This test pins the key, the seat list
// (row seat first, older seats kept as fallbacks) and the bare page render.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PKG = '@goodandready/dsh-agent-loop-guard';

function loadClient() {
  const clientCode = fs.readFileSync(path.join(root, 'lib/client.js'), 'utf8');
  let loadedModule = null;
  const context = vm.createContext({
    window: { __ModuleLoader__: { load: (mod) => { loadedModule = mod; } } },
  });
  vm.runInContext(clientCode, context);
  assert.ok(loadedModule, 'client.js must register with the kernel module loader');
  return loadedModule;
}

function reactStub() {
  const hook = (init) => [typeof init === 'function' ? init() : init, () => {}];
  return {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: hook,
    useEffect: () => {},
    useRef: (init) => ({ current: init === undefined ? null : init }),
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    Fragment: Symbol('Fragment'),
  };
}

function boot() {
  const record = loadClient();
  const exports = record.factory((id) => {
    if (id === 'react') return reactStub();
    throw new Error(`Unexpected require: ${id}`);
  });

  const registered = [];
  const injected = [];
  const ctx = {
    locale: {
      register: () => {},
      subscribe: () => () => {},
      getLocale: () => 'en',
    },
    settingsScope: { bind: () => ({ get: async () => ({}), set: async () => {} }) },
    slots: {
      inject: (name, cb) => { injected.push(name); return cb(); },
      register: (opts, comp) => { registered.push({ opts, comp }); return () => {}; },
    },
  };
  assert.doesNotThrow(() => exports.apply(ctx));
  return { registered, injected };
}

function rowIdFromPatch() {
  const patch = fs.readFileSync(path.join(root, 'cordis.patch.yml'), 'utf8');
  const ids = [...patch.matchAll(/^\s*-\s*id:\s*['"]?([^'"\s]+)['"]?\s*$/gm)].map((m) => m[1]);
  assert.equal(ids.length, 1, 'cordis.patch.yml must declare exactly one row');
  return ids[0];
}

function walk(node, visit) {
  if (node === null || node === undefined) return;
  if (typeof node !== 'object') { visit(node); return; }
  visit(node);
  for (const child of node.children || []) walk(child, visit);
}

// The slot component is a function component; expand those so the assertions
// see the host elements the page actually receives.
function expand(node) {
  if (node === null || node === undefined || typeof node !== 'object') return node;
  if (typeof node.type === 'function') return expand(node.type(node.props));
  return { ...node, children: (node.children || []).map((child) => expand(child)) };
}

test('row seat key is the package name and the cordis.patch.yml row id', () => {
  const rowId = rowIdFromPatch();
  assert.equal(rowId, PKG, 'row id must stay the package name');

  const source = fs.readFileSync(path.join(root, 'lib/client.js'), 'utf8');
  assert.ok(source.includes(`const PKG = '${PKG}'`), 'PKG constant must name the package');
  assert.ok(source.includes(`const ROW_ID = '${rowId}'`), 'ROW_ID must match cordis.patch.yml');
  assert.ok(source.includes('const ROW_CONFIG_KEY = PKG + \'#\' + ROW_ID'), 'key must be PKG#ROW_ID');

  const { registered } = boot();
  const seat = registered.find((r) => r.opts.name === 'plugins.row.config');
  assert.ok(seat, 'apply must register the plugins.row.config seat');
  assert.equal(seat.opts.key, `${PKG}#${rowId}`, 'row seat key must be <package name>#<row id>');
});

test('seat composition: list seat plus the previous seats kept as fallbacks', () => {
  const { registered, injected } = boot();
  const names = registered.map((r) => r.opts.name);
  assert.deepEqual(names, ['plugins.row.config', 'plugins.item', 'settings.plugin.item']);
  assert.deepEqual(injected, ['plugins.row.config', 'plugins.item', 'settings.plugin.item']);
  // The list seat is the one the Plugins page renders as the plugin's own page.
  assert.equal(registered[1].opts.id, '@goodandready/dsh-agent-loop-guard');
  assert.equal(typeof registered[1].opts.label, 'function');
  assert.equal(registered[1].opts.label(), 'Agent Loop Guard', 'the label is a static string');
  assert.equal(registered[2].opts.key, PKG, 'the settings.plugin.item seat key is unchanged');
});

test('row seat renders a summary one-liner and the form bare for the page', () => {
  const { registered } = boot();
  const seat = registered.find((r) => r.opts.name === 'plugins.row.config');

  const summary = expand(seat.comp({ view: 'summary' }));
  const summaryText = [];
  walk(summary, (node) => { if (typeof node === 'string') summaryText.push(node); });
  assert.ok(summaryText.join(' ').includes('loop limits'), 'summary must describe the plugin');

  const page = expand(seat.comp({ view: 'page', ctx: { settingsScope: { bind: () => null } } }));
  const classes = [];
  walk(page, (node) => { if (typeof node === 'object' && node.props && node.props.className) classes.push(node.props.className); });
  assert.ok(classes.includes('alg-page'), 'page view renders bare under .alg-page');
  assert.ok(!classes.includes('alg-card'), 'page view must not wrap the form in its own card');
});
