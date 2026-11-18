import { createHash } from 'node:crypto';

const EXPLICIT_STOP_EN = /^(?:please\s+)?(?:stop|halt|cancel|abort|terminate)(?:\s+(?:now|please|immediately|execution|calling\s+tools|and\s+answer|and\s+explain))?[.!?]*$/iu;
const EXPLICIT_STOP_ZH = /^(?:请|检测到)?(?:停止|暂停|取消|终止|死循环)(?:执行|操作|调用|一下|了)?[!。？?！]*$/u;

export function isDefaultStopRequest(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  if (EXPLICIT_STOP_EN.test(trimmed) || EXPLICIT_STOP_ZH.test(trimmed)) {
    return true;
  }

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
  if (!Array.isArray(customPatterns) || customPatterns.length === 0) return false;
  const compiled = (customPatterns[0] instanceof RegExp) ? customPatterns : compilePseudoToolPatterns(customPatterns);
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
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'string' && value.length > 2048) {
      return JSON.stringify(value.slice(0, 512) + ':len:' + value.length + ':hash:' + createHash('sha256').update(value).digest('hex').slice(0, 16));
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
}

function normalizedJson(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'string') {
      const trimmed = value.trim().replace(/\s+/gu, ' ');
      if (trimmed.length > 2048) {
        return JSON.stringify(trimmed.slice(0, 512) + ':len:' + trimmed.length + ':hash:' + createHash('sha256').update(trimmed).digest('hex').slice(0, 16));
      }
      return JSON.stringify(trimmed);
    }
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
    errorValue: failed ? (execution?.error ?? value?.error ?? value) : undefined,
    resultFingerprint: resultFingerprint(value),
    progressToken: explicitProgress === undefined ? resultFingerprint(value) : resultFingerprint(explicitProgress),
  };
}

export function normalizeErrorSignature(error) {
  if (!error) return 'UNKNOWN_ERROR';
  const text = typeof error === 'string'
    ? error
    : (error.message || error.error || error.name || (typeof error === 'object' ? JSON.stringify(error) : String(error)));
  if (!text || typeof text !== 'string') return 'UNKNOWN_ERROR';

  const exitMatch = /exit(?:ed)? with code (\d+)|exit code (\d+)/i.exec(text);
  if (exitMatch) return `EXIT_${exitMatch[1] || exitMatch[2]}`;

  if (/ENOENT|no such file or directory/i.test(text)) return 'FS_ENOENT';
  if (/EACCES|EPERM|permission denied/i.test(text)) return 'FS_EPERM';
  if (/ENOSPC|no space left/i.test(text)) return 'FS_ENOSPC';
  if (/ETIMEDOUT|timed out|timeout/i.test(text)) return 'TIMEOUT';
  if (/ECONNREFUSED|connection refused/i.test(text)) return 'CONN_REFUSED';
  if (/\b404\b|not found/i.test(text)) return 'HTTP_404';
  if (/\b(?:401|403)\b|unauthorized|forbidden/i.test(text)) return 'HTTP_AUTH';
  if (/\b(?:500|502|503)\b|internal server error/i.test(text)) return 'HTTP_SERVER';

  const sanitized = text
    .replace(/(?:\/[a-zA-Z0-9._-]+)+/g, '<path>')
    .replace(/(?:[A-Za-z]:\\[a-zA-Z0-9._-]+)+/g, '<path>')
    .replace(/\b\d+\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);
  return sanitized.length > 0 ? sanitized : 'GENERIC_ERROR';
}

export {
  classifyToolAction,
  extractTargetKey,
  checkTargetQuota,
  recordTargetOutcome,
  handleTargetViolation,
} from './target-quota-guard.js';




