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
  assert.deepEqual(Array.from(factoryExports.inject), ['slots', 'configForms', 'locale']);
  assert.equal(typeof factoryExports.apply, 'function');
});

test('apply registers slots via slots.inject when available (#116)', () => {
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

  const injectedSlots = [];
  const injectCallbacks = [];
  const registeredSlots = [];

  const mockCtx = {
    locale: { register: () => {} },
    slots: {
      inject: (name, cb) => {
        injectedSlots.push(name);
        injectCallbacks.push(cb);
      },
      register: (opts, comp) => {
        registeredSlots.push(opts);
      },
    },
  };

  assert.doesNotThrow(() => {
    factoryExports.apply(mockCtx);
  });

  assert.deepEqual(injectedSlots, ['plugins.row.config', 'plugins.item'], 'should subscribe plugins seats via slots.inject');
  assert.equal(registeredSlots.length, 0, 'should not register synchronously before inject callback fires');

  // Trigger inject callbacks
  for (const cb of injectCallbacks) {
    cb();
  }
  assert.equal(registeredSlots.length, 2, 'should register both slots when inject callbacks run');
  assert.equal(registeredSlots[0].name, 'plugins.row.config');
  assert.equal(registeredSlots[1].name, 'plugins.item');
  assert.equal(registeredSlots[1].id, '@goodandready/dsh-agent-loop-guard');
  assert.equal(registeredSlots[1].locale, '@goodandready/dsh-agent-loop-guard');
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
      getLocale: () => ({ active: currentLocale, locales: [{ id: currentLocale }] }),
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
  const rendered = element.type(element.props);
  // Verify that active: zh-CN resolves Chinese strings despite navigator.language =  en-US
  const headerBtn = rendered.children[0];
  const titleContainer = headerBtn.children[0];
  const subElem = titleContainer.children[1];
  assert.equal(subElem.children[0], '工具调用与助手输出防死循环熔断限制');

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

test('client.js does not hardcode version strings and renders honest initial badge', () => {
  const clientCode = fs.readFileSync(path.resolve(__dirname, '../lib/client.js'), 'utf8');
  assert.equal(clientCode.includes("'0.2.5'"), false, 'client.js must not contain hardcoded 0.2.5 version string');
  assert.equal(clientCode.includes('"0.2.5"'), false, 'client.js must not contain hardcoded "0.2.5" version string');

  let loadedModule = null;
  const context = vm.createContext({
    window: {
      __ModuleLoader__: { load: (mod) => { loadedModule = mod; } },
    },
  });
  vm.runInContext(clientCode, context);

  let capturedComponent = null;
  const mockRequire = () => ({
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (init) => [init, () => {}],
    useEffect: () => {},
    useRef: () => ({ current: null }),
  });

  const factoryExports = loadedModule.factory(mockRequire);
  const mockCtx = {
    slots: {
      inject: (name, cb) => cb(),
      register: (opts, comp) => { capturedComponent = comp; },
    },
  };

  factoryExports.apply(mockCtx);
  const element = capturedComponent({ ctx: mockCtx });
  const rendered = element.type(element.props);
  assert.ok(rendered);
});

test('field helper associates label with input using htmlFor and id', () => {
  const clientCode = fs.readFileSync(path.resolve(__dirname, '../lib/client.js'), 'utf8');
  let loadedModule = null;
  const context = vm.createContext({
    window: {
      __ModuleLoader__: { load: (mod) => { loadedModule = mod; } },
    },
  });
  vm.runInContext(clientCode, context);

  let capturedComponent = null;
  const createdElements = [];
  let stateIndex = 0;
  const mockReact = {
    createElement: (type, props, ...children) => {
      const el = { type, props: props || {}, children };
      createdElements.push(el);
      return el;
    },
    isValidElement: (el) => el && typeof el === 'object' && 'type' in el && 'props' in el,
    cloneElement: (el, newProps) => {
      const cloned = { ...el, props: { ...el.props, ...newProps } };
      createdElements.push(cloned);
      return cloned;
    },
    useState: (init) => {
      // First hook is expanded -> set to true
      const val = stateIndex === 0 ? true : init;
      stateIndex += 1;
      return [val, () => {}];
    },
    useEffect: () => {},
    useRef: () => ({ current: null }),
  };

  const factoryExports = loadedModule.factory(() => mockReact);
  const mockCtx = {
    slots: {
      inject: (name, cb) => cb(),
      register: (opts, comp) => { capturedComponent = comp; },
    },
  };

  factoryExports.apply(mockCtx);
  const element = capturedComponent({ ctx: mockCtx });
  element.type(element.props);

  const labels = createdElements.filter((el) => el.type === 'label' && el.props.htmlFor);
  const inputs = createdElements.filter((el) => el.type === 'input' && el.props.id);

  assert.ok(labels.length > 0, 'Form should render labels with htmlFor');
  assert.ok(inputs.length > 0, 'Form should render inputs with id');

  for (const label of labels) {
    const matchingInput = inputs.find((inp) => inp.props.id === label.props.htmlFor);
    assert.ok(matchingInput, `Label htmlFor="${label.props.htmlFor}" must match an input with that id`);
  }
});

test('client telemetry and update state handle network failures cleanly', async () => {
  const clientCode = fs.readFileSync(path.resolve(__dirname, '../lib/client.js'), 'utf8');
  let loadedModule = null;
  const context = vm.createContext({
    window: {
      __ModuleLoader__: { load: (mod) => { loadedModule = mod; } },
    },
    fetch: async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    }),
  });
  vm.runInContext(clientCode, context);

  let capturedComponent = null;
  const states = new Map();
  let stateId = 0;
  const mockReact = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    isValidElement: (el) => el && typeof el === 'object' && 'type' in el && 'props' in el,
    cloneElement: (el, newProps) => ({ ...el, props: { ...el.props, ...newProps } }),
    useState: (init) => {
      const id = stateId++;
      const val = id === 0 ? true : init;
      if (!states.has(id)) states.set(id, val);
      return [states.get(id), (newVal) => {
        const resolved = typeof newVal === 'function' ? newVal(states.get(id)) : newVal;
        states.set(id, resolved);
      }];
    },
    useEffect: (fn, deps) => {
      fn();
    },
    useRef: () => ({ current: null }),
  };

  const factoryExports = loadedModule.factory(() => mockReact);
  const mockCtx = {
    slots: {
      inject: (name, cb) => cb(),
      register: (opts, comp) => { capturedComponent = comp; },
    },
  };

  factoryExports.apply(mockCtx);
  const element = capturedComponent({ ctx: mockCtx });
  element.type(element.props);

  // Wait a tick for async effects to reject/settle
  await new Promise((r) => setTimeout(r, 50));

  // Verify telemetry error was set in state
  const values = Array.from(states.values());
  const telemetryState = values.find((v) => v && typeof v === 'object' && 'error' in v && 'totalViolations' in v);
  assert.ok(telemetryState, 'Telemetry state should exist');
  assert.equal(telemetryState.error, 'Failed to load telemetry');
});

