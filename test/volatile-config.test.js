import test from 'node:test';
import assert from 'node:assert/strict';
import { createVolatile } from '@deepseek-ai/cosmokit';
import { apply, plainConfig, isVolatileRef, name as PKG, Config } from '../lib/index.js';

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
    emit: async (event, ...args) => {
      const list = events.get(event) || [];
      for (const handler of list) {
        await handler(...args);
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

test('isVolatileRef correctly identifies volatile objects', () => {
  assert.equal(isVolatileRef(createVolatile(123)), true);
  assert.equal(isVolatileRef({ get: () => 'val' }), true);
  assert.equal(isVolatileRef(null), false);
  assert.equal(isVolatileRef(undefined), false);
  assert.equal(isVolatileRef(42), false);
  assert.equal(isVolatileRef('str'), false);
  assert.equal(isVolatileRef([]), false);
  assert.equal(isVolatileRef({ get: 'not-a-fn' }), false);
  assert.equal(isVolatileRef({ otherProp: 1 }), false);
});

test('plainConfig unwraps nested volatile references and functions cleanly', () => {
  const vNum = createVolatile(64);
  const vNested = { inner: createVolatile('hello') };
  const fnVal = () => ({ val: createVolatile(true) });

  assert.equal(plainConfig(vNum), 64);
  assert.deepEqual(plainConfig(vNested), { inner: 'hello' });
  assert.deepEqual(plainConfig(fnVal), { val: true });
  assert.deepEqual(plainConfig([vNum, 2]), [64, 2]);
  assert.equal(plainConfig(null), null);
  assert.equal(plainConfig(10), 10);
});

test('plugin activates with Cordis Volatile values and guard runtime remains functional', async () => {
  const volatileLimit = createVolatile(3);
  const { ctx, getGuardedFunction } = createMockContext({
    fiberConfig: {
      maxToolAttemptsPerTurn: volatileLimit,
      blockExactDuplicates: createVolatile(false),
      maxCallsPerRepeatGroup: createVolatile(10),
    },
  });

  assert.doesNotThrow(() => {
    apply(ctx);
  }, 'apply must not throw when validating Cordis Volatile fields');

  const guard = getGuardedFunction();
  assert.equal(typeof guard, 'function', 'guard function must be registered');

  const agent = { session: { id: 'test-session-1' } };
  await ctx.emit('agent/pre-step', { agent, turn: 1, messages: [], signal: { aborted: false } }, () => ({ kind: 'accept' }));

  // First 3 calls should pass without denial
  for (let i = 1; i <= 3; i++) {
    const reason = guard({ agent, name: `tool_${i}`, arguments: { arg: i }, callId: `call_${i}` });
    assert.equal(reason, undefined, `call ${i} should be allowed`);
  }

  // 4th call exceeds maxToolAttemptsPerTurn (3) and should be denied
  const denyReason = guard({ agent, name: 'tool_4', arguments: { arg: 4 }, callId: 'call_4' });
  assert.ok(denyReason, '4th call must be denied');
  assert.match(denyReason, /LOOP_GUARD_LIMIT/, 'reason must indicate tool limit reached');
  assert.match(denyReason, /Turn budget of 3 non-productive attempts exhausted/);
});

test('plugin activates with custom { get() } volatile objects', async () => {
  const { ctx, getGuardedFunction } = createMockContext({
    fiberConfig: {
      maxToolAttemptsPerTurn: { get: () => 4 },
      dryRunMode: { get: () => true },
    },
  });

  assert.doesNotThrow(() => {
    apply(ctx);
  });

  const guard = getGuardedFunction();
  assert.equal(typeof guard, 'function');

  const agent = { session: { id: 'test-session-2' } };
  await ctx.emit('agent/pre-step', { agent, turn: 1, messages: [], signal: { aborted: false } }, () => ({ kind: 'accept' }));

  // In dry-run mode, violations are logged but not blocked
  for (let i = 1; i <= 6; i++) {
    const reason = guard({ agent, name: `tool_${i}`, arguments: { arg: i }, callId: `call_${i}` });
    assert.equal(reason, undefined, `call ${i} in dryRunMode should not be blocked`);
  }
});

test('invalid user values wrapped in Volatile produce clear validation errors', () => {
  const { ctx: ctxStr } = createMockContext({
    fiberConfig: {
      maxToolAttemptsPerTurn: createVolatile('not-a-number'),
    },
  });

  assert.throws(
    () => apply(ctxStr),
    (err) => {
      assert.match(err.message, /maxToolAttemptsPerTurn expected number but got not-a-number/);
      return true;
    }
  );

  const { ctx: ctxNeg } = createMockContext({
    fiberConfig: {
      maxToolAttemptsPerTurn: createVolatile(-5),
    },
  });

  assert.throws(
    () => apply(ctxNeg),
    (err) => {
      assert.match(err.message, /maxToolAttemptsPerTurn expected number >= 0 but got -5/);
      return true;
    }
  );
});

test('arbitrary non-volatile objects are not silently coerced and produce clear validation errors', () => {
  const { ctx } = createMockContext({
    fiberConfig: {
      maxToolAttemptsPerTurn: { arbitrary: 123 },
    },
  });

  assert.throws(
    () => apply(ctx),
    (err) => {
      assert.match(err.message, /maxToolAttemptsPerTurn expected number but got \[object Object\]/);
      return true;
    }
  );
});

test('live update of Volatile settings via config-reload refreshes runtime guard limit', async () => {
  let currentLimit = 2;
  const volatileLimit = { get: () => currentLimit };

  const { ctx, getGuardedFunction } = createMockContext({
    fiberConfig: {
      maxToolAttemptsPerTurn: volatileLimit,
      blockExactDuplicates: false,
      maxCallsPerRepeatGroup: 10,
    },
  });

  apply(ctx);
  const guard = getGuardedFunction();

  const agent = { session: { id: 'test-session-3' } };
  await ctx.emit('agent/pre-step', { agent, turn: 1, messages: [], signal: { aborted: false } }, () => ({ kind: 'accept' }));

  // Call 1 & 2 allowed, call 3 blocked under limit = 2
  assert.equal(guard({ agent, name: 'tool_1', arguments: {}, callId: 'c1' }), undefined);
  assert.equal(guard({ agent, name: 'tool_2', arguments: {}, callId: 'c2' }), undefined);
  assert.match(guard({ agent, name: 'tool_3', arguments: {}, callId: 'c3' }) || '', /LOOP_GUARD_LIMIT/);

  // Update volatile value to 5 and trigger config reload
  currentLimit = 5;
  await ctx.emit('app-boot/config-reload');

  // Next turn has the updated limit
  await ctx.emit('agent/pre-step', { agent, turn: 2, messages: [], signal: { aborted: false } }, () => ({ kind: 'accept' }));
  assert.equal(guard({ agent, name: 'tool_1', arguments: {}, callId: 'c2_1' }), undefined);
  assert.equal(guard({ agent, name: 'tool_2', arguments: {}, callId: 'c2_2' }), undefined);
  assert.equal(guard({ agent, name: 'tool_3', arguments: {}, callId: 'c2_3' }), undefined);
  assert.equal(guard({ agent, name: 'tool_4', arguments: {}, callId: 'c2_4' }), undefined);
});

test('Config schema exports all 13 user-facing fields marked with .volatile() (#89)', () => {
  assert.ok(Config, 'Config schema must be exported');
  const dict = Config.dict;
  assert.ok(dict, 'Config must have dict');
  const keys = Object.keys(dict);
  assert.equal(keys.length, 13, 'Config schema must define exactly 13 fields');
  for (const [key, schema] of Object.entries(dict)) {
    assert.equal(schema.meta?.volatile, true, 'Field ' + key + ' must have meta.volatile: true');
  }
});
