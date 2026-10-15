import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const UPDATE_HEADER = 'x-dsh-plugin-update';
const UPDATE_TIMEOUT_MS = 10 * 60_000;
const VERSION_CACHE_MS = 5 * 60_000;
let latestCache = null;

function header(request, name) {
  const value = request.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

export function isLoopback(value) {
  const address = value?.toLowerCase().replace(/^\[|\]$/g, '');
  return address === 'localhost' || address === 'localhost.' || address === '::1'
    || address?.startsWith('127.') === true
    || address?.startsWith('::ffff:127.') === true;
}

export function isPrivateLan(value) {
  const address = value?.toLowerCase().replace(/^\[|\]$/g, '');
  if (!address) return false;
  const ipv4 = address.startsWith('::ffff:') ? address.slice(7) : address;
  return (
    ipv4.startsWith('192.168.') ||
    ipv4.startsWith('10.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ipv4)
  );
}

export function getConnection(ctx) {
  try {
    const fromCtx = ctx?.reflect?.get
      ? (ctx.reflect.get('connection') || ctx?.connection)
      : (ctx?.get ? (ctx.get('connection') || ctx?.connection) : Reflect.get(ctx || {}, 'connection'));
    if (fromCtx) return fromCtx;
    if (ctx?.root) {
      return getConnection(ctx.root);
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function isTrustedTelemetryRequest(request, targetCtx = null) {
  // 1. Core connection auth check
  const conn = getConnection(targetCtx);
  if (conn && typeof conn.requestRejection === 'function') {
    let rejection;
    try {
      rejection = conn.requestRejection(request);
    } catch {
      return false;
    }
    if (rejection !== undefined) return false;
  } else {
    // Fallback when connection service is absent (e.g. standalone tests):
    // Remote must be loopback AND require sec-fetch-site (same-origin or none)
    if (!isLoopback(request?.socket?.remoteAddress)) return false;
    const site = header(request, 'sec-fetch-site');
    if (site !== 'same-origin' && site !== 'none') return false;
  }

  // 2. For POST (reset telemetry): require x-dsh-loop-guard: 1 and origin verification
  if (request?.method === 'POST') {
    if (header(request, 'x-dsh-loop-guard') !== '1') return false;
    const origin = header(request, 'origin');
    const host = header(request, 'host');
    if (origin === undefined || host === undefined) return false;
    try {
      const url = new URL(origin);
      return (url.protocol === 'http:' || url.protocol === 'https:')
        && (isLoopback(url.hostname) || isPrivateLan(url.hostname)) && url.host === host;
    } catch {
      return false;
    }
  }

  return true;
}

export function isTrustedUpdateRequest(request, targetCtx = null) {
  if (header(request, UPDATE_HEADER) !== '1') return false;
  const conn = getConnection(targetCtx);
  if (conn && typeof conn.requestRejection === 'function') {
    let rejection;
    try {
      rejection = conn.requestRejection(request);
    } catch {
      return false;
    }
    if (rejection !== undefined) return false;
  }
  if (!isLoopback(request?.socket?.remoteAddress)) return false;
  const site = header(request, 'sec-fetch-site');
  if (site !== undefined && site !== 'same-origin') return false;
  const origin = header(request, 'origin');
  const host = header(request, 'host');
  if (origin === undefined || host === undefined) return false;
  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && (isLoopback(url.hostname) || isPrivateLan(url.hostname)) && url.host === host;
  } catch {
    return false;
  }
}

function validProfileName(value) {
  return typeof value === 'string' && value !== '' && value !== '.' && value !== '..'
    && !value.includes('/') && !value.includes('\\') && !/[\0-\x1f\x7f]/.test(value);
}

function profileNameFromArgv(argv) {
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === '--profile') return argv[index + 1];
    if (argv[index]?.startsWith('--profile=')) return argv[index].slice('--profile='.length);
  }
  return argv[2] === 'web' ? 'web' : undefined;
}

export function isDesktopProfile(profileName, profileDir) {
  if (process.env.DSH_PROFILE === 'desktop' || process.env.DSH_DESKTOP === '1' || process.env.DSH_DESKTOP === 'true') return true;
  if (profileName === 'desktop') return true;
  if (typeof profileName === 'string' && profileName.toLowerCase() === 'desktop') return true;
  if (typeof profileDir === 'string' && basename(resolve(profileDir)).toLowerCase() === 'desktop') return true;
  if (typeof process.versions?.electron === 'string') return true;
  return false;
}

export function findDesktopCliEntry() {
  if (process.env.DSH_DESKTOP_CLI && existsSync(process.env.DSH_DESKTOP_CLI)) {
    return process.env.DSH_DESKTOP_CLI;
  }
  const isWin = process.platform === 'win32';
  const cliName = isWin ? 'dsh.cmd' : 'dsh';

  const pathEnv = process.env.PATH || '';
  const pathDirs = pathEnv.split(isWin ? ';' : ':');
  for (const dir of pathDirs) {
    if (!dir) continue;
    try {
      const candidate = resolve(dir, cliName);
      if (existsSync(candidate)) return candidate;
    } catch {}
  }

  if (typeof process.resourcesPath === 'string') {
    try {
      const candidate = resolve(process.resourcesPath, 'runtime', 'cli', 'bin', cliName);
      if (existsSync(candidate)) return candidate;
    } catch {}
  }

  try {
    const execDir = dirname(process.execPath);
    const candidate = resolve(execDir, 'resources', 'runtime', 'cli', 'bin', cliName);
    if (existsSync(candidate)) return candidate;
  } catch {}

  if (isWin && process.env.LOCALAPPDATA) {
    try {
      const candidate = resolve(
        process.env.LOCALAPPDATA,
        'Programs',
        'DeepSeek Harness',
        'resources',
        'runtime',
        'cli',
        'bin',
        'dsh.cmd'
      );
      if (existsSync(candidate)) return candidate;
    } catch {}
  }

  return undefined;
}

export function findDshCliEntry() {
  const value = process.argv[1];
  if (value === undefined || value === '') return undefined;
  const entry = value.startsWith('file:') ? fileURLToPath(value) : resolve(process.cwd(), value);
  if (!existsSync(entry)) return undefined;
  for (let directory = dirname(entry); ; directory = dirname(directory)) {
    const manifestPath = resolve(directory, 'package.json');
    if (existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        const bin = typeof manifest.bin === 'string'
          ? manifest.bin
          : typeof manifest.bin === 'object' && manifest.bin !== null
            ? manifest.bin.dsh
            : undefined;
        if (manifest.name === '@deepseek-ai/dsh' && typeof bin === 'string'
          && !isAbsolute(bin) && resolve(directory, bin) === resolve(entry)) return entry;
      } catch {
        // Continue searching parent package directories.
      }
    }
    const parent = dirname(directory);
    if (parent === directory) return undefined;
  }
}

export function runtime() {
  const profileDir = resolve(process.env.DSH_PROFILE_DIR
    ?? resolve(homedir(), '.dsh', 'profiles', 'web'));
  const selected = profileNameFromArgv(process.argv) || process.env.DSH_PROFILE;
  const profileName = validProfileName(selected)
    ? selected
    : validProfileName(basename(profileDir)) ? basename(profileDir) : 'web';
  const isDesktop = isDesktopProfile(profileName, profileDir);
  const desktopCli = isDesktop ? findDesktopCliEntry() : undefined;
  const cliEntry = isDesktop ? desktopCli : findDshCliEntry();
  return {
    profileName,
    profileDir,
    isDesktop,
    ...(desktopCli !== undefined ? { desktopCli } : {}),
    ...(cliEntry !== undefined ? { cliEntry } : {}),
  };
}

function parseSemver(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value);
  if (match === null) return undefined;
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4]?.split('.') ?? [],
  };
}

