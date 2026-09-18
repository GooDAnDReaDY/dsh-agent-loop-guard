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

test('apply registers settings.plugin.item via slots.inject when available', () => {
  const clientCode = fs.readFileSync(path.resolve(__dirname, '../lib/client.js'), 'utf8');

  let loadedModule = null;
  const context = vm.createContext({
    window: {
      __ModuleLoader__: { load: (mod) => { loadedModule = mod; } },
    },
  });
  vm.runInContext(clientCode, context);

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

  let injectedSlot = null;
  let injectCallback = null;
  let registeredSlot = null;

  const mockCtx = {
    locale: { register: () => {} },
    slots: {
      inject: (name, cb) => {
        injectedSlot = name;
        injectCallback = cb;
      },
      register: (opts, comp) => {
        registeredSlot = opts;
      },
    },
  };

  assert.doesNotThrow(() => {
    factoryExports.apply(mockCtx);
  });

  assert.equal(injectedSlot, 'settings.plugin.item', 'should subscribe via slots.inject');
  assert.equal(registeredSlot, null, 'should not register synchronously before inject callback fires');

  // Trigger inject callback
  injectCallback();
  assert.ok(registeredSlot, 'should register when inject callback runs');
  assert.equal(registeredSlot.name, 'settings.plugin.item');
  assert.equal(registeredSlot.key, '@goodandready/dsh-agent-loop-guard');
  assert.equal(registeredSlot.locale, '@goodandready/dsh-agent-loop-guard');
});

test('apply safely handles direct slot registration if slots.inject throws or is unavailable', () => {
  const clientCode = fs.readFileSync(path.resolve(__dirname, '../lib/client.js'), 'utf8');

  let loadedModule = null;
  const context = vm.createContext({
    window: {
      __ModuleLoader__: { load: (mod) => { loadedModule = mod; } },
    },
  });
  vm.runInContext(clientCode, context);

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

  // Scenario 1: slots.inject throws
  let directRegistered = null;
  const mockCtx1 = {
    slots: {
      inject: () => { throw new Error('inject failed'); },
      register: (opts) => { directRegistered = opts; },
    },
  };
  assert.doesNotThrow(() => {
    factoryExports.apply(mockCtx1);
  });
  assert.ok(directRegistered);

  // Scenario 2: slots.register throws "slot is not declared"
  const mockCtx2 = {
    slots: {
      register: () => { throw new Error('slot "settings.plugin.item" is not declared'); },
    },
  };
  assert.doesNotThrow(() => {
    factoryExports.apply(mockCtx2);
  });
});

test('card resolves locale from _ctx.locale.getLocale and responds to subscribe', () => {
  const clientCode = fs.readFileSync(path.resolve(__dirname, '../lib/client.js'), 'utf8');
  let loadedModule = null;
  const context = vm.createContext({
    window: {
      __ModuleLoader__: { load: (mod) => { loadedModule = mod; } },
      navigator: { language: 'en-US' },
    },
    navigator: { language: 'en-US' },
  });
  vm.runInContext(clientCode, context);

  let capturedComponent = null;
  const stateHooks = [];
  const effectHooks = [];

  const mockReact = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (init) => {
      const idx = stateHooks.length;
      stateHooks.push(init);
      return [init, (val) => { stateHooks[idx] = typeof val === 'function' ? val(stateHooks[idx]) : val; }];
    },
    useEffect: (fn, deps) => {
      effectHooks.push({ fn, deps });
    },
    useRef: () => ({ current: null }),
  };

  const mockRequire = (id) => {
    if (id === 'react') return mockReact;
    throw new Error(`Unexpected require: ${id}`);
  };

  const factoryExports = loadedModule.factory(mockRequire);

  let currentLocale = 'zh-CN';
  let subscriber = null;
  const mockCtx = {
    locale: {
      getLocale: () => ({ locale: currentLocale }),
      subscribe: (fn) => { subscriber = fn; return () => {}; },
      register: () => {},
    },
    slots: {
      inject: (name, cb) => cb(),
      register: (opts, comp) => {
        capturedComponent = comp;
      },
    },
  };

  factoryExports.apply(mockCtx);
  assert.ok(capturedComponent, 'Component should be registered');

  // Render component and execute functional component to trigger hooks
  const element = capturedComponent({ ctx: mockCtx });
  assert.ok(element && typeof element.type === 'function');
  element.type(element.props);

  // Execute registered effects
  for (const hook of effectHooks) {
    hook.fn();
  }

  // Verify that subscriber was registered
  assert.ok(subscriber, 'locale.subscribe should have been registered');
});

test('locale is registered inside ctx.effect and cleanup function is handled on re-apply', () => {
  const clientCode = fs.readFileSync(path.resolve(__dirname, '../lib/client.js'), 'utf8');
  let loadedModule = null;
  const context = vm.createContext({
    window: {
      __ModuleLoader__: { load: (mod) => { loadedModule = mod; } },
    },
  });
  vm.runInContext(clientCode, context);

  const mockRequire = () => ({
    createElement: () => ({}),
    useState: (init) => [init, () => {}],
    useEffect: () => {},
    useRef: () => ({ current: null }),
  });

  const factoryExports = loadedModule.factory(mockRequire);

  const registeredLocales = new Map();
  const effects = [];

  const mockCtx = {
    effect: (fn, label) => {
      const cleanup = fn();
      effects.push({ cleanup, label });
    },
    locale: {
      register: (ns, dicts) => {
        if (registeredLocales.has(ns)) {
          throw new Error(`Locale namespace "${ns}" already registered`);
        }
        registeredLocales.set(ns, dicts);
        return () => {
          registeredLocales.delete(ns);
        };
      },
    },
    slots: {
      inject: () => {},
      register: () => {},
    },
  };

  // First apply
  assert.doesNotThrow(() => {
    factoryExports.apply(mockCtx);
  });
  assert.equal(effects.length, 1);
  assert.equal(effects[0].label, 'dsh-agent-loop-guard: locale');
  assert.equal(registeredLocales.has('@goodandready/dsh-agent-loop-guard'), true);

  // Simulate HMR/re-apply: dispose effect then apply again
  effects[0].cleanup();
  assert.equal(registeredLocales.has('@goodandready/dsh-agent-loop-guard'), false);

  // Second apply succeeds without error
  assert.doesNotThrow(() => {
    factoryExports.apply(mockCtx);
  });
  assert.equal(registeredLocales.has('@goodandready/dsh-agent-loop-guard'), true);
});