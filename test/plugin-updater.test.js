import test from 'node:test';
import assert from 'node:assert/strict';
import { isNewerVersion, isTrustedUpdateRequest, isTrustedTelemetryRequest, currentVersion } from '../lib/plugin-updater.js';

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
});

test('isTrustedTelemetryRequest enforces loopback and same-origin validation', () => {
  // Non-loopback remote address
  assert.equal(isTrustedTelemetryRequest({
    method: 'GET',
    headers: { host: '192.168.1.111:3080' },
    socket: { remoteAddress: '192.168.1.50' },
  }), false);

  // Cross-site sec-fetch-site
  assert.equal(isTrustedTelemetryRequest({
    method: 'GET',
    headers: { 'sec-fetch-site': 'cross-site' },
    socket: { remoteAddress: '127.0.0.1' },
  }), false);

  // Valid GET from loopback
  assert.equal(isTrustedTelemetryRequest({
    method: 'GET',
    headers: { 'sec-fetch-site': 'same-origin', host: '127.0.0.1:3080' },
    socket: { remoteAddress: '127.0.0.1' },
  }), true);

  // POST without origin
  assert.equal(isTrustedTelemetryRequest({
    method: 'POST',
    headers: { host: '127.0.0.1:3080' },
    socket: { remoteAddress: '127.0.0.1' },
  }), false);

  // Cross-origin POST (attacker site)
  assert.equal(isTrustedTelemetryRequest({
    method: 'POST',
    headers: {
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
      origin: 'http://malicious-site.com',
      host: 'malicious-site.com',
      'sec-fetch-site': 'same-origin',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }), false);

  // Valid same-origin POST from loopback
  assert.equal(isTrustedTelemetryRequest({
    method: 'POST',
    headers: {
      origin: 'http://127.0.0.1:3080',
      host: '127.0.0.1:3080',
      'sec-fetch-site': 'same-origin',
    },
    socket: { remoteAddress: '127.0.0.1' },
  }), true);
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
