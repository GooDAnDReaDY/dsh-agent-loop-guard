import Schema from '@deepseek-ai/schemastery';
import { LoopGuardState, hasStopRequest, positiveInteger } from './guard-state.js';

export const name = 'dsh-agent-loop-guard';
export const inject = ['tools'];

export const Config = Schema.object({
  maxToolAttemptsPerTurn: Schema.number().min(1).default(8),
  maxProgressToolCallsPerTurn: Schema.number().min(1).default(16),
  progressToolNames: Schema.array(Schema.string()).default(['todo_write']),
  maxCallsPerRepeatGroup: Schema.number().min(1),
  maxCallsPerToolPerTurn: Schema.number().min(1).default(3),
  blockExactDuplicates: Schema.boolean().default(true),
});

export function apply(ctx, config = {}) {
  const raw = Config(config) ?? {};
  const maxCallsPerRepeatGroup = positiveInteger(raw.maxCallsPerRepeatGroup ?? raw.maxCallsPerToolPerTurn, 3);
  const state = new LoopGuardState({
    ...raw,
    maxToolAttemptsPerTurn: positiveInteger(raw.maxToolAttemptsPerTurn, 8),
    maxProgressToolCallsPerTurn: positiveInteger(raw.maxProgressToolCallsPerTurn, 16),
    maxCallsPerRepeatGroup,
  });
  ctx.on('agent/pre-step', async ({ agent, turn, messages, signal }, next) => {
    const decision = await next();
    if (decision.kind === 'reject' || signal.aborted) return decision;
    state.beginTurn(agent, turn, hasStopRequest(messages));
    return decision;
  });
  return ctx.tools.guard((execution) => state.denyReason(execution.agent, execution.name, execution.arguments));
}
