import Schema from '@deepseek-ai/schemastery';
import {
  LoopGuardState,
  hasStopRequest,
  nonNegativeInteger,
  positiveInteger,
} from './guard-state.js';
import { AssistantOutputGuardState, assistantTextFromMessage } from './assistant-output-state.js';
import { registerPluginUpdater } from './plugin-updater.js';

export const name = '@goodandready/dsh-agent-loop-guard';
export const inject = ['tools', 'agents', 'sessions', 'settings'];

export const Config = Schema.object({
  maxToolAttemptsPerTurn: Schema.number().min(0).default(64),
  maxProgressToolCallsPerTurn: Schema.number().min(1).default(16),
  progressToolNames: Schema.array(Schema.string()).default(['todo_write']),
  maxCallsPerRepeatGroup: Schema.number().min(1).default(5),
  maxCallsPerToolPerTurn: Schema.number().min(1).default(5),
  strictTools: Schema.array(Schema.string()).default([]),
  strictToolLimit: Schema.number().min(1).default(3),
  blockExactDuplicates: Schema.boolean().default(true),
  dryRunMode: Schema.boolean().default(false),
  assistantOutputGuard: Schema.boolean().default(true),
  maxRepeatedAssistantLines: Schema.number().min(1).default(5),
  maxRepeatedAssistantBlocks: Schema.number().min(1).default(5),
  maxAssistantBlockChars: Schema.number().min(256).default(16_384),
});

function callIdFromEvent(event) {
  return event?.data?.callId
    ?? event?.data?.message?.source?.callId
    ?? event?.data?.message?.source?.toolCallId;
}

function cancelForOutputLoop(ctx, session, reason) {
  let agent;
  try {
    agent = ctx.agents?.get?.(session.id);
  } catch (error) {
    ctx.logger?.warn?.('dsh-agent-loop-guard: failed to resolve agent for output guard: ' + (error instanceof Error ? error.message : String(error)));
    return;
  }
  if (agent === undefined || typeof agent.cancel !== 'function') return;
  try {
    agent.cancel(new Error(reason), { keepInbox: false });
  } catch (error) {
    ctx.logger?.warn?.('dsh-agent-loop-guard: output-loop cancellation threw: ' + (error instanceof Error ? error.message : String(error)));
  }
}

function cancelOnOutputHit(ctx, session, assistantState, hit, state = null) {
  if (!hit || assistantState.hasActiveTool(session.id)) return;
  const code = String(hit.reason).split(':', 1)[0];
  const event = {
    code,
    reason: hit.reason,
    session: session.id,
    count: hit.count,
    outputKind: hit.block === undefined ? 'line' : 'block',
    blockChars: typeof hit.block === 'string' ? hit.block.length : undefined,
  };
  try {
    ctx.logger?.warn?.('dsh-agent-loop-guard: ' + JSON.stringify(event));
  } catch (error) {
    ctx.logger?.warn?.('dsh-agent-loop-guard: ' + code + ' session=' + session.id);
  }
  try {
    state?.recordExternalViolation?.('LOOP_GUARD_OUTPUT', hit.reason, { tool: 'assistant/output' });
  } catch {}
  cancelForOutputLoop(ctx, session, hit.reason);
}

function logGuardViolation(ctx, event) {
  const safeEvent = {
    code: event.code,
    reason: event.reason,
    callId: event.callId,
    agent: event.agent,
    tool: event.tool,
    arguments: event.arguments,
    progressEpoch: event.progressEpoch,
    attemptsSinceProgress: event.attemptsSinceProgress,
    progressAttemptsSinceProgress: event.progressAttemptsSinceProgress,
    lastProgress: event.lastProgress,
    dryRun: event.dryRun,
  };
  try {
    const prefix = event.dryRun ? 'dsh-agent-loop-guard [DRY-RUN]: ' : 'dsh-agent-loop-guard: ';
    ctx.logger?.warn?.(prefix + event.code + ' ' + JSON.stringify(safeEvent));
  } catch (error) {
    ctx.logger?.warn?.('dsh-agent-loop-guard: ' + event.code + ' (structured log unavailable)');
  }
}

