import Schema from '@deepseek-ai/schemastery';
import {
  LoopGuardState,
  hasStopRequest,
  nonNegativeInteger,
  positiveInteger,
} from './guard-state.js';
import { AssistantOutputGuardState, assistantTextFromMessage } from './assistant-output-state.js';

export const name = 'dsh-agent-loop-guard';
export const inject = ['tools', 'agents', 'sessions'];

export const Config = Schema.object({
  maxToolAttemptsPerTurn: Schema.number().min(0).default(64),
  maxProgressToolCallsPerTurn: Schema.number().min(1).default(16),
  progressToolNames: Schema.array(Schema.string()).default(['todo_write']),
  maxCallsPerRepeatGroup: Schema.number().min(1).default(5),
  maxCallsPerToolPerTurn: Schema.number().min(1).default(5),
  blockExactDuplicates: Schema.boolean().default(true),
  assistantOutputGuard: Schema.boolean().default(true),
  maxRepeatedAssistantLines: Schema.number().min(1).default(5),
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

function cancelOnOutputHit(ctx, session, assistantState, hit) {
  if (!hit || assistantState.hasActiveTool(session.id)) return;
  ctx.logger?.warn?.('dsh-agent-loop-guard: ' + hit.reason + ' session=' + session.id);
  cancelForOutputLoop(ctx, session, hit.reason);
}

export function apply(ctx, config = {}) {
  const raw = Config(config) ?? {};
  const maxCallsPerRepeatGroup = positiveInteger(raw.maxCallsPerRepeatGroup ?? raw.maxCallsPerToolPerTurn, 5);
  const state = new LoopGuardState({
    ...raw,
    maxToolAttemptsPerTurn: nonNegativeInteger(raw.maxToolAttemptsPerTurn, 64),
    maxProgressToolCallsPerTurn: positiveInteger(raw.maxProgressToolCallsPerTurn, 16),
    maxCallsPerRepeatGroup,
  });
  const assistantState = new AssistantOutputGuardState({
    maxRepeatedAssistantLines: positiveInteger(raw.maxRepeatedAssistantLines, 5),
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
    state.releaseCall(execution.agent, execution.callId);
  });

  if (raw.assistantOutputGuard !== false) {
    ctx.on('session/event', (session, event) => {
      if (event.type === 'assistant/chunk') {
        const chunk = event.data?.chunk;
        if (chunk?.type === 'text-delta') {
          const hit = assistantState.observeText(session.id, {
            turn: event.data?.turn,
            step: event.data?.step,
            index: chunk.index,
            text: chunk.text,
          });
          cancelOnOutputHit(ctx, session, assistantState, hit);
        } else if (chunk?.type === 'block-end') {
          const hit = assistantState.endBlock(session.id);
          cancelOnOutputHit(ctx, session, assistantState, hit);
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
        cancelOnOutputHit(ctx, session, assistantState, hit);
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
        cancelOnOutputHit(ctx, session, assistantState, hit);
        return;
      }
      if (event.type === 'turn/end') {
        const hit = assistantState.endTurn(session.id);
        cancelOnOutputHit(ctx, session, assistantState, hit);
        return;
      }
    });
    ctx.on('session/disposed', (session) => assistantState.dispose(session.id));
  }

  return ctx.tools.guard((execution) => state.denyReason(execution.agent, execution.name, execution.arguments, execution.callId));
}
