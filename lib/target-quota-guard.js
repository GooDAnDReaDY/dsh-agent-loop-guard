import path from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { formatSteeringAdvice } from './guard-helpers.js';

const READ_ACTIONS = new Set(['read', 'cat', 'inspect', 'fetch', 'load', 'show', 'open', 'view', 'tail', 'head']);
const EDIT_ACTIONS = new Set(['edit', 'patch', 'replace', 'modify', 'update', 'format', 'rewrite', 'insert', 'substitute']);
const WRITE_ACTIONS = new Set(['write', 'create', 'save', 'append', 'dump', 'generate', 'put', 'upload']);
const DELETE_ACTIONS = new Set(['delete', 'remove', 'unlink', 'rm', 'purge', 'destroy', 'drop', 'truncate', 'trash']);

export function classifyToolAction(name) {
  if (!name || typeof name !== 'string') return 'default';
  const clean = name.trim();
  if (!clean) return 'default';

  const tokens = clean
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  if (tokens.length === 0) return 'default';

  for (const t of tokens) {
    if (DELETE_ACTIONS.has(t)) return 'delete';
  }
  for (const t of tokens) {
    if (EDIT_ACTIONS.has(t)) return 'edit';
  }
  for (const t of tokens) {
    if (WRITE_ACTIONS.has(t)) return 'write';
  }
  for (const t of tokens) {
    if (READ_ACTIONS.has(t)) return 'read';
  }

  return 'default';
}

export function extractTargetKey(name, args) {
  if (!args) return null;
  let raw = null;
  if (typeof args === 'string') {
    raw = args;
  } else if (typeof args === 'object') {
    raw = args.path ?? args.file ?? args.filePath ?? args.target ?? args.filename
      ?? args.uri ?? args.dest ?? args.destination ?? args.src ?? args.source
      ?? args.params?.path ?? args.params?.file;
  }
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let p = trimmed;
  if (p.startsWith('file://')) {
    p = p.slice(7);
    if (/^\/[a-zA-Z]:/.test(p)) {
      p = p.slice(1);
    }
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(p)) {
    return p;
  }

  p = p.replace(/\\/g, '/');
  let normalized = path.posix.normalize(p);

  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  const winDriveMatch = /^([a-zA-Z]):(\/.*)?$/.exec(normalized);
  if (winDriveMatch) {
    normalized = winDriveMatch[1].toLowerCase() + ':' + (winDriveMatch[2] || '');
  }

  try {
    const probe = path.isAbsolute(normalized) ? normalized : path.resolve(normalized);
    if (fs.existsSync(probe)) {
      const stat = fs.lstatSync(probe);
      if (stat.isSymbolicLink()) {
        const real = fs.realpathSync(probe).replace(/\\/g, '/');
        normalized = real;
      }
    }
  } catch {
    // best-effort filesystem check
  }

  if (process.platform === 'win32') {
    normalized = normalized.toLowerCase();
  }

  if (normalized.length > 512) {
    normalized = normalized.slice(0, 512);
  }

  return normalized;
}

export function checkTargetQuota(state, config, name, args) {
  if (!config.targetQuotaGuard) return undefined;
  const target = extractTargetKey(name, args);
  if (!target) return undefined;

  const action = classifyToolAction(name);
  const counts = state.targetCallCounts?.get(target) || { read: 0, edit: 0, write: 0, delete: 0, default: 0, total: 0 };

  if (action === 'read' && state.targetReadFingerprints) {
    const readInfo = state.targetReadFingerprints.get(target);
    const maxUnchanged = config.maxUnchangedReadsPerTarget ?? 3;
    if (readInfo && readInfo.unchangedReReads >= maxUnchanged) {
      return {
        code: 'LOOP_GUARD_UNREFRESHED_READ',
        detail: `Target "${target}" has been read ${readInfo.unchangedReReads + 1} times without content changes. File content is already in context. Do not re-read unchanged files; proceed to process or edit, or answer the user directly.`,
        target,
        action,
        nonLatching: true,
      };
    }
  }

  const maxReads = config.maxReadsPerTarget ?? 6;
  if (action === 'read' && counts.read >= maxReads) {
    return {
      code: 'LOOP_GUARD_TARGET_QUOTA',
      detail: `Read quota (${maxReads}) exceeded for target "${target}". Cease reading this file and proceed with alternative actions or summarize findings.`,
      target,
      action,
      nonLatching: true,
    };
  }

  const maxEdits = config.maxEditsPerTarget ?? 8;
  if ((action === 'edit' || action === 'write') && (counts.edit + counts.write) >= maxEdits) {
    return {
      code: 'LOOP_GUARD_TARGET_QUOTA',
      detail: `Modification quota (${maxEdits}) exceeded for target "${target}". Repeated modifications suggest an unproductive repair loop; diagnose root cause or explain roadblock.`,
      target,
      action,
      nonLatching: true,
    };
  }

  const maxTotal = config.maxTargetAttempts ?? 12;
  if (counts.total >= maxTotal) {
    return {
      code: 'LOOP_GUARD_TARGET_QUOTA',
      detail: `Total operation quota (${maxTotal}) exceeded for target "${target}".`,
      target,
      action,
      nonLatching: true,
    };
  }

  return undefined;
}

