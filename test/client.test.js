import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('client.js registers with ModuleLoader and defines exports properly without reference error', () => {
  const clientCode = fs.readFileSync(path.resolve(__dirname, '../lib/client.js'), 'utf8');

  let loadedModule = null;
  const mockModuleLoader = {
    load: (mod) => {
      loadedModule = mod;
    },
  };

  const context = vm.createContext({
    window: {
      __ModuleLoader__: mockModuleLoader,
    },
  });

  assert.doesNotThrow(() => {
    vm.runInContext(clientCode, context);
  });

  assert.ok(loadedModule, 'ModuleLoader.load should have been called');
  assert.equal(loadedModule.id, '@goodandready/dsh-agent-loop-guard');
  assert.equal(typeof loadedModule.factory, 'function');

  const mockRequire = (id) => {
    if (id === 'react') {
      return {
        createElement: () => ({}),
        useState: (init) => [init, () => {}],
        useEffect: () => {},
        useRef: () => ({ current: null }),
      };
    }
    throw new Error(`Unexpected require: ${id}`);
  };

  const factoryExports = loadedModule.factory(mockRequire);
  assert.ok(factoryExports, 'Factory should return exports object');
  assert.deepEqual(Array.from(factoryExports.inject), ['slots', 'settingsScope', 'locale']);
  assert.equal(typeof factoryExports.apply, 'function');
});