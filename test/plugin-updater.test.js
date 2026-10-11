import test from 'node:test';
import assert from 'node:assert/strict';
import { isNewerVersion, isTrustedUpdateRequest, isTrustedTelemetryRequest, isPrivateLan, currentVersion, isDesktopProfile, findDesktopCliEntry, status } from '../lib/plugin-updater.js';

test('isNewerVersion handles core semver and prereleases correctly', () => {
  assert.equal(isNewerVersion('0.2.4', '0.2.5'), true);
  assert.equal(isNewerVersion('0.2.4', '0.3.0'), true);
  assert.equal(isNewerVersion('0.2.4', '1.0.0'), true);
  assert.equal(isNewerVersion('0.2.4', '0.2.4'), false);
  assert.equal(isNewerVersion('0.2.5', '0.2.4'), false);
  assert.equal(isNewerVersion('0.2.4-alpha.1', '0.2.4'), true);
  assert.equal(isNewerVersion('0.2.4', '0.2.4-alpha.1'), false);
});

test('isTrustedUpdateRequest enforces x-dsh-plugin-update and loopback origins', () => {
  // Missing header
  assert.equal(isTrustedUpdateRequest({
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  }), false);

  // Non-loopback remote address
  assert.equal(isTrustedUpdateRequest({
    headers: {
      'x-dsh-plugin-update': '1',
      host: 'localhost:3080',
      origin: 'http://localhost:3080',
    },
    socket: { remoteAddress: '192.168.1.50' },
  }), false);

  // sec-fetch-site violation
  assert.equal(isTrustedUpdateRequest({
    headers: {
      'x-dsh-plugin-update': '1',
      'sec-fetch-site': 'cross-site',
      host: '127.0.0.1:3080',
      origin: 'http://127.0.0.1:3080',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }), false);

  // Valid loopback request
  assert.equal(isTrustedUpdateRequest({
    headers: {
      'x-dsh-plugin-update': '1',
      'sec-fetch-site': 'same-origin',
      host: '127.0.0.1:3080',
      origin: 'http://127.0.0.1:3080',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }), true);

  // Valid LAN origin matching Host
  assert.equal(isTrustedUpdateRequest({
    headers: {
      'x-dsh-plugin-update': '1',
      'sec-fetch-site': 'same-origin',
      host: '192.168.1.111:3080',
      origin: 'http://192.168.1.111:3080',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }), true);

  // Cross-site origin targeting LAN host
  assert.equal(isTrustedUpdateRequest({
    headers: {
      'x-dsh-plugin-update': '1',
      'sec-fetch-site': 'cross-site',
      host: '192.168.1.111:3080',
      origin: 'http://evil.com',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }), false);
});

test('isTrustedTelemetryRequest enforces core connection auth, sec-fetch-site, and reset guard', () => {
  // 1. Standalone fallback (no targetCtx / connection)
  // Non-loopback remote address
  assert.equal(isTrustedTelemetryRequest({
    method: 'GET',
    headers: { host: '192.168.1.111:3080', 'sec-fetch-site': 'same-origin' },
    socket: { remoteAddress: '192.168.1.50' },
  }), false);

  // Missing sec-fetch-site without core auth (e.g. unauthenticated curl from loopback)
  assert.equal(isTrustedTelemetryRequest({
    method: 'GET',
    headers: { host: '127.0.0.1:3080' },
    socket: { remoteAddress: '127.0.0.1' },
  }), false);

  // Cross-site sec-fetch-site
  assert.equal(isTrustedTelemetryRequest({
    method: 'GET',
    headers: { 'sec-fetch-site': 'cross-site' },
    socket: { remoteAddress: '127.0.0.1' },
  }), false);

  // Valid GET from loopback with same-origin
  assert.equal(isTrustedTelemetryRequest({
    method: 'GET',
    headers: { 'sec-fetch-site': 'same-origin', host: '127.0.0.1:3080' },
    socket: { remoteAddress: '127.0.0.1' },
  }), true);

  // Valid GET from loopback with sec-fetch-site: none
  assert.equal(isTrustedTelemetryRequest({
    method: 'GET',
    headers: { 'sec-fetch-site': 'none', host: '127.0.0.1:3080' },
    socket: { remoteAddress: '127.0.0.1' },
  }), true);

  // 2. Core connection authentication
  const admittedCtx = {
    connection: { requestRejection: () => undefined },
  };
  const rejected401Ctx = {
    connection: { requestRejection: () => 401 },
  };
  const rejected403Ctx = {
    connection: { requestRejection: () => 403 },
  };
  const throwingCtx = {
    connection: { requestRejection: () => { throw new Error('internal auth failure'); } },
  };
  const reflectCtx = {
    reflect: { get: (name) => (name === 'connection' ? { requestRejection: () => undefined } : undefined) },
  };

  // Connection admits request (even without sec-fetch-site)
  assert.equal(isTrustedTelemetryRequest({
    method: 'GET',
    headers: { host: '127.0.0.1:3080' },
    socket: { remoteAddress: '127.0.0.1' },
  }, admittedCtx), true);

  // Connection reflects admits request
  assert.equal(isTrustedTelemetryRequest({
    method: 'GET',
    headers: { host: '127.0.0.1:3080' },
    socket: { remoteAddress: '127.0.0.1' },
  }, reflectCtx), true);

  // Connection rejects with 401
  assert.equal(isTrustedTelemetryRequest({
    method: 'GET',
    headers: { host: '127.0.0.1:3080' },
    socket: { remoteAddress: '127.0.0.1' },
  }, rejected401Ctx), false);

  // Connection rejects with 403
  assert.equal(isTrustedTelemetryRequest({
    method: 'GET',
    headers: { host: '127.0.0.1:3080' },
    socket: { remoteAddress: '127.0.0.1' },
  }, rejected403Ctx), false);

  // Connection throws -> fails closed
  assert.equal(isTrustedTelemetryRequest({
    method: 'GET',
    headers: { host: '127.0.0.1:3080' },
    socket: { remoteAddress: '127.0.0.1' },
  }, throwingCtx), false);

  // 3. POST telemetry reset validation
  // POST without x-dsh-loop-guard header is rejected
  assert.equal(isTrustedTelemetryRequest({
    method: 'POST',
    headers: {
      origin: 'http://127.0.0.1:3080',
      host: '127.0.0.1:3080',
      'sec-fetch-site': 'same-origin',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }), false);

  // POST without origin is rejected
  assert.equal(isTrustedTelemetryRequest({
    method: 'POST',
    headers: {
      'x-dsh-loop-guard': '1',
      host: '127.0.0.1:3080',
      'sec-fetch-site': 'same-origin',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }), false);

  // Cross-origin POST (attacker site)
  assert.equal(isTrustedTelemetryRequest({
    method: 'POST',
    headers: {
      'x-dsh-loop-guard': '1',
      origin: 'http://malicious-site.com',
      host: '127.0.0.1:3080',
      'sec-fetch-site': 'cross-site',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }), false);

  // Cross-origin POST with fake host header
  assert.equal(isTrustedTelemetryRequest({
    method: 'POST',
    headers: {
      'x-dsh-loop-guard': '1',
      origin: 'http://malicious-site.com',
      host: 'malicious-site.com',
      'sec-fetch-site': 'same-origin',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }), false);

  // Valid same-origin POST from loopback with x-dsh-loop-guard
  assert.equal(isTrustedTelemetryRequest({
    method: 'POST',
    headers: {
      'x-dsh-loop-guard': '1',
      origin: 'http://127.0.0.1:3080',
      host: '127.0.0.1:3080',
      'sec-fetch-site': 'same-origin',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }), true);

  // Valid LAN origin POST matching Host with x-dsh-loop-guard
  assert.equal(isTrustedTelemetryRequest({
    method: 'POST',
    headers: {
      'x-dsh-loop-guard': '1',
      origin: 'http://192.168.1.111:3080',
      host: '192.168.1.111:3080',
      'sec-fetch-site': 'same-origin',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }), true);

  // Valid POST admitted via core connection with x-dsh-loop-guard
  assert.equal(isTrustedTelemetryRequest({
    method: 'POST',
    headers: {
      'x-dsh-loop-guard': '1',
      origin: 'http://127.0.0.1:3080',
      host: '127.0.0.1:3080',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }, admittedCtx), true);

  // POST rejected by core connection even with x-dsh-loop-guard
  assert.equal(isTrustedTelemetryRequest({
    method: 'POST',
    headers: {
      'x-dsh-loop-guard': '1',
      origin: 'http://127.0.0.1:3080',
      host: '127.0.0.1:3080',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }, rejected401Ctx), false);
});

test('isPrivateLan recognizes private IPv4 ranges and rejects external addresses', () => {
  assert.equal(isPrivateLan('192.168.1.1'), true);
  assert.equal(isPrivateLan('192.168.0.254'), true);
  assert.equal(isPrivateLan('10.0.0.1'), true);
  assert.equal(isPrivateLan('10.255.255.255'), true);
  assert.equal(isPrivateLan('172.16.0.1'), true);
  assert.equal(isPrivateLan('172.31.255.254'), true);
  assert.equal(isPrivateLan('::ffff:192.168.1.100'), true);

  assert.equal(isPrivateLan('127.0.0.1'), false);
  assert.equal(isPrivateLan('localhost'), false);
  assert.equal(isPrivateLan('8.8.8.8'), false);
  assert.equal(isPrivateLan('172.32.0.1'), false);
  assert.equal(isPrivateLan('example.com'), false);
  assert.equal(isPrivateLan(null), false);
  assert.equal(isPrivateLan(undefined), false);
});

test('currentVersion safely handles valid, invalid, and corrupt manifest files', async () => {
  const packageJsonUrl = new URL('../package.json', import.meta.url);
  const readmeUrl = new URL('../README.md', import.meta.url);
  const nonExistentUrl = new URL('../does-not-exist.json', import.meta.url);

  const validVer = await currentVersion(packageJsonUrl);
  assert.match(validVer, /^\d+\.\d+\.\d+/);

  // Corrupt / non-JSON file (e.g. Markdown README)
  const corruptVer = await currentVersion(readmeUrl);
  assert.equal(corruptVer, 'unknown');

  // Non-existent file
  const missingVer = await currentVersion(nonExistentUrl);
  assert.equal(missingVer, 'unknown');
});

test('isDesktopProfile identifies desktop environment across env, profileName, and path', () => {
  const origEnv = { ...process.env };
  try {
    delete process.env.DSH_PROFILE;
    delete process.env.DSH_DESKTOP;

    assert.equal(isDesktopProfile('desktop', '/home/user/.dsh/profiles/desktop'), true);
    assert.equal(isDesktopProfile('Desktop', '/home/user/.dsh/profiles/Desktop'), true);
    assert.equal(isDesktopProfile('custom', '/home/user/.dsh/profiles/desktop'), true);
    assert.equal(isDesktopProfile('web', '/home/user/.dsh/profiles/web'), false);
    assert.equal(isDesktopProfile('default', '/home/user/.dsh/profiles/default'), false);

    process.env.DSH_PROFILE = 'desktop';
    assert.equal(isDesktopProfile('web', '/home/user/.dsh/profiles/web'), true);
    delete process.env.DSH_PROFILE;

    process.env.DSH_DESKTOP = '1';
    assert.equal(isDesktopProfile('web', '/home/user/.dsh/profiles/web'), true);
    delete process.env.DSH_DESKTOP;

    process.env.DSH_DESKTOP = 'true';
    assert.equal(isDesktopProfile('web', '/home/user/.dsh/profiles/web'), true);
  } finally {
    process.env = origEnv;
  }
});

test('status reports isDesktop and canAutoUpdate flags correctly', async () => {
  const options = {
    packageName: '@goodandready/dsh-agent-loop-guard',
    manifestUrl: new URL('../package.json', import.meta.url),
  };

  const webTarget = {
    profileName: 'web',
    profileDir: '/tmp/profiles/web',
    cliEntry: '/bin/dsh',
    isDesktop: false,
  };
  const webStatus = await status(options, webTarget);
  assert.equal(webStatus.isDesktop, false);
  assert.equal(webStatus.canAutoUpdate, true);

  const desktopTargetNoCli = {
    profileName: 'desktop',
    profileDir: '/tmp/profiles/desktop',
    cliEntry: undefined,
    desktopCli: undefined,
    isDesktop: true,
  };
  const desktopStatusNoCli = await status(options, desktopTargetNoCli);
  assert.equal(desktopStatusNoCli.isDesktop, true);
  assert.equal(desktopStatusNoCli.canAutoUpdate, false);

  const desktopTargetWithCli = {
    profileName: 'desktop',
    profileDir: '/tmp/profiles/desktop',
    cliEntry: '/path/to/dsh.cmd',
    desktopCli: '/path/to/dsh.cmd',
    isDesktop: true,
  };
  const desktopStatusWithCli = await status(options, desktopTargetWithCli);
  assert.equal(desktopStatusWithCli.isDesktop, true);
  assert.equal(desktopStatusWithCli.canAutoUpdate, true);
});