export const GUARD_PRESETS = {
  strict: {
    name: 'strict',
    maxToolAttemptsPerTurn: 10,
    maxProgressToolCallsPerTurn: 3,
    maxCallsPerRepeatGroup: 2,
    strictToolLimit: 1,
    blockExactDuplicates: true,
    oscillationDetection: true,
    maxOscillationRepeats: 2,
    errorThrashingGuard: true,
    maxConsecutiveFailures: 3,
    payloadBloatGuard: true,
    maxToolResultChars: 32_768,
    pseudoToolCallThreshold: 2,
    adaptiveSteering: true,
    targetQuotaGuard: true,
    maxUnchangedReadsPerTarget: 2,
    maxReadsPerTarget: 4,
    maxEditsPerTarget: 5,
    maxTargetAttempts: 8,
  },
  balanced: {
    name: 'balanced',
    maxToolAttemptsPerTurn: 16,
    maxProgressToolCallsPerTurn: 6,
    maxCallsPerRepeatGroup: 3,
    strictToolLimit: 2,
    blockExactDuplicates: true,
    oscillationDetection: true,
    maxOscillationRepeats: 3,
    errorThrashingGuard: true,
    maxConsecutiveFailures: 4,
    payloadBloatGuard: true,
    maxToolResultChars: 65_536,
    pseudoToolCallThreshold: 3,
    adaptiveSteering: true,
    targetQuotaGuard: true,
    maxUnchangedReadsPerTarget: 3,
    maxReadsPerTarget: 6,
    maxEditsPerTarget: 8,
    maxTargetAttempts: 12,
  },
  autonomous: {
    name: 'autonomous',
    maxToolAttemptsPerTurn: 32,
    maxProgressToolCallsPerTurn: 12,
    maxCallsPerRepeatGroup: 5,
    strictToolLimit: 3,
    blockExactDuplicates: true,
    oscillationDetection: true,
    maxOscillationRepeats: 4,
    errorThrashingGuard: true,
    maxConsecutiveFailures: 6,
    payloadBloatGuard: true,
    maxToolResultChars: 131_072,
    pseudoToolCallThreshold: 4,
    adaptiveSteering: true,
    targetQuotaGuard: true,
    maxUnchangedReadsPerTarget: 5,
    maxReadsPerTarget: 10,
    maxEditsPerTarget: 12,
    maxTargetAttempts: 20,
  },
};

export function formatSteeringAdvice(code, detail, name) {
  if (code === 'LOOP_GUARD_DUPLICATE' || code === 'LOOP_GUARD_REPEAT') {
    return `Tool "${name}" is repeating previous calls without producing new state. You MUST modify parameters or choose an alternative tool now.`;
  }
  if (code === 'LOOP_GUARD_OSCILLATION') {
    return `Alternating tool cycle was detected (${detail}). Break the loop immediately by changing strategy or reviewing prerequisites.`;
  }
  if (code === 'LOOP_GUARD_ERROR_THRASHING') {
    return `Repeated tool calls resulted in identical failures (${detail}). Stop repeating the failing action and diagnose the root cause or explain the roadblock.`;
  }
  if (code === 'LOOP_GUARD_UNREFRESHED_READ') {
    return `Target has been repeatedly read without changes (${detail}). The file content is already in your context. Proceed to edit, run checks, or provide an answer.`;
  }
  if (code === 'LOOP_GUARD_TARGET_QUOTA') {
    return `Operations on this target reached quota limit (${detail}). Shift focus to other files or summarize findings.`;
  }
  return `Potential loop condition detected (${detail}). Adjust your action or explain your plan.`;
}

export function formatViolationGuidance(code, detail, name, config) {
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
    guidance += `Turn budget of ${config?.maxToolAttemptsPerTurn ?? 64} non-productive attempts exhausted. Cease tool execution and explain current progress or roadblock to the user.`;
  } else if (code === 'LOOP_GUARD_OSCILLATION') {
    guidance += 'Alternating sequence of tools was repeated without progress. Break the cycle: alter your strategy, check prerequisites, or answer directly.';
  } else if (code === 'LOOP_GUARD_PSEUDO_TOOL_CALL') {
    guidance += 'Consecutive turns completed with pseudo tool-call syntax but zero real tool executions. Cease outputting raw <invoke> tags and provide a direct answer, or verify tool syntax.';
  } else if (code === 'LOOP_GUARD_ERROR_THRASHING') {
    guidance += 'Repeated tool executions resulted in identical errors without state progression. Stop re-trying the failing operation. Investigate the failure reason, check file existence/permissions, or report the roadblock to the user.';
  } else if (code === 'LOOP_GUARD_UNREFRESHED_READ') {
    guidance += 'Target was read repeatedly without content changes. File contents are already in context. Do NOT re-read unchanged files; execute next steps or answer directly.';
  } else if (code === 'LOOP_GUARD_TARGET_QUOTA') {
    guidance += 'Target quota limit reached. Cease repeated operations on this specific target and work on other tasks or answer directly.';
  } else {
    guidance += 'Cease tool execution and provide a final text response. The next user turn will reset this guard.';
  }
  return `[${code}] ${detail}. No productive progress was observed; provide the final text answer now. ${guidance}`;
}

