const STOP_REQUEST_PATTERN = /(?:\b(?:stop|halt|cancel|answer(?:\s+now)?)\b|останов(?:ись|ить)|прекрати|хватит|ответь|петл[яиюе])/iu;
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
  try { return String(name) + ':' + stableJson(args); }
  catch { return String(name) + ':<unserializable>'; }
}

export function callRepeatFingerprint(name, args) {
  try { return String(name) + ':' + normalizedJson(args); }
  catch { return String(name) + ':<unserializable>'; }
}

export function resultFingerprint(value) {
  try { return stableJson(value); }
  catch { return '<unserializable-result>'; }
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
  const failed = execution?.error !== undefined
    || value?.isError === true
    || value?.success === false
    || value?.ok === false
    || value?.error !== undefined;
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
    this.config = {
      ...config,
      maxToolAttemptsPerTurn: nonNegativeInteger(config.maxToolAttemptsPerTurn, 64),
      maxProgressToolCallsPerTurn: positiveInteger(config.maxProgressToolCallsPerTurn, 16),
      maxCallsPerRepeatGroup: positiveInteger(config.maxCallsPerRepeatGroup, 5),
    };
    this.onViolation = typeof config.onViolation === 'function' ? config.onViolation : undefined;
    this.progressToolNames = new Set(progressToolNames);
    this.byAgent = new Map();
    this.objectKeys = new WeakMap();
    this.nextObjectKey = 1;
  }

  updateConfig(config = {}) {
    const progressToolNames = Array.isArray(config.progressToolNames)
      ? config.progressToolNames
        .filter((name) => typeof name === 'string' && name.trim() !== '')
        .map((name) => name.trim())
      : ['todo_write'];
    this.config = {
      ...this.config,
      ...config,
      maxToolAttemptsPerTurn: nonNegativeInteger(config.maxToolAttemptsPerTurn, this.config.maxToolAttemptsPerTurn ?? 64),
      maxProgressToolCallsPerTurn: positiveInteger(config.maxProgressToolCallsPerTurn, this.config.maxProgressToolCallsPerTurn ?? 16),
      maxCallsPerRepeatGroup: positiveInteger(config.maxCallsPerRepeatGroup ?? config.maxCallsPerToolPerTurn, this.config.maxCallsPerRepeatGroup ?? 5),
      blockExactDuplicates: config.blockExactDuplicates !== undefined ? Boolean(config.blockExactDuplicates) : this.config.blockExactDuplicates,
    };
    this.progressToolNames = new Set(progressToolNames);
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
      this.byAgent.set(key, next);
      return;
    }
    if (stopRequested) prior.stopRequested = true;
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
      const exact = [...state.calls].reverse().find((call) => call.id === callId && !call.released);
      if (exact !== undefined) return exact;
    }
    return [...state.calls].reverse().find((call) => !call.released && !call.resultSeen);
  }

  decrementReservations(state, call) {
    if (!call || !call.counted || call.committed) return;
    state.attemptsSinceProgress = Math.max(0, state.attemptsSinceProgress - 1);
    if (call.isProgressTool) state.progressAttemptsSinceProgress = Math.max(0, state.progressAttemptsSinceProgress - 1);
  }

  violation(state, agent, name, args, callId, code, detail) {
    state.answerOnly = true;
    state.stopReason = code + ': ' + detail;
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
      ...summary,
    };
    try { this.onViolation?.(event); } catch {}
    return code + ': ' + detail
      + ' No productive progress was observed; provide the final text answer now. The next turn resets this guard.';
  }

  denyReason(agent, name, args, callId) {
    const state = this.stateFor(agent);
    if (state.stopRequested) {
      return this.violation(state, agent, name, args, callId, 'LOOP_GUARD_STOP', 'user requested stop; tools are disabled for this turn');
    }
    if (state.answerOnly) {
      return this.violation(state, agent, name, args, callId, 'LOOP_GUARD_STOP', state.stopReason || 'previous guard violation requires a text answer');
    }
    const fingerprint = callFingerprint(name, args);
    const repeatFingerprint = callRepeatFingerprint(name, args);
    const repeatGroup = state.repeatGroups.get(repeatFingerprint);
    const exactGroup = state.exactGroups.get(fingerprint);
    const repeatCount = repeatGroup?.progressEpoch === state.progressEpoch ? repeatGroup.count : 0;
    const exactCount = exactGroup?.progressEpoch === state.progressEpoch ? exactGroup.count : 0;
    if (repeatCount >= this.config.maxCallsPerRepeatGroup) {
      if (this.config.blockExactDuplicates && exactCount >= this.config.maxCallsPerRepeatGroup) {
        return this.violation(state, agent, name, args, callId, 'LOOP_GUARD_DUPLICATE', 'identical tool call repeated without a new result or state change after ' + repeatCount + ' attempts');
      }
      return this.violation(state, agent, name, args, callId, 'LOOP_GUARD_REPEAT', 'near-identical tool call repeated without a new result or state change after ' + repeatCount + ' attempts');
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
    const productive = outcome.known && outcome.successful
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

  releaseCall(agent, callId) {
    const state = this.stateFor(agent);
    const call = this.findCall(state, callId);
    if (call === undefined) return;
    call.released = true;
    this.decrementReservations(state, call);
  }
}