test('card markup aligns with DSH standard CSS classes, primitives chevron and lacks emoji', () => {
  const clientCode = fs.readFileSync(path.resolve(__dirname, '../lib/client.js'), 'utf8');
  assert.equal(clientCode.includes("'🛑 '"), false, 'client.js should not contain 🛑 emoji in title');
  assert.equal(clientCode.includes("'📊 '"), false, 'client.js should not contain 📊 emoji in telemetry title');
  assert.ok(clientCode.includes('.alg-card'), 'client.js should define .alg-card style');
  assert.ok(clientCode.includes('.alg-chevron'), 'client.js should define .alg-chevron style');

  let loadedModule = null;
  const context = vm.createContext({
    window: {
      __ModuleLoader__: { load: (mod) => { loadedModule = mod; } },
    },
  });
  vm.runInContext(clientCode, context);

  let capturedComponent = null;
  const createdElements = [];
  const mockReact = {
    createElement: (type, props, ...children) => {
      const el = { type, props: props || {}, children };
      createdElements.push(el);
      return el;
    },
    isValidElement: (el) => el && typeof el === 'object' && 'type' in el && 'props' in el,
    cloneElement: (el, newProps) => {
      const cloned = { ...el, props: { ...el.props, ...newProps } };
      createdElements.push(cloned);
      return cloned;
    },
    useState: (init) => [init, () => {}],
    useEffect: () => {},
    useRef: () => ({ current: null }),
  };

  const factoryExports = loadedModule.factory(() => mockReact);
  const mockCtx = {
    slots: {
      inject: (name, cb) => cb(),
      register: (opts, comp) => { capturedComponent = comp; },
    },
  };

  factoryExports.apply(mockCtx);
  const element = capturedComponent({ ctx: mockCtx });
  element.type(element.props);

  const cardElement = createdElements.find((el) => el.type === 'li' && el.props.className === 'alg-card');
  assert.ok(cardElement, 'Plugin card must render with alg-card class');

  const headerBtn = createdElements.find((el) => el.type === 'button' && el.props.className === 'alg-header-btn');
  assert.ok(headerBtn, 'Header button must render with alg-header-btn class');

  const chevron = createdElements.find((el) => el.props && typeof el.props.className === 'string' && el.props.className.includes('alg-chevron'));
  assert.ok(chevron, 'Chevron icon must render with alg-chevron class');
});

