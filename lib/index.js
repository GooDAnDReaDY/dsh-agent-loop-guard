import Schema from '@deepseek-ai/schemastery';
import { LoopGuardState, hasStopRequest, nonNegativeInteger, positiveInteger } from './guard-state.js';

export const name = 'dsh-agent-loop-guard';
export const inject = ['tools'];

export const Config = Schema.object({
  maxToolAttemptsPerTurn: Schema.number().min(0).default(64),
  maxProgressToolCallsPerTurn: Schema.number().min(1).default(16),
  progressToolNames: Schema.array(Schema.string()).default(['todo_write']),
  maxCallsPerRepeatGroup: Schema.number().min(1).default(5),
  maxCallsPerToolPerTurn: Schema.number().min(1).default(5),
  blockExactDuplicates: Schema.boolean().default(true),
});

export function apply(ctx, config = {}) {
  const raw = Config(config) ?? {};
  const maxCallsPerRepeatGroup = positiveInteger(raw.maxCallsPerRepeatGroup ?? raw.maxCallsPerToolPerTurn, 5);
  const state = new LoopGuardState({
    ...raw,
    maxToolAttemptsPerTurn: nonNegativeInteger(raw.maxToolAttemptsPerTurn, 64),
    maxProgressToolCallsPerTurn: positiveInteger(raw.maxProgressToolCallsPerTurn, 16),
    maxCallsPerRepeatGroup,
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
  return ctx.tools.guard((execution) => state.denyReason(execution.agent, execution.name, execution.arguments, execution.callId));
}

