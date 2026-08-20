const STOP_REQUEST_PATTERN = /(?:\b(?:stop|halt|cancel|answer(?:\s+now)?)\b|останов(?:ись|ить)|прекрати|хватит|ответь|петл[яиюе])/iu;

function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
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

function normalizedJson(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'string') return JSON.stringify(value.trim().replace(/\s+/gu, ' '));
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(normalizedJson).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + normalizedJson(value[key])).join(',') + '}';
}

export function callRepeatFingerprint(name, args) {
  try { return String(name) + ':' + normalizedJson(args); }
  catch { return String(name) + ':<unserializable>'; }
}

export class LoopGuardState {
  constructor(config) {
    const progressToolNames = Array.isArray(config.progressToolNames)
      ? config.progressToolNames
        .filter((name) => typeof name === 'string' && name.trim() !== '')
        .map((name) => name.trim())
      : ['todo_write'];
    this.config = {
      ...config,
      maxToolAttemptsPerTurn: nonNegativeInteger(config.maxToolAttemptsPerTurn, 64),
      maxProgressToolCallsPerTurn: positiveInteger(config.maxProgressToolCallsPerTurn, 16),
    };
    this.progressToolNames = new Set(progressToolNames);
    this.byAgent = new Map();
    this.objectKeys = new WeakMap();
    this.nextObjectKey = 1;
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

  beginTurn(agent, turn, stopRequested) {
    const key = this.agentKey(agent);
    const prior = this.byAgent.get(key);
    if (prior === undefined || prior.turn !== turn) {
      this.byAgent.set(key, {
        turn,
        attempts: 0,
        progressAttempts: 0,
        calls: [],
        nextCallKey: 1,
        stopRequested: Boolean(stopRequested),
      });
      return;
    }
    if (stopRequested) prior.stopRequested = true;
  }

  stateFor(agent) {
    const key = this.agentKey(agent);
    let state = this.byAgent.get(key);
    if (state === undefined) {
      state = {
        turn: -1,
        attempts: 0,
        progressAttempts: 0,
        calls: [],
        nextCallKey: 1,
        stopRequested: false,
      };
      this.byAgent.set(key, state);
    }
    return state;
  }

  activeCalls(state) {
    return state.calls.filter((call) => !call.released);
  }

  trailingCount(calls, property, value) {
    let count = 0;
    for (let index = calls.length - 1; index >= 0; index -= 1) {
      if (calls[index][property] !== value) break;
      count += 1;
    }
    return count;
  }

  denyReason(agent, name, args, callId) {
    const state = this.stateFor(agent);
    if (state.stopRequested) return 'LOOP_GUARD_STOP: user asked to stop; do not run tools and provide the final text answer now.';
    const fingerprint = callFingerprint(name, args);
    const repeatFingerprint = callRepeatFingerprint(name, args);
    const activeCalls = this.activeCalls(state);
    const exactCallsInRun = this.trailingCount(activeCalls, 'fingerprint', fingerprint);
    const repeatCallsInRun = this.trailingCount(activeCalls, 'repeatFingerprint', repeatFingerprint);
    if (repeatCallsInRun >= this.config.maxCallsPerRepeatGroup) {
      if (this.config.blockExactDuplicates && exactCallsInRun >= this.config.maxCallsPerRepeatGroup) {
        return 'LOOP_GUARD_DUPLICATE: exact repeated tool call blocked after the allowed consecutive attempts; use the previous result and answer the user.';
      }
      return 'LOOP_GUARD_REPEAT: near-identical tool calls were blocked after the allowed consecutive attempts; stop the loop and answer with available evidence.';
    }
    const isProgressTool = this.progressToolNames.has(String(name));
    if (isProgressTool) {
      if (activeCalls.filter((call) => call.isProgressTool).length >= this.config.maxProgressToolCallsPerTurn) {
        return 'LOOP_GUARD_PROGRESS_LIMIT: progress/state-tool limit reached; continue the work without repeatedly rewriting progress state.';
      }
    } else if (this.config.maxToolAttemptsPerTurn > 0 && activeCalls.filter((call) => !call.isProgressTool).length >= this.config.maxToolAttemptsPerTurn) {
      return 'LOOP_GUARD_LIMIT: tool-call limit reached; stop researching and provide a concise final text answer.';
    }
    const id = typeof callId === 'string' && callId.length > 0 ? callId : `anonymous-${state.nextCallKey++}`;
    state.calls.push({
      id,
      fingerprint,
      repeatFingerprint,
      isProgressTool,
      pending: true,
      released: false,
    });
    return undefined;
  }

  commitCall(agent, callId) {
    if (typeof callId !== 'string' || callId.length === 0) return;
    const state = this.stateFor(agent);
    const call = [...state.calls].reverse().find((candidate) => candidate.id === callId && !candidate.released);
    if (call !== undefined) call.pending = false;
  }

  releaseCall(agent, callId) {
    if (typeof callId !== 'string' || callId.length === 0) return;
    const state = this.stateFor(agent);
    const call = [...state.calls].reverse().find((candidate) => candidate.id === callId && candidate.pending && !candidate.released);
    if (call !== undefined) call.released = true;
  }
}

