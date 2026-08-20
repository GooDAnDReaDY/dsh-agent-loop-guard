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
        lastLine: '',
        repeatCount: 0,
        activeTools: new Set(),
        triggered: false,
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
      state.lastLine = '';
      state.repeatCount = 0;
      state.triggered = false;
    }
    return state;
  }

  resetText(session) {
    const state = this.stateFor(session);
    state.pending = '';
    state.lastLine = '';
    state.repeatCount = 0;
    state.triggered = false;
  }

  observeText(session, { turn, step, index = 0, text } = {}) {
    if (typeof text !== 'string' || text.length === 0) return undefined;
    const state = this.beginBlock(session, turn, step, index);
    if (state.activeTools.size > 0) {
      this.resetText(session);
      return undefined;
    }
    if (state.triggered) return undefined;

    state.pending += text;
    const lines = state.pending.split(/\n/gu);
    state.pending = lines.pop() ?? '';
    for (const line of lines) {
      const normalized = normalizeAssistantLine(line);
      if (normalized === '') continue;
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
          reason: 'LOOP_GUARD_ASSISTANT_OUTPUT: repeated assistant text detected; generation cancelled, preserve the previous evidence and answer concisely.',
        };
      }
    }
    return undefined;
  }

  markToolCall(session, callId) {
    const state = this.stateFor(session);
    if (typeof callId === 'string' && callId.length > 0) state.activeTools.add(callId);
    this.resetText(session);
  }

  markToolResult(session, callId) {
    const state = this.stateFor(session);
    if (typeof callId === 'string' && callId.length > 0) state.activeTools.delete(callId);
  }

  hasActiveTool(session) {
    return this.stateFor(session).activeTools.size > 0;
  }

  endBlock(session) {
    this.resetText(session);
  }

  endStep(session) {
    const state = this.stateFor(session);
    state.activeTools.clear();
    this.resetText(session);
  }

  dispose(session) {
    this.bySession.delete(sessionKey(session));
  }
}