test('bare mode activates updater and telemetry effects immediately without header click', async () => {
  const clientCode = fs.readFileSync(path.resolve(__dirname, '../lib/client.js'), 'utf8');
  let loadedModule = null;
  const fetchedUrls = [];
  const context = vm.createContext({
    window: {
      __ModuleLoader__: { load: (mod) => { loadedModule = mod; } },
    },
    fetch: async (url) => {
      fetchedUrls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({ currentVersion: '0.2.13', latestVersion: '0.2.13', updateAvailable: false, totalViolations: 0 }),
      };
    },
  });
  vm.runInContext(clientCode, context);

  let capturedComponent = null;
  const mockReact = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    isValidElement: () => false,
    cloneElement: (el) => el,
    useState: (init) => [init, () => {}], // expanded starts false
    useEffect: (fn) => { fn(); },
    useRef: () => ({ current: null }),
  };

  const factoryExports = loadedModule.factory(() => mockReact);
  const mockCtx = {
    slots: {
      inject: (name, cb) => cb(),
      register: (opts, comp) => {
        if (opts.name === 'plugins.item') capturedComponent = comp;
      },
    },
  };

  factoryExports.apply(mockCtx);
  assert.ok(capturedComponent, 'plugins.item component should be registered');

  const element = capturedComponent({ ctx: mockCtx, view: 'page' });
  const pluginCardElement = typeof element.type === 'function' ? element.type(element.props) : element;
  if (typeof pluginCardElement?.type === 'function') {
    pluginCardElement.type(pluginCardElement.props);
  }

  await new Promise((r) => setTimeout(r, 20));

  assert.ok(fetchedUrls.some((u) => u.includes('/update')), 'Update endpoint must be fetched in bare mode');
  assert.ok(fetchedUrls.some((u) => u.includes('/telemetry')), 'Telemetry endpoint must be fetched in bare mode');
});
test('card reads settings from ConfigForm.getSnapshot, unpacks snap.value, and responds to subscribe', () => {
  const clientCode = fs.readFileSync(path.resolve(__dirname, '../lib/client.js'), 'utf8');
  let loadedModule = null;
  const context = vm.createContext({
    window: { __ModuleLoader__: { load: (mod) => { loadedModule = mod; } } },
  });
  vm.runInContext(clientCode, context);

  let capturedComponent = null;
  const stateMap = new Map();
  let stateIdx = 0;
  const effects = [];

  const mockReact = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    isValidElement: () => false,
    useState: (init) => {
      const idx = stateIdx++;
      if (!stateMap.has(idx)) stateMap.set(idx, init);
      return [stateMap.get(idx), (val) => {
        const next = typeof val === 'function' ? val(stateMap.get(idx)) : val;
        stateMap.set(idx, next);
      }];
    },
    useEffect: (fn, deps) => { effects.push(fn); },
    useRef: () => ({ current: null }),
  };

  const factory = loadedModule.factory(() => mockReact);
  let formSubscriber = null;
  let currentSnapshot = {
    status: 'ready',
    value: { maxToolAttemptsPerTurn: 42, strictTools: ['custom_tool'] },
  };

  const mockScope = {
    getSnapshot: () => currentSnapshot,
    subscribe: (cb) => { formSubscriber = cb; return () => {}; },
  };

  const mockCtx = {
    configForms: {
      get: (ns) => (ns === '@goodandready/dsh-agent-loop-guard' ? mockScope : null),
    },
    slots: {
      inject: (name, cb) => cb(),
      register: (opts, comp) => { capturedComponent = comp; },
    },
  };

  factory.apply(mockCtx);
  assert.ok(capturedComponent, 'Component should be registered');

  const element = capturedComponent({ ctx: mockCtx });
  element.type(element.props);

  for (const fn of effects) {
    fn();
  }

  const values = Array.from(stateMap.values());
  const draftState = values.find((v) => v && typeof v === 'object' && v.maxToolAttemptsPerTurn === 42);
  assert.ok(draftState, 'Draft should unpack stored maxToolAttemptsPerTurn from snap.value');
  assert.equal(draftState.strictToolsText, 'custom_tool');
  assert.ok(formSubscriber, 'Form subscriber should be attached');
});