export function recordTargetOutcome(state, call, outcome) {
  if (!call?.target) return;
  const target = call.target;
  const action = call.action;

  if (outcome?.successful && state.targetDenialCounts?.has(target)) {
    state.targetDenialCounts.delete(target);
  }

  if (action === 'read') {
    if (!state.targetReadFingerprints) state.targetReadFingerprints = new Map();
    const current = state.targetReadFingerprints.get(target);
    const fp = outcome.resultFingerprint;
    if (current && current.lastFingerprint === fp && outcome.successful) {
      current.unchangedReReads = (current.unchangedReReads || 0) + 1;
    } else {
      state.targetReadFingerprints.set(target, {
        lastFingerprint: fp,
        unchangedReReads: 0,
      });
    }
  } else if ((action === 'edit' || action === 'write') && outcome.successful) {
    if (state.targetReadFingerprints?.has(target)) {
      state.targetReadFingerprints.delete(target);
    }
  }
}

export function handleTargetViolation(state, guard, agent, name, args, check) {
  const config = guard.config;
  if (config.adaptiveSteering && !state.steeredCodes?.has(check.code)) {
    if (!state.steeredCodes) state.steeredCodes = new Set();
    state.steeredCodes.add(check.code);
    guard.metrics.steeredCount = (guard.metrics.steeredCount || 0) + 1;
    guard.recordIncident(agent, 'LOOP_GUARD_STEER', `${check.code}: ${check.detail}`, name, state);
    const advice = formatSteeringAdvice(check.code, check.detail, name);
    return `[LOOP_GUARD_STEER] Warning: ${advice} This operation on target is denied, but other tools and targets remain available. Repeated attempts on this target will terminate tool execution for this turn.`;
  }

  if (!state.targetDenialCounts) state.targetDenialCounts = new Map();
  const denials = (state.targetDenialCounts.get(check.target) || 0) + 1;
  state.targetDenialCounts.set(check.target, denials);
  guard.metrics.targetDenials = (guard.metrics.targetDenials || 0) + 1;

  const maxDenials = config.maxTargetDenialsBeforeEscalation ?? 3;
  if (denials >= maxDenials) {
    return guard.violation(
      state,
      agent,
      name,
      args,
      undefined,
      check.code,
      `Target "${check.target}" denial repeated ${denials} times without switching targets; escalating to text-only mode to prevent token exhaustion.`
    );
  }

  guard.metrics.totalViolations += 1;
  guard.metrics.byCode[check.code] = (guard.metrics.byCode[check.code] || 0) + 1;
  guard.metrics.lastViolation = {
    code: check.code,
    tool: String(name),
    timestamp: Date.now(),
    turn: state.turn,
    reason: redactTelemetryText(check.detail),
  };
  guard.recordIncident(agent, check.code, check.detail, name, state);
  if (config.dryRunMode) return undefined;
  return `[${check.code}] ${check.detail}`;
}

export function maskSessionId(session) {
  if (!session) return 'sess-unknown';
  const str = String(session);
  const hash = createHash('sha256').update(str).digest('hex').slice(0, 8);
  return 'sess-' + hash;
}

export function redactTelemetryText(text) {
  if (!text || typeof text !== 'string') return '';
  let sanitized = text.replace(/(?:[a-zA-Z]:[\\/](?:[^"'\s\r\n\\/]+[\\/])+)([^"'\s\r\n\\/]+)/g, '.../$1');
  sanitized = sanitized.replace(/(?:\/(?:[a-zA-Z0-9._-]+)\/)+(?:[a-zA-Z0-9._-]+\/)*([a-zA-Z0-9._-]+)/g, '.../$1');
  return sanitized;
}


export function decrementReservations(state, call) {
  if (!call || !call.counted || call.committed) return;
  state.attemptsSinceProgress = Math.max(0, state.attemptsSinceProgress - 1);
  if (call.isProgressTool) state.progressAttemptsSinceProgress = Math.max(0, state.progressAttemptsSinceProgress - 1);
  if (call.repeatFingerprint) {
    const group = state.repeatGroups.get(call.repeatFingerprint);
    if (group && group.progressEpoch === state.progressEpoch && group.count > 0) {
      group.count = Math.max(0, group.count - 1);
    }
  }
  if (call.repeatFingerprint && state.recentCallSequence.length > 0) {
    const lastIdx = state.recentCallSequence.lastIndexOf(call.repeatFingerprint);
    if (lastIdx !== -1) {
      state.recentCallSequence.splice(lastIdx, 1);
    }
  }
  if (call.fingerprint) {
    const exact = state.exactGroups.get(call.fingerprint);
    if (exact && exact.progressEpoch === state.progressEpoch && exact.count > 0) {
      exact.count = Math.max(0, exact.count - 1);
    }
  }
  if (call.target && state.targetCallCounts) {
    const counts = state.targetCallCounts.get(call.target);
    if (counts) {
      if (call.action && counts[call.action] > 0) counts[call.action] -= 1;
      if (counts.total > 0) counts.total -= 1;
    }
  }
}
