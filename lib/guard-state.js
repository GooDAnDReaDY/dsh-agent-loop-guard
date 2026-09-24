import { createHash } from 'node:crypto';
const STOP_REQUEST_PATTERN = /(?:\b(?:stop|halt|cancel|answer(?:\s+now)?)\b|(?<![\p{L}\p{N}_-])стоп(?![\p{L}\p{N}_-])|останов(?:ись|ить)|прекрати|хватит|ответь|петл[яиюе])/iu;
const SECRET_KEY_PATTERN = /(?:token|secret|password|authorization|api[-_]?key|cookie)/iu;

function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
}

function normalizedJson(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'string') return JSON.stringify(value.trim().replace(/\s+/gu, ' '));
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(normalizedJson).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + normalizedJson(value[key])).join(',') + '}';
}

function textFrom(value) {
  if (!Array.isArray(value)) return '';
  return value.map((block) => {
    if (block === null || typeof block !== 'object') return '';
    if (typeof block.text === 'string') return block.text;
    if (Array.isArray(block.content)) return textFrom(block.content);
    return '';
  }).join('\n');
}

function safeLogValue(value, depth = 0) {
  if (depth > 3) return '[depth-limit]';
  if (typeof value === 'string') {
    return value.replace(/((?:Bearer|token)\s+)[^\s'"]+/giu, '$1[redacted]')
      .replace(/((?:token|secret|password|authorization|api[-_]?key)=)[^\s&]+/giu, '$1[redacted]')
      .slice(0, 400);
  }
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeLogValue(item, depth + 1));
  const output = {};
  for (const [key, item] of Object.entries(value).slice(0, 40)) {
    output[key] = SECRET_KEY_PATTERN.test(key) ? '[redacted]' : safeLogValue(item, depth + 1);
  }
  return output;
}

export function positiveInteger(value, fallback) {
  return Number.isSafeInteger(value) && value >= 1 ? value : fallback;
}

export function nonNegativeInteger(value, fallback) {
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

export function hasStopRequest(messages) {
  if (!Array.isArray(messages)) return false;
  return messages.some((message) => message?.source?.kind === 'user' && STOP_REQUEST_PATTERN.test(textFrom(message.content)));
}

export function callFingerprint(name, args) {
  try {
    const raw = stableJson(args);
    const body = raw.length > 256 ? 'sha256:' + createHash('sha256').update(raw).digest('hex') : raw;
    return String(name) + ':' + body;
  } catch {
    return String(name) + ':<unserializable>';
  }
}

export function callRepeatFingerprint(name, args) {
  try {
    const raw = normalizedJson(args);
    const body = raw.length > 256 ? 'sha256:' + createHash('sha256').update(raw).digest('hex') : raw;
    return String(name) + ':' + body;
  } catch {
    return String(name) + ':<unserializable>';
  }
}

export function resultFingerprint(value) {
  try {
    const raw = stableJson(value);
    return raw.length > 256 ? 'sha256:' + createHash('sha256').update(raw).digest('hex') : raw;
  } catch {
    return '<unserializable-result>';
  }
}

export function safeCallSummary(name, args) {
  return {
    tool: String(name),
    arguments: safeLogValue(args),
  };
}

function hasOwn(object, key) {
  return object !== null && typeof object === 'object' && Object.prototype.hasOwnProperty.call(object, key);
}

function outcomeFromExecution(execution) {
  const data = execution?.data;
  const hasResult = hasOwn(execution, 'result') || hasOwn(execution, 'output')
    || hasOwn(data, 'result') || hasOwn(data, 'output') || hasOwn(execution, 'error');
  if (!hasResult) return { known: false, successful: false, resultFingerprint: '<unknown>', progressToken: '<unknown>' };
  const value = execution?.result ?? execution?.output ?? data?.result ?? data?.output
    ?? (hasOwn(execution, 'error') ? { error: execution.error } : undefined);
  const failed = (execution?.error != null && execution?.error !== false)
    || value?.isError === true
    || value?.success === false
    || value?.ok === false
    || (value?.error != null && value?.error !== false);
  const explicitProgress = execution?.progressToken ?? execution?.progress ?? execution?.stateVersion
    ?? data?.progressToken ?? data?.progress ?? data?.stateVersion;
  return {
    known: true,
    successful: !failed,
    resultFingerprint: resultFingerprint(value),
    progressToken: explicitProgress === undefined ? resultFingerprint(value) : resultFingerprint(explicitProgress),
  };
}

export class LoopGuardState {
  constructor(config = {}) {
    const progressToolNames = Array.isArray(config.progressToolNames)
      ? config.progressToolNames
        .filter((name) => typeof name === 'string' && name.trim() !== '')
        .map((name) => name.trim())
      : ['todo_write'];
    const strictTools = Array.isArray(config.strictTools)
      ? config.strictTools
        .filter((name) => typeof name === 'string' && name.trim() !== '')
        .map((name) => name.trim())
      : [];
    this.config = {
      ...config,
      maxToolAttemptsPerTurn: nonNegativeInteger(config.maxToolAttemptsPerTurn, 64),
      maxProgressToolCallsPerTurn: positiveInteger(config.maxProgressToolCallsPerTurn, 16),
      maxCallsPerRepeatGroup: positiveInteger(config.maxCallsPerRepeatGroup, 5),
      strictToolLimit: positiveInteger(config.strictToolLimit, 3),
      dryRunMode: Boolean(config.dryRunMode),
      blockExactDuplicates: config.blockExactDuplicates !== undefined ? Boolean(config.blockExactDuplicates) : true,
    };
    this.logger = config.logger;
    this.onViolation = typeof config.onViolation === 'function' ? config.onViolation : undefined;
    this.progressToolNames = new Set(progressToolNames);
    this.strictTools = new Set(strictTools);
    this.byAgent = new Map();
    this.objectKeys = new WeakMap();
    this.nextObjectKey = 1;

    this.metrics = {
      totalViolations: 0,
      byCode: {
        LOOP_GUARD_STOP: 0,
        LOOP_GUARD_DUPLICATE: 0,
        LOOP_GUARD_REPEAT: 0,
        LOOP_GUARD_LIMIT: 0,
        LOOP_GUARD_PROGRESS_LIMIT: 0,
        LOOP_GUARD_OUTPUT: 0,
      },
      lastViolation: null,
    };
  }

  updateConfig(config = {}) {
    const progressToolNames = Array.isArray(config.progressToolNames)
      ? config.progressToolNames
        .filter((name) => typeof name === 'string' && name.trim() !== '')
        .map((name) => name.trim())
      : Array.from(this.progressToolNames);
    const strictTools = Array.isArray(config.strictTools)
      ? config.strictTools
        .filter((name) => typeof name === 'string' && name.trim() !== '')
        .map((name) => name.trim())
      : Array.from(this.strictTools);
    this.config = {
      ...this.config,
      ...config,
      maxToolAttemptsPerTurn: nonNegativeInteger(config.maxToolAttemptsPerTurn, this.config.maxToolAttemptsPerTurn ?? 64),
      maxProgressToolCallsPerTurn: positiveInteger(config.maxProgressToolCallsPerTurn, this.config.maxProgressToolCallsPerTurn ?? 16),
      maxCallsPerRepeatGroup: positiveInteger(config.maxCallsPerRepeatGroup ?? config.maxCallsPerToolPerTurn, this.config.maxCallsPerRepeatGroup ?? 5),
      strictToolLimit: positiveInteger(config.strictToolLimit, this.config.strictToolLimit ?? 3),
      dryRunMode: config.dryRunMode !== undefined ? Boolean(config.dryRunMode) : Boolean(this.config.dryRunMode),
      blockExactDuplicates: config.blockExactDuplicates !== undefined ? Boolean(config.blockExactDuplicates) : this.config.blockExactDuplicates,
    };
    if (config.logger !== undefined) this.logger = config.logger;
    this.progressToolNames = new Set(progressToolNames);
    this.strictTools = new Set(strictTools);
  }

  recordExternalViolation(code, detail, extra = {}) {
    this.metrics.totalViolations += 1;
    this.metrics.byCode[code] = (this.metrics.byCode[code] || 0) + 1;
    this.metrics.lastViolation = {
      code,
      tool: extra.tool || 'assistant/output',
      timestamp: Date.now(),
      turn: extra.turn,
      reason: detail,
    };
  }

  getTelemetry() {
    return {
      ...this.metrics,
      activeAgents: this.byAgent.size,
      dryRunMode: Boolean(this.config.dryRunMode),
    };
  }

  resetTelemetry() {
    this.metrics.totalViolations = 0;
    for (const k of Object.keys(this.metrics.byCode)) {
      this.metrics.byCode[k] = 0;
    }
    this.metrics.lastViolation = null;
  }

  disposeSession(sessionId) {
    if (sessionId === undefined || sessionId === null) return;
    const id = typeof sessionId === 'object' ? (sessionId.id ?? sessionId) : sessionId;
    const str = String(id);
    this.byAgent.delete('session:' + str);
    this.byAgent.delete(str);
  }

  agentKey(agent) {
    if (agent !== null && typeof agent === 'object') {
      const sessionId = agent.session?.id ?? agent.session?.header?.id ?? agent.id;
      if (typeof sessionId === 'string' && sessionId.length > 0) return 'session:' + sessionId;
      let key = this.objectKeys.get(agent);
      if (key === undefined) {
        key = 'object:' + this.nextObjectKey++;
        this.objectKeys.set(agent, key);
      }
      return key;
    }
    return 'agent:' + String(agent ?? 'unknown');
  }

  emptyState(turn = undefined) {
    return {
      turn,
      attemptsSinceProgress: 0,
      progressAttemptsSinceProgress: 0,
      calls: [],
      nextCallKey: 1,
      stopRequested: false,
      answerOnly: false,
      stopReason: '',
      blockReason: undefined,
      progressEpoch: 0,
      repeatGroups: new Map(),
      exactGroups: new Map(),
      lastResults: new Map(),
      lastProgress: undefined,
      lastEvidence: undefined,
    };
  }

  beginTurn(agent, turn, stopRequested) {
    const key = this.agentKey(agent);
    const prior = this.byAgent.get(key);
    if (prior === undefined || prior.turn !== turn) {
      const next = this.emptyState(turn);
      next.stopRequested = Boolean(stopRequested);
      if (stopRequested) next.blockReason = 'LOOP_GUARD_STOP';
      this.byAgent.set(key, next);
      return;
    }
    if (stopRequested) {
      prior.stopRequested = true;
      prior.blockReason = 'LOOP_GUARD_STOP';
    }
  }

  stateFor(agent) {
    const key = this.agentKey(agent);
    let state = this.byAgent.get(key);
    if (state === undefined) {
      state = this.emptyState();
      this.byAgent.set(key, state);
    }
    return state;
  }

  findCall(state, callId) {
    if (typeof callId === 'string' && callId.length > 0) {
      const exact = state.calls.findLast((call) => call.id === callId && !call.released);
      if (exact !== undefined) return exact;
    }
    return state.calls.findLast((call) => !call.released && !call.resultSeen);
  }

  decrementReservations(state, call) {
    if (!call || !call.counted || call.committed) return;
    state.attemptsSinceProgress = Math.max(0, state.attemptsSinceProgress - 1);
    if (call.isProgressTool) state.progressAttemptsSinceProgress = Math.max(0, state.progressAttemptsSinceProgress - 1);
    if (call.repeatFingerprint) {
      const group = state.repeatGroups.get(call.repeatFingerprint);
      if (group && group.progressEpoch === state.progressEpoch && group.count > 0) {
        group.count = Math.max(0, group.count - 1);
      }
    }
    if (call.fingerprint) {
      const exact = state.exactGroups.get(call.fingerprint);
      if (exact && exact.progressEpoch === state.progressEpoch && exact.count > 0) {
        exact.count = Math.max(0, exact.count - 1);
      }
    }
  }

  violation(state, agent, name, args, callId, code, detail) {
    this.metrics.totalViolations += 1;
    this.metrics.byCode[code] = (this.metrics.byCode[code] || 0) + 1;
    this.metrics.lastViolation = {
      code,
      tool: String(name),
      timestamp: Date.now(),
      turn: state.turn,
      reason: detail,
    };

    const summary = safeCallSummary(name, args);
    const event = {
      code,
      reason: detail,
      callId: typeof callId === 'string' ? callId : undefined,
      agent: this.agentKey(agent),
      progressEpoch: state.progressEpoch,
      attemptsSinceProgress: state.attemptsSinceProgress,
      progressAttemptsSinceProgress: state.progressAttemptsSinceProgress,
      lastProgress: state.lastProgress,
      dryRun: Boolean(this.config.dryRunMode),
      ...summary,
    };
    try {
      this.onViolation?.(event);
    } catch (error) {
      this.logger?.debug?.('dsh-agent-loop-guard: onViolation callback failed: ' + (error instanceof Error ? error.message : String(error)));
    }

    if (this.config.dryRunMode) {
      return undefined;
    }

    state.answerOnly = true;
    state.stopReason = code + ': ' + detail;
    if (!state.blockReason) {
      state.blockReason = code;
    }

    let guidance = 'ACTION REQUIRED: ';
    if (code === 'LOOP_GUARD_STOP') {
      guidance += 'User requested stop. Do NOT invoke further tools. Synthesize your final answer in plain text.';
    } else if (code === 'LOOP_GUARD_DUPLICATE') {
      guidance += `Tool "${name}" was called with identical arguments without producing new results. Stop repeating this action. Analyze the previous output, alter your parameters, try a different tool, or synthesize a direct textual answer.`;
    } else if (code === 'LOOP_GUARD_REPEAT') {
      guidance += `Tool "${name}" reached repetition limit without progress. Switch to an alternative exploration approach or answer directly.`;
    } else if (code === 'LOOP_GUARD_PROGRESS_LIMIT') {
      guidance += `Progress tool "${name}" repeatedly called without task changes. Stop updating task lists and proceed to execute or respond.`;
    } else if (code === 'LOOP_GUARD_LIMIT') {
      guidance += `Turn budget of ${this.config.maxToolAttemptsPerTurn} non-productive attempts exhausted. Cease tool execution and explain current progress or roadblock to the user.`;
    } else {
      guidance += 'Cease tool execution and provide a final text response. The next user turn will reset this guard.';
    }

    return `[${code}] ${detail}. No productive progress was observed; provide the final text answer now. ${guidance}`;
  }

  denyReason(agent, name, args, callId) {
    const state = this.stateFor(agent);
    if (state.stopRequested) {
      return this.violation(state, agent, name, args, callId, 'LOOP_GUARD_STOP', 'user requested stop; tools are disabled for this turn');
    }
    if (state.answerOnly) {
      const code = state.blockReason || 'LOOP_GUARD_STOP';
      return this.violation(state, agent, name, args, callId, code, state.stopReason || 'previous guard violation requires a text answer');
    }
    const fingerprint = callFingerprint(name, args);
    const repeatFingerprint = callRepeatFingerprint(name, args);
    const repeatGroup = state.repeatGroups.get(repeatFingerprint);
    const exactGroup = state.exactGroups.get(fingerprint);
    const repeatCount = repeatGroup?.progressEpoch === state.progressEpoch ? repeatGroup.count : 0;
    const exactCount = exactGroup?.progressEpoch === state.progressEpoch ? exactGroup.count : 0;

    const isStrictTool = this.strictTools.has(String(name));
    const maxRepeats = isStrictTool ? this.config.strictToolLimit : this.config.maxCallsPerRepeatGroup;

    if (this.config.blockExactDuplicates && exactCount >= 1) {
      return this.violation(state, agent, name, args, callId, 'LOOP_GUARD_DUPLICATE', 'identical tool call repeated without a new result or state change after ' + exactCount + ' attempts');
    }

    if (repeatCount >= maxRepeats) {
      const code = (this.config.blockExactDuplicates && exactCount >= maxRepeats) ? 'LOOP_GUARD_DUPLICATE' : 'LOOP_GUARD_REPEAT';
      return this.violation(state, agent, name, args, callId, code, 'near-identical tool call repeated without a new result or state change after ' + repeatCount + ' attempts');
    }
    const isProgressTool = this.progressToolNames.has(String(name));
    if (isProgressTool) {
      if (state.progressAttemptsSinceProgress >= this.config.maxProgressToolCallsPerTurn) {
        return this.violation(state, agent, name, args, callId, 'LOOP_GUARD_PROGRESS_LIMIT', 'progress/state tool budget exhausted without productive progress');
      }
    } else if (this.config.maxToolAttemptsPerTurn > 0 && state.attemptsSinceProgress >= this.config.maxToolAttemptsPerTurn) {
      return this.violation(state, agent, name, args, callId, 'LOOP_GUARD_LIMIT', 'tool budget exhausted without productive progress');
    }
    const id = typeof callId === 'string' && callId.length > 0 ? callId : 'anonymous-' + String(state.nextCallKey++);
    const priorRepeat = state.repeatGroups.get(repeatFingerprint);
    const priorExact = state.exactGroups.get(fingerprint);
    state.repeatGroups.set(repeatFingerprint, {
      count: (priorRepeat?.progressEpoch === state.progressEpoch ? priorRepeat.count : 0) + 1,
      progressEpoch: state.progressEpoch,
    });
    state.exactGroups.set(fingerprint, {
      count: (priorExact?.progressEpoch === state.progressEpoch ? priorExact.count : 0) + 1,
      progressEpoch: state.progressEpoch,
    });
    const call = {
      id,
      fingerprint,
      repeatFingerprint,
      isProgressTool,
      pending: true,
      committed: false,
      released: false,
      counted: true,
      resultSeen: false,
    };
    state.calls.push(call);
    state.attemptsSinceProgress += 1;
    if (isProgressTool) state.progressAttemptsSinceProgress += 1;
    return undefined;
  }

  commitCall(agent, callId) {
    const state = this.stateFor(agent);
    const call = this.findCall(state, callId);
    if (call !== undefined) {
      call.pending = false;
      call.committed = true;
    }
  }

  recordResult(agent, execution = {}) {
    const state = this.stateFor(agent);
    const call = this.findCall(state, execution.callId);
    if (call === undefined) return { known: false, productive: false };
    if (call.pending && !call.committed) {
      call.released = true;
      this.decrementReservations(state, call);
      return { known: false, productive: false };
    }
    const outcome = outcomeFromExecution(execution);
    call.pending = false;
    call.committed = true;
    call.resultSeen = true;
    call.resultFingerprint = outcome.resultFingerprint;
    call.progressToken = outcome.progressToken;
    const prior = state.lastEvidence;
    const priorForCall = state.lastResults.get(call.repeatFingerprint);
    const resultUnchangedForCall = priorForCall !== undefined
      && priorForCall.resultFingerprint === outcome.resultFingerprint
      && priorForCall.progressToken === outcome.progressToken;
    const productive = outcome.known && outcome.successful
      && !resultUnchangedForCall
      && (prior === undefined
        || prior.resultFingerprint !== outcome.resultFingerprint
        || prior.progressToken !== outcome.progressToken);
    call.productive = productive;
    state.lastResults.set(call.repeatFingerprint, outcome);
    if (productive) {
      state.lastEvidence = outcome;
      state.progressEpoch += 1;
      state.attemptsSinceProgress = 0;
      state.progressAttemptsSinceProgress = 0;
      state.repeatGroups.clear();
      state.exactGroups.clear();
      state.lastProgress = {
        callId: call.id,
        tool: call.fingerprint.split(':', 1)[0],
        resultFingerprint: outcome.resultFingerprint,
        progressToken: outcome.progressToken,
      };
    }
    return { known: outcome.known, productive };
  }
}
