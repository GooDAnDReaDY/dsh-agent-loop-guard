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

export function hasStopRequest(messages) {
  if (!Array.isArray(messages)) return false;
  return messages.some((message) => message?.source?.kind === 'user' && STOP_REQUEST_PATTERN.test(textFrom(message.content)));
}

export function callFingerprint(name, args) {
  try { return String(name) + ':' + stableJson(args); }
  catch { return String(name) + ':<unserializable>'; }
}

export class LoopGuardState {
  constructor(config) {
    this.config = config;
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
      this.byAgent.set(key, { turn, attempts: 0, callsByName: new Map(), fingerprints: new Set(), stopRequested: Boolean(stopRequested) });
      return;
    }
    if (stopRequested) prior.stopRequested = true;
  }

  denyReason(agent, name, args) {
    const key = this.agentKey(agent);
    let state = this.byAgent.get(key);
    if (state === undefined) {
      state = { turn: -1, attempts: 0, callsByName: new Map(), fingerprints: new Set(), stopRequested: false };
      this.byAgent.set(key, state);
    }
    state.attempts += 1;
    if (state.stopRequested) return 'LOOP_GUARD_STOP: user asked to stop; do not run tools and provide the final text answer now.';
    if (state.attempts > this.config.maxToolAttemptsPerTurn) return 'LOOP_GUARD_LIMIT: tool-call limit reached; stop researching and provide a concise final text answer.';
    const fingerprint = callFingerprint(name, args);
    if (this.config.blockExactDuplicates && state.fingerprints.has(fingerprint)) return 'LOOP_GUARD_DUPLICATE: exact repeated tool call blocked; use the previous result and answer the user.';
    const callsForTool = (state.callsByName.get(String(name)) ?? 0) + 1;
    if (callsForTool > this.config.maxCallsPerToolPerTurn) return 'LOOP_GUARD_REPEAT: repeated use of this tool was blocked; stop the loop and answer with available evidence.';
    state.fingerprints.add(fingerprint);
    state.callsByName.set(String(name), callsForTool);
    return undefined;
  }
}
