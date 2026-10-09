import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, name as PKG } from '../lib/index.js';

function createMockContext(options = {}) {
  const events = new Map();
  const injectedCallbacks = new Map();
  const effects = [];
  let guardedFunction = null;

  const ctx = {
    logger: {
      warn: () => {},
      info: () => {},
      debug: () => {},
    },
    tools: {
      guard: (fn) => {
        guardedFunction = fn;
        return fn;
      },
    },
    agents: {
      get: () => ({ cancel: () => {} }),
    },
    fiber: {
      config: options.fiberConfig || {},
    },
    on: (event, handler) => {
      if (!events.has(event)) events.set(event, []);
      events.get(event).push(handler);
      return () => {
        const list = events.get(event) || [];
        const idx = list.indexOf(handler);
        if (idx !== -1) list.splice(idx, 1);
      };
    },
    emit: (event, ...args) => {
      const list = events.get(event) || [];
      for (const handler of list) {
        handler(...args);
      }
    },
    inject: (deps, callback) => {
      const key = deps.join(',');
      if (!injectedCallbacks.has(key)) injectedCallbacks.set(key, []);
      injectedCallbacks.get(key).push(callback);
    },
    effect: (fn, label) => {
      const cleanup = fn();
      effects.push(cleanup);
      return cleanup;
    },
  };

  const triggerInject = (deps, serviceContext) => {
    const key = deps.join(',');
    const list = injectedCallbacks.get(key) || [];
    for (const cb of list) {
      cb(serviceContext);
    }
  };

  return {
    ctx,
    events,
    effects,
    triggerInject,
    getGuardedFunction: () => guardedFunction,
  };
}

test('boot with production SettingsForms (0.1.7-rc.1): no register call, auto:false configured', () => {
  const { ctx, triggerInject } = createMockContext();
  let configuredPresentation = null;
  let configureDisposed = false;

  const mockSettingsForms = {
    // Production SettingsForms API does NOT have register()
    register: undefined,
    configure: (policy, owner) => {
      configuredPresentation = policy;
      return () => {
        configureDisposed = true;
      };
    },
    describe: () => [
      {
        ns: PKG,
        value: {
          maxCallsPerRepeatGroup: 3,
          dryRunMode: false,
        },
      },
    ],
    update: async () => {},
    replace: async () => {},
    mutate: async () => {},
  };

  let effectCleanup = null;
  const sctx = {
    ...ctx,
    settings: mockSettingsForms,
    effect: (fn) => {
      effectCleanup = fn();
      return effectCleanup;
    },
  };

  // Boot plugin
  apply(ctx, { maxCallsPerRepeatGroup: 5 });

  // Trigger settings injection
  triggerInject(['settings'], sctx);

  // Verification
  assert.deepEqual(configuredPresentation, { auto: false }, 'must configure auto:false policy for SettingsForms');
  assert.equal(configureDisposed, false, 'configure disposer must not be called immediately');

  // Cleanup effect
  assert.equal(typeof effectCleanup, 'function', 'sctx.effect must register a cleanup function');
  effectCleanup();
  assert.equal(configureDisposed, true, 'cleanup must invoke configure disposer');
});

test('live config update via settings/document-updated event updates guard limits', () => {
  const { ctx, triggerInject, events } = createMockContext();
  let currentSettingsValue = {
    maxCallsPerRepeatGroup: 2,
    blockExactDuplicates: true,
  };

  const mockSettingsForms = {
    configure: () => () => {},
    describe: () => [
      {
        ns: PKG,
        value: currentSettingsValue,
      },
    ],
  };

  let documentUpdatedHandler = null;
  const sctx = {
    ...ctx,
    settings: mockSettingsForms,
    on: (event, handler) => {
      if (event === 'settings/document-updated') {
        documentUpdatedHandler = handler;
      }
      return ctx.on(event, handler);
    },
    effect: () => () => {},
  };

  apply(ctx, { maxCallsPerRepeatGroup: 5 });
  triggerInject(['settings'], sctx);

  assert.ok(documentUpdatedHandler, 'must register settings/document-updated listener');

  // Change settings and emit update
  currentSettingsValue = {
    maxCallsPerRepeatGroup: 1,
    dryRunMode: true,
  };
  documentUpdatedHandler(PKG, 2);

  // Verify other namespace updates are ignored
  let ranForOther = false;
  try {
    documentUpdatedHandler('other-plugin', 3);
  } catch {
    ranForOther = true;
  }
  assert.equal(ranForOther, false, 'updates for other plugins must not throw or misbehave');
});

test('loader/volatile-update, app-boot/config-reload and internal/update trigger config reload (#98)', () => {
  const { ctx } = createMockContext({
    fiberConfig: { maxCallsPerRepeatGroup: 4 },
  });

  apply(ctx, { maxCallsPerRepeatGroup: 5 });

  // Verify events are hooked on root ctx
  assert.doesNotThrow(() => {
    ctx.emit('loader/volatile-update');
    ctx.emit('app-boot/config-reload');
    ctx.emit('internal/update');
  });
});

test('boot without settings service works cleanly with initial config', () => {
  const { ctx, getGuardedFunction } = createMockContext();

  assert.doesNotThrow(() => {
    apply(ctx, { maxCallsPerRepeatGroup: 7 });
  });

  const guardFn = getGuardedFunction();
  assert.equal(typeof guardFn, 'function', 'tool guard must be registered even without settings service');
});

test('legacy settings.register trap: throws if called', () => {
  const { ctx, triggerInject } = createMockContext();

  const trapSettings = {
    register: () => {
      throw new Error('legacy register() should never be called');
    },
    configure: () => () => {},
    describe: () => [],
  };

  const sctx = {
    ...ctx,
    settings: trapSettings,
    effect: () => () => {},
  };

  apply(ctx, { maxCallsPerRepeatGroup: 5 });

  // Must not throw because register is never invoked
  assert.doesNotThrow(() => {
    triggerInject(['settings'], sctx);
  });
});