function comparePrerelease(left, right) {
  if (left.length === 0 || right.length === 0) return left.length === right.length ? 0 : left.length === 0 ? 1 : -1;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a === undefined || b === undefined) return a === b ? 0 : a === undefined ? -1 : 1;
    if (a === b) continue;
    const aNumeric = /^\d+$/.test(a);
    const bNumeric = /^\d+$/.test(b);
    if (aNumeric && bNumeric) {
      const aNumber = BigInt(a);
      const bNumber = BigInt(b);
      if (aNumber !== bNumber) return aNumber > bNumber ? 1 : -1;
      continue;
    }
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return a > b ? 1 : -1;
  }
  return 0;
}

export function isNewerVersion(currentValue, candidateValue) {
  const current = parseSemver(currentValue);
  const candidate = parseSemver(candidateValue);
  if (current === undefined || candidate === undefined) return false;
  for (let index = 0; index < 3; index += 1) {
    if (candidate.core[index] !== current.core[index]) return candidate.core[index] > current.core[index];
  }
  return comparePrerelease(candidate.prerelease, current.prerelease) > 0;
}

async function latestVersion(packageName, registry) {
  if (latestCache?.packageName === packageName && latestCache.registry === registry && Date.now() < latestCache.expiresAt) {
    return latestCache.version;
  }
  try {
    const response = await fetch(`${registry.replace(/\/$/, '')}/${encodeURIComponent(packageName)}/latest`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return undefined;
    const value = await response.json();
    if (typeof value?.version !== 'string' || value.version === '') return undefined;
    latestCache = { packageName, registry, version: value.version, expiresAt: Date.now() + VERSION_CACHE_MS };
    return value.version;
  } catch {
    return undefined;
  }
}

export async function currentVersion(manifestUrl) {
  try {
    const raw = await readFile(manifestUrl, 'utf8');
    const value = JSON.parse(raw);
    if (typeof value?.version !== 'string' || value.version === '') return 'unknown';
    return value.version;
  } catch {
    return 'unknown';
  }
}

export async function status(options, target) {
  let current = 'unknown';
  try {
    current = await currentVersion(options.manifestUrl);
  } catch {
    current = 'unknown';
  }
  const latest = await latestVersion(options.packageName, options.registry ?? 'https://registry.npmjs.org');
  const validCurrent = current !== 'unknown';
  const isDesktop = Boolean(target.isDesktop);
  const canAutoUpdate = Boolean(target.cliEntry !== undefined && (!isDesktop || target.desktopCli !== undefined));
  return {
    packageName: options.packageName,
    currentVersion: current,
    ...(latest === undefined ? {} : { latestVersion: latest }),
    latestCheckFailed: latest === undefined || !validCurrent,
    updateAvailable: latest !== undefined && validCurrent && isNewerVersion(current, latest),
    profileName: target.profileName,
    isDesktop,
    canAutoUpdate,
  };
}

async function installExact(target, packageSpec, options) {
  if (target.cliEntry === undefined) throw new Error('Automatic update is unavailable in this runtime.');
  await new Promise((resolvePromise, reject) => {
    const isCmd = typeof target.cliEntry === 'string' && target.cliEntry.endsWith('.cmd');
    const child = isCmd
      ? spawn(target.cliEntry, [
          'plugin', '--profile', target.profileName, 'add',
          packageSpec,
          `--registry=${options.registry ?? 'https://registry.npmjs.org/'}`,
        ], {
          cwd: target.profileDir,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: true,
          env: { ...process.env, NO_COLOR: '1' },
        })
      : spawn(process.execPath, [
          target.cliEntry, 'plugin', '--profile', target.profileName, 'add',
          packageSpec,
          `--registry=${options.registry ?? 'https://registry.npmjs.org/'}`,
        ], {
          cwd: target.profileDir,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, NO_COLOR: '1' },
        });
    let detail = '';
    child.stdout?.on('data', (chunk) => { detail = (detail + String(chunk)).slice(-4_000); });
    child.stderr?.on('data', (chunk) => { detail = (detail + String(chunk)).slice(-4_000); });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Update timed out; use the normal DSH update flow.'));
    }, UPDATE_TIMEOUT_MS);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolvePromise();
      else reject(new Error(detail.trim() || `Update exited with code ${String(code)}.`));
    });
  });
}

