import { createHash } from 'node:crypto';

const EXPLICIT_STOP_EN = /^(?:please\s+)?(?:stop|halt|cancel|abort|terminate)(?:\s+(?:now|please|immediately|execution|calling\s+tools|and\s+answer|and\s+explain))?[.!?]*$/iu;
const EXPLICIT_STOP_ZH = /^(?:请|检测到)?(?:停止|暂停|取消|终止|死循环)(?:执行|操作|调用|一下|了)?[!。？?！]*$/u;

export function isDefaultStopRequest(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  // Direct single-command match
  if (EXPLICIT_STOP_EN.test(trimmed) || EXPLICIT_STOP_ZH.test(trimmed)) {
    return true;
  }

  // Multi-sentence / multi-line message: check if any standalone segment/sentence is an explicit stop command
  const segments = trimmed.split(/[\r\n.!?。！？]+/).map((s) => s.trim()).filter(Boolean);
  for (const segment of segments) {
    if (EXPLICIT_STOP_EN.test(segment) || EXPLICIT_STOP_ZH.test(segment)) {
      return true;
    }
  }

  return false;
}

export function detectOscillation(sequence, maxRepeats = 3, minPeriod = 2, maxPeriod = 4) {
  if (!Array.isArray(sequence)) return null;
  const len = sequence.length;

  for (let period = minPeriod; period <= maxPeriod; period++) {
    const requiredLength = period * maxRepeats;
    if (len < requiredLength) continue;

    const sample = sequence.slice(len - period, len);
    const allSame = sample.every((item) => item === sample[0]);
    if (allSame) continue;

    let isMatch = true;
    for (let rep = 1; rep < maxRepeats; rep++) {
      for (let i = 0; i < period; i++) {
        const expected = sequence[len - period + i];
        const actual = sequence[len - (rep + 1) * period + i];
        if (expected !== actual) {
          isMatch = false;
          break;
        }
      }
      if (!isMatch) break;
    }

    if (isMatch) {
      return {
        period,
        repeats: maxRepeats,
        cycle: sample,
      };
    }
  }

  return null;
}

export const DEFAULT_PSEUDO_TOOL_PATTERNS = [
  /<(?:invoke|function_call|tool_call|call:)\b/iu,
  /<\/(?:invoke|function_call|tool_call)>/iu,
  /```(?:tool_call|invoke|function_call)\b/iu,
  /(?:\[TOOL_CALLS?\]|\[(?:TOOL_CALL|CALL):)/iu,
];

export function compilePseudoToolPatterns(customPatterns = []) {
  if (!Array.isArray(customPatterns)) return [];
  const compiled = [];
  for (const item of customPatterns) {
    if (item instanceof RegExp) {
      compiled.push(item);
    } else if (typeof item === 'string' && item.trim() !== '') {
      try {
        const match = /^\/(.+)\/([a-z]*)$/i.exec(item.trim());
        if (match) {
          compiled.push(new RegExp(match[1], match[2] || 'iu'));
        } else {
          const escaped = item.trim().replace(/[.*+?^${}()|[\]\\]/g, (m) => '\\' + m);
          compiled.push(new RegExp(escaped, 'iu'));
        }
      } catch {
        const escaped = item.trim().replace(/[.*+?^${}()|[\]\\]/g, (m) => '\\' + m);
        compiled.push(new RegExp(escaped, 'iu'));
      }
    }
  }
  return compiled;
}

export function isPseudoToolCallText(text, customPatterns = []) {
  if (!text || typeof text !== 'string') return false;
  for (const regex of DEFAULT_PSEUDO_TOOL_PATTERNS) {
    if (regex.test(text)) return true;
  }
  const compiled = compilePseudoToolPatterns(customPatterns);
  for (const regex of compiled) {
    if (regex.test(text)) return true;
  }
  return false;
}

export function compileStopPatterns(customPatterns = []) {
  if (!Array.isArray(customPatterns)) return [];
  const compiled = [];
  for (const item of customPatterns) {
    if (item instanceof RegExp) {
      compiled.push(item);
    } else if (typeof item === 'string' && item.trim() !== '') {
      const escaped = item.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      compiled.push(new RegExp(escaped, 'iu'));
    }
  }
  return compiled;
}

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

export function hasStopRequest(messages, customPatterns = []) {
  if (!Array.isArray(messages)) return false;
  const compiledCustom = compileStopPatterns(customPatterns);
  let lastUserMessage = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg && (msg.source?.kind === 'user' || msg.role === 'user')) {
      lastUserMessage = msg;
      break;
    }
  }
  if (!lastUserMessage) return false;

  const text = textFrom(lastUserMessage.content);
  if (!text) return false;

  if (isDefaultStopRequest(text)) {
    return true;
  }
  return compiledCustom.some((regex) => regex.test(text));
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

export function outcomeFromExecution(execution, maybeResult = undefined) {
  const result = maybeResult !== undefined ? maybeResult : execution?.result;
  const data = execution?.data;
  const hasResult = result !== undefined
    || hasOwn(execution, 'result')
    || hasOwn(execution, 'output')
    || hasOwn(data, 'result')
    || hasOwn(data, 'output')
    || hasOwn(execution, 'error')
    || hasOwn(execution, 'content')
    || hasOwn(execution, 'isError');
  if (!hasResult) return { known: false, successful: false, resultFingerprint: '<unknown>', progressToken: '<unknown>' };
  const value = result ?? execution?.output ?? data?.result ?? data?.output
    ?? (hasOwn(execution, 'error') ? { error: execution.error } : undefined);
  const failed = (execution?.error != null && execution?.error !== false)
    || execution?.isError === true
    || value?.isError === true
    || value?.success === false
    || value?.ok === false
    || (value?.error != null && value?.error !== false);
  const explicitProgress = execution?.progressToken ?? execution?.progress ?? execution?.stateVersion
    ?? data?.progressToken ?? data?.progress ?? data?.stateVersion
    ?? value?.progressToken ?? value?.progress ?? value?.stateVersion
    ?? value?.meta?.progressToken;
  return {
    known: true,
    successful: !failed,
    resultFingerprint: resultFingerprint(value),
    progressToken: explicitProgress === undefined ? resultFingerprint(value) : resultFingerprint(explicitProgress),
  };
}