test('updater renders plugins page hint in desktop mode and update button in web profile', () => {
  const clientCode = fs.readFileSync(path.resolve(__dirname, '../lib/client.js'), 'utf8');

  function renderWithUpdateState(customUpdateState) {
    let loadedModule = null;
    const context = vm.createContext({
      window: {
        __ModuleLoader__: { load: (mod) => { loadedModule = mod; } },
      },
    });
    vm.runInContext(clientCode, context);

    let capturedComponent = null;
    const createdElements = [];
    let stateIdx = 0;
    const mockReact = {
      createElement: (type, props, ...children) => {
        const el = { type, props: props || {}, children };
        createdElements.push(el);
        return el;
      },
      isValidElement: (el) => el && typeof el === 'object' && 'type' in el && 'props' in el,
      cloneElement: (el, newProps) => {
        const cloned = { ...el, props: { ...el.props, ...newProps } };
        createdElements.push(cloned);
        return cloned;
      },
      useState: (init) => {
        const idx = stateIdx++;
        if (idx === 0) return [true, () => {}];
        if (idx === 5) return [customUpdateState, () => {}];
        return [init, () => {}];
      },
      useEffect: () => {},
      useRef: () => ({ current: null }),
    };

    const factoryExports = loadedModule.factory(() => mockReact);
    const mockCtx = {
      slots: {
        inject: (name, cb) => cb(),
        register: (opts, comp) => { capturedComponent = comp; },
      },
    };
    factoryExports.apply(mockCtx);
    const element = capturedComponent({ ctx: mockCtx });
    element.type(element.props);
    return createdElements;
  }

  const desktopEls = renderWithUpdateState({
    checking: false,
    updateAvailable: true,
    currentVersion: '0.2.22',
    latestVersion: '0.2.23',
    updating: false,
    notice: '',
    error: '',
    canAutoUpdate: false,
    isDesktop: true,
  });
  const desktopHint = desktopEls.find((el) => el.props?.className === 'alg-updater-hint');
  const desktopBtn = desktopEls.find((el) => el.props?.className === 'alg-btn-updater');
  assert.ok(desktopHint, 'Desktop mode should render alg-updater-hint');
  assert.equal(desktopBtn, undefined, 'Desktop mode should not render alg-btn-updater');

  const webEls = renderWithUpdateState({
    checking: false,
    updateAvailable: true,
    currentVersion: '0.2.22',
    latestVersion: '0.2.23',
    updating: false,
    notice: '',
    error: '',
    canAutoUpdate: true,
    isDesktop: false,
  });
  const webHint = webEls.find((el) => el.props?.className === 'alg-updater-hint');
  const webBtn = webEls.find((el) => el.props?.className === 'alg-btn-updater');
  assert.equal(webHint, undefined, 'Web profile should not render alg-updater-hint');
  assert.ok(webBtn, 'Web profile should render alg-btn-updater');
});

test('client modularization: lib/client.js is synchronized with src/client fragments and under 600 lines', () => {
  const srcDir = path.resolve(__dirname, '../src/client');
  const clientPath = path.resolve(__dirname, '../lib/client.js');

  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith('.js')).sort();
  assert.ok(files.length >= 5, 'Should have at least 5 client module fragments');

  let expected = '';
  for (const f of files) {
    const part = fs.readFileSync(path.join(srcDir, f), 'utf8');
    const partLines = part.split('\n').length;
    assert.ok(partLines <= 350, `Fragment ${f} exceeds 350 lines (${partLines})`);
    expected += part;
    if (!expected.endsWith('\n')) expected += '\n';
  }

  const actual = fs.readFileSync(clientPath, 'utf8');
  assert.equal(actual, expected, 'lib/client.js must match concatenated src/client fragments');

  const totalLines = actual.split('\n').length;
  assert.ok(totalLines <= 600, `lib/client.js must not exceed 600 lines (current: ${totalLines})`);
});