function json(response, statusCode, value) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(value));
}

export function registerPluginUpdater(ctx, options) {
  let installing = false;
  if (typeof ctx?.webServer?.register !== 'function') {
    ctx?.logger?.warn?.('dsh-agent-loop-guard: webServer service unavailable, updater skipped');
    return () => {};
  }
  return ctx.webServer.register({
    kind: 'exact',
    path: options.endpoint,
    handler: async (request, response) => {
      try {
        const target = runtime();
        if (request.method === 'GET' || request.method === 'HEAD') {
          const payload = await status(options, target);
          response.writeHead(200, {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          });
          response.end(request.method === 'HEAD' ? undefined : JSON.stringify(payload));
          return;
        }
        if (request.method !== 'POST') {
          response.writeHead(405, { allow: 'GET, HEAD, POST' });
          response.end();
          return;
        }
        if (!isTrustedUpdateRequest(request, ctx)) {
          json(response, 403, { error: 'Rejected non-local or cross-origin update request.' });
          return;
        }
        if (installing) {
          json(response, 409, { error: 'This plugin is already updating.' });
          return;
        }
        installing = true;
        try {
          const before = await status(options, target);
          if (before.latestVersion === undefined) {
            json(response, 503, { error: 'The latest version is temporarily unavailable.' });
            return;
          }
          if (!before.updateAvailable) {
            json(response, 200, before);
            return;
          }
          await installExact(target, `${options.packageName}@${before.latestVersion}`, options);
          json(response, 200, {
            ...before,
            updatedVersion: before.latestVersion,
            restartRequired: true,
          });
        } finally {
          installing = false;
        }
      } catch (error) {
        ctx?.logger?.warn?.(`dsh-agent-loop-guard: plugin updater failed: ${String(error)}`);
        json(response, 503, { error: 'Plugin update failed; see server logs.' });
      }
    },
  });
}
