import { createHash } from 'node:crypto';
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

export function normalizeAssistantBlock(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => normalizeAssistantLine(line))
    .filter((line) => line !== '')
    .join('\n');
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
    this.maxRepeatedAssistantBlocks = positiveOutputLimit(config.maxRepeatedAssistantBlocks, 5);
    this.maxAssistantBlockChars = positiveOutputLimit(config.maxAssistantBlockChars, 16_384);
    this.bySession = new Map();
  }

  updateConfig(config = {}) {
    if (config.maxRepeatedAssistantLines !== undefined) {
      this.maxRepeatedAssistantLines = positiveOutputLimit(config.maxRepeatedAssistantLines, this.maxRepeatedAssistantLines);
    }
    if (config.maxRepeatedAssistantBlocks !== undefined) {
      this.maxRepeatedAssistantBlocks = positiveOutputLimit(config.maxRepeatedAssistantBlocks, this.maxRepeatedAssistantBlocks);
    }
    if (config.maxAssistantBlockChars !== undefined) {
      this.maxAssistantBlockChars = positiveOutputLimit(config.maxAssistantBlockChars, this.maxAssistantBlockChars);
    }
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
        blockText: '',
        blockFinalized: false,
        lastBlock: '',
        blockRepeatCount: 0,
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
      state.blockText = '';
      state.blockHasher = createHash('sha256');
      state.blockFullHash = undefined;
      state.blockOversized = false;
      state.blockFinalized = false;
    }
    return state;
  }

  resetStreak(session) {
    const state = this.stateFor(session);
    state.pending = '';
    state.streamedText = '';
    state.streamedSkipAvailable = false;
    state.blockText = '';
    state.blockHasher = null;
    state.blockFullHash = undefined;
    state.blockOversized = false;
    state.blockFinalized = false;
    state.lastBlock = '';
    state.lastBlockKey = '';
    state.blockRepeatCount = 0;
    state.lastLine = '';
    state.repeatCount = 0;
  }

  resetForUser(session) {
    const state = this.stateFor(session);
    state.pending = '';
    state.streamedText = '';
    state.streamedSkipAvailable = false;
    state.blockText = '';
    state.blockHasher = null;
    state.blockFullHash = undefined;
    state.blockOversized = false;
    state.blockFinalized = false;
    state.lastBlock = '';
    state.lastBlockKey = '';
    state.blockRepeatCount = 0;
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
    if (!state.blockHasher) {
      state.blockHasher = createHash('sha256');
    }
    state.blockHasher.update(text);
    state.streamedText += text;
    if (state.blockText.length + text.length > this.maxAssistantBlockChars) {
      state.blockOversized = true;
      state.blockText = (state.blockText + text).slice(-this.maxAssistantBlockChars);
    } else {
      state.blockText += text;
    }
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

  observeBlock(session, block, fullHash = undefined) {
    const state = this.stateFor(session);
    const normalized = normalizeAssistantBlock(block);
    if (normalized === '' || !normalized.includes('\n') || state.activeTools.size > 0 || state.triggered) return undefined;
    const key = fullHash ? 'hash:' + fullHash : normalized;
    if (key === state.lastBlockKey) {
      state.blockRepeatCount += 1;
    } else {
      state.lastBlockKey = key;
      state.lastBlock = normalized;
      state.blockRepeatCount = 1;
    }
    if (state.blockRepeatCount >= this.maxRepeatedAssistantBlocks) {
      state.triggered = true;
      return {
        count: state.blockRepeatCount,
        block: normalized,
        reason: 'LOOP_GUARD_ASSISTANT_BLOCK: repeated assistant text block detected; generation cancelled and pending inbox cleared.',
      };
    }
    return undefined;
  }

  finalizeBlock(session) {
    const state = this.stateFor(session);
    if (state.blockFinalized) return undefined;
    state.blockFinalized = true;
    if (state.blockOversized && state.blockHasher && !state.blockFullHash) {
      try {
        state.blockFullHash = state.blockHasher.digest('hex');
      } catch {
        // already digested
      }
      state.blockHasher = null;
    }
    return this.observeBlock(session, state.blockText, state.blockFullHash);
  }

  observeMessage(session, { id, turn, step, index = 0, text } = {}) {
    if (typeof text !== 'string' || text.length === 0) return undefined;
    const state = this.beginBlock(session, turn, step, index);
    const key = id === undefined || id === null
      ? String(turn ?? 'u') + ':' + String(step ?? 's') + ':' + normalizeAssistantBlock(text)
      : String(id);
    if (state.seenMessages.has(key)) return undefined;
    state.seenMessages.add(key);
    const prior = state.streamedText;
    if (prior === text && state.streamedSkipAvailable) {
      state.streamedSkipAvailable = false;
      return this.finalizeBlock(session);
    }
    const suffix = prior.length > 0 && prior !== text && text.startsWith(prior) ? text.slice(prior.length) : text;
    const hit = this.observeText(session, { turn, step, index, text: suffix });
    state.streamedText = text;
    state.streamedSkipAvailable = false;
    if (hit) return hit;
    return this.finalizeBlock(session);
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
    const hit = this.flushPending(session);
    if (hit) return hit;
    return this.finalizeBlock(session);
  }

  endStep(session) {
    return this.endBlock(session);
  }

  endTurn(session) {
    return this.endBlock(session);
  }

  dispose(session) {
    this.bySession.delete(sessionKey(session));
  }
}
