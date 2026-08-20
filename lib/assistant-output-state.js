function sessionKey(session) {
  if (typeof session === 'string' && session.length > 0) return session;
  if (session !== null && typeof session === 'object') {
    const id = session.id ?? session.session?.id ?? session.header?.id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  return String(session ?? 'unknown');
}

export function normalizeAssistantLine(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r/gu, '').replace(/\s+/gu, ' ').trim();
}

export function positiveOutputLimit(value, fallback) {
  return Number.isSafeInteger(value) && value >= 1 ? value : fallback;
}

export function assistantTextFromMessage(message) {
  const content = message?.content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => block !== null
      && typeof block === 'object'
      && block.type === 'text'
      && typeof block.text === 'string')
    .map((block) => block.text)
    .join('');
}

export class AssistantOutputGuardState {
  constructor(config = {}) {
    this.maxRepeatedAssistantLines = positiveOutputLimit(config.maxRepeatedAssistantLines, 5);
    this.bySession = new Map();
  }

  stateFor(session) {
    const key = sessionKey(session);
    let state = this.bySession.get(key);
    if (state === undefined) {
      state = {
        turn: undefined,
        step: undefined,
        index: undefined,
        pending: '',
        streamedText: '',
        streamedSkipAvailable: false,
        lastLine: '',
        repeatCount: 0,
        activeTools: new Set(),
        triggered: false,
        seenMessages: new Set(),
      };
      this.bySession.set(key, state);
    }
    return state;
  }

  beginBlock(session, turn, step, index = 0) {
    const state = this.stateFor(session);
    if (state.turn !== turn || state.step !== step || state.index !== index) {
      state.turn = turn;
      state.step = step;
      state.index = index;
      state.pending = '';
      state.streamedText = '';
      state.streamedSkipAvailable = false;
    }
    return state;
  }

  resetStreak(session) {
    const state = this.stateFor(session);
    state.pending = '';
    state.streamedText = '';
    state.streamedSkipAvailable = false;
    state.lastLine = '';
    state.repeatCount = 0;
  }

  resetForUser(session) {
    const state = this.stateFor(session);
    state.pending = '';
    state.streamedText = '';
    state.lastLine = '';
    state.repeatCount = 0;
    state.triggered = false;
    state.seenMessages.clear();
  }

  observeLine(session, line) {
    const state = this.stateFor(session);
    const normalized = normalizeAssistantLine(line);
    if (normalized === '' || state.activeTools.size > 0 || state.triggered) return undefined;
    if (normalized === state.lastLine) {
      state.repeatCount += 1;
    } else {
      state.lastLine = normalized;
      state.repeatCount = 1;
    }
    if (state.repeatCount >= this.maxRepeatedAssistantLines) {
      state.triggered = true;
      return {
        count: state.repeatCount,
        line: normalized,
        reason: 'LOOP_GUARD_ASSISTANT_OUTPUT: repeated assistant text detected; generation cancelled and pending inbox cleared.',
      };
    }
    return undefined;
  }

  observeText(session, { turn, step, index = 0, text } = {}) {
    if (typeof text !== 'string' || text.length === 0) return undefined;
    const state = this.beginBlock(session, turn, step, index);
    if (state.activeTools.size > 0 || state.triggered) return undefined;
    state.streamedText += text;
    state.streamedSkipAvailable = true;
    state.pending += text;
    const lines = state.pending.split(/\n/gu);
    state.pending = lines.pop() ?? '';
    for (const line of lines) {
      const hit = this.observeLine(session, line);
      if (hit) return hit;
    }
    return undefined;
  }

  observeMessage(session, { id, turn, step, index = 0, text } = {}) {
    if (typeof text !== 'string' || text.length === 0) return undefined;
    const state = this.beginBlock(session, turn, step, index);
    const key = id === undefined || id === null
      ? String(turn ?? 'u') + ':' + String(step ?? 's') + ':' + String(text.length)
      : String(id);
    if (state.seenMessages.has(key)) return undefined;
    state.seenMessages.add(key);
    const prior = state.streamedText;
    if (prior === text && state.streamedSkipAvailable) {
      state.streamedSkipAvailable = false;
      return undefined;
    }
    const suffix = prior.length > 0 && prior !== text && text.startsWith(prior) ? text.slice(prior.length) : text;
    const hit = this.observeText(session, { turn, step, index, text: suffix });
    state.streamedText = text;
    state.streamedSkipAvailable = false;
    return hit;
  }

  flushPending(session) {
    const state = this.stateFor(session);
    if (state.pending === '') return undefined;
    const pending = state.pending;
    state.pending = '';
    return this.observeLine(session, pending);
  }

  markToolCall(session, callId) {
    const state = this.stateFor(session);
    if (typeof callId === 'string' && callId.length > 0) state.activeTools.add(callId);
    this.resetStreak(session);
  }

  markToolResult(session, callId) {
    const state = this.stateFor(session);
    if (typeof callId === 'string' && callId.length > 0) state.activeTools.delete(callId);
  }

  hasActiveTool(session) {
    return this.stateFor(session).activeTools.size > 0;
  }

  hasTriggered(session) {
    return this.stateFor(session).triggered;
  }

  endBlock(session) {
    return this.flushPending(session);
  }

  endStep(session) {
    return this.flushPending(session);
  }

  endTurn(session) {
    return this.flushPending(session);
  }

  dispose(session) {
    this.bySession.delete(sessionKey(session));
  }
}