export function apply(ctx, config = {}) {
  const NS = name;
  let getConfig = () => Config(config) ?? {};

  const syncFrom = (raw) => {
    const maxCallsPerRepeatGroup = positiveInteger(raw.maxCallsPerRepeatGroup ?? raw.maxCallsPerToolPerTurn, 5);
    const strictTools = Array.isArray(raw.strictTools)
      ? raw.strictTools.filter((t) => typeof t === 'string' && t.trim() !== '').map((t) => t.trim())
      : [];
    return {
      ...raw,
      maxToolAttemptsPerTurn: nonNegativeInteger(raw.maxToolAttemptsPerTurn, 64),
      maxProgressToolCallsPerTurn: positiveInteger(raw.maxProgressToolCallsPerTurn, 16),
      maxCallsPerRepeatGroup,
      strictTools,
      strictToolLimit: positiveInteger(raw.strictToolLimit, 3),
      dryRunMode: Boolean(raw.dryRunMode),
      blockExactDuplicates: raw.blockExactDuplicates !== false,
      assistantOutputGuard: raw.assistantOutputGuard !== false,
      maxRepeatedAssistantLines: positiveInteger(raw.maxRepeatedAssistantLines, 5),
      maxRepeatedAssistantBlocks: positiveInteger(raw.maxRepeatedAssistantBlocks, 5),
      maxAssistantBlockChars: positiveInteger(raw.maxAssistantBlockChars, 16_384),
    };
  };

  let raw = syncFrom(getConfig());
  const state = new LoopGuardState({
    ...raw,
    onViolation: (event) => logGuardViolation(ctx, event),
  });
  const assistantState = new AssistantOutputGuardState({
    maxRepeatedAssistantLines: raw.maxRepeatedAssistantLines,
    maxRepeatedAssistantBlocks: raw.maxRepeatedAssistantBlocks,
    maxAssistantBlockChars: raw.maxAssistantBlockChars,
  });

  const applyLiveConfig = () => {
    raw = syncFrom(getConfig());
    state.updateConfig(raw);
    if (typeof assistantState.updateConfig === 'function') assistantState.updateConfig(raw);
  };

  ctx.inject(['settings'], (sctx) => {
    const scope = sctx.settings.register(NS, Config, { base: config });
    getConfig = () => Config(scope.get() ?? config) ?? {};
    applyLiveConfig();
    try {
      if (typeof scope.watch === 'function') {
        sctx.effect(() => scope.watch(() => applyLiveConfig()));
      } else if (typeof scope.subscribe === 'function') {
        sctx.effect(() => scope.subscribe(() => applyLiveConfig()));
      }
    } catch (error) {
      ctx.logger?.warn?.('dsh-agent-loop-guard: settings watch failed: ' + (error instanceof Error ? error.message : String(error)));
    }
  });

  // Mount updater and telemetry routes when webServer is available
  ctx.inject(['webServer'], (wctx) => {
    try {
      const mountUpdater = () => registerPluginUpdater(wctx, {
        endpoint: '/api/@goodandready/dsh-agent-loop-guard/update',
        packageName: name,
        manifestUrl: new URL('../package.json', import.meta.url),
      });
      if (typeof wctx.effect === 'function') {
        wctx.effect(mountUpdater, 'dsh-agent-loop-guard: updater');
      } else {
        mountUpdater();
      }

      const mountTelemetry = () => {
        if (typeof wctx.webServer?.register !== 'function') return () => {};
        return wctx.webServer.register({
          kind: 'exact',
          path: '/api/@goodandready/dsh-agent-loop-guard/telemetry',
          handler: async (request, response) => {
            if (request.method === 'GET' || request.method === 'HEAD') {
              const data = state.getTelemetry();
              response.writeHead(200, {
                'content-type': 'application/json; charset=utf-8',
                'cache-control': 'no-store',
              });
              response.end(request.method === 'HEAD' ? undefined : JSON.stringify(data));
              return;
            }
            if (request.method === 'POST') {
              state.resetTelemetry();
              response.writeHead(200, {
                'content-type': 'application/json; charset=utf-8',
                'cache-control': 'no-store',
              });
              response.end(JSON.stringify({ ok: true, reset: true }));
              return;
            }
            response.writeHead(405, { allow: 'GET, HEAD, POST' });
            response.end();
          },
        });
      };
      if (typeof wctx.effect === 'function') {
        wctx.effect(mountTelemetry, 'dsh-agent-loop-guard: telemetry');
      } else {
        mountTelemetry();
      }
    } catch (error) {
      ctx.logger?.warn?.('dsh-agent-loop-guard: webServer routes registration error: ' + (error instanceof Error ? error.message : String(error)));
    }
  });

  ctx.on('agent/pre-step', async ({ agent, turn, messages, signal }, next) => {
    const decision = await next();
    if (decision.kind === 'reject' || signal.aborted) return decision;
    state.beginTurn(agent, turn, hasStopRequest(messages));
    return decision;
  });

  ctx.on('tools/execute', async (execution, next) => {
    state.commitCall(execution.agent, execution.callId);
    return next();
  });

  ctx.on('tools/result', (execution) => {
    state.recordResult(execution.agent, execution);
  });

  if (true) {
    ctx.on('session/event', (session, event) => {
      if (raw.assistantOutputGuard === false) return;
      if (event.type === 'assistant/chunk') {
        const chunk = event.data?.chunk;
        if (chunk?.type === 'text-delta') {
          const hit = assistantState.observeText(session.id, {
            turn: event.data?.turn,
            step: event.data?.step,
            index: chunk.index,
            text: chunk.text,
          });
          cancelOnOutputHit(ctx, session, assistantState, hit, state);
        } else if (chunk?.type === 'block-end') {
          const hit = assistantState.endBlock(session.id);
          cancelOnOutputHit(ctx, session, assistantState, hit, state);
        }
        return;
      }
      if (event.type === 'assistant/message') {
        const message = event.data?.message;
        const hit = assistantState.observeMessage(session.id, {
          id: message?.id ?? event.seq,
          turn: event.data?.turn,
          step: event.data?.step,
          index: message?.index ?? 0,
          text: assistantTextFromMessage(message),
        });
        cancelOnOutputHit(ctx, session, assistantState, hit, state);
        return;
      }
      if (event.type === 'user/message') {
        assistantState.resetForUser(session.id);
        return;
      }
      if (event.type === 'tool/call') {
        assistantState.markToolCall(session.id, callIdFromEvent(event));
        return;
      }
      if (event.type === 'tool/result') {
        assistantState.markToolResult(session.id, callIdFromEvent(event));
        return;
      }
      if (event.type === 'step/end') {
        const hit = assistantState.endStep(session.id);
        cancelOnOutputHit(ctx, session, assistantState, hit, state);
        return;
      }
      if (event.type === 'turn/end') {
        const hit = assistantState.endTurn(session.id);
        cancelOnOutputHit(ctx, session, assistantState, hit, state);
        return;
      }
    });
    ctx.on('session/disposed', (session) => assistantState.dispose(session.id));
  }

  return ctx.tools.guard((execution) => state.denyReason(execution.agent, execution.name, execution.arguments, execution.callId));
}
