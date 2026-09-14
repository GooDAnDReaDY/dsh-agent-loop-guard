import test from 'node:test';
import assert from 'node:assert/strict';
import { isNewerVersion, isTrustedUpdateRequest } from '../lib/plugin-updater.js';

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
