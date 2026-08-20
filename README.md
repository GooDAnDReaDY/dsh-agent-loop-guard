# dsh-agent-loop-guard 0.2.0

Host-only DeepSeek Harness bundle that prevents tool-call loops without changing DSH core.

## Behaviour

- treats a repeated call as a loop only when no successful result or state
  change has appeared since the previous attempt;
- permits legitimate iterations with the same arguments when the result or
  explicit progress token changes;
- allows read -> edit -> read -> edit when each step produces new evidence;
- keeps Gitea/curl operations distinct by their complete operation arguments,
  including HTTP method and endpoint, even when they share a base URL;
- uses maxToolAttemptsPerTurn and maxProgressToolCallsPerTurn as budgets
  since the last productive action, so productive work resets the counters;
- after a loop or budget denial, enters answer-only mode for the current turn
  and returns a normal DSH tool denial that requires a text answer; the next
  turn resets that mode;
- logs every LOOP_GUARD_STOP, LOOP_GUARD_LIMIT,
  LOOP_GUARD_PROGRESS_LIMIT, LOOP_GUARD_DUPLICATE, and
  LOOP_GUARD_REPEAT event with a redacted call summary and progress context;
- preserves the assistant-output guard: it detects text-only loops across
  block/step/turn boundaries and cancels with keepInbox: false.

The repeat threshold remains controlled by maxCallsPerRepeatGroup (default 5),
but it is evaluated against the current progress epoch rather than raw call
count. A successful result is considered productive when its result fingerprint
or explicit progress token differs from the last successful evidence. Failed or
unknown results do not reset the guard.

The legacy maxCallsPerToolPerTurn setting remains accepted as a compatibility
alias. maxToolAttemptsPerTurn: 0 disables only the aggregate no-progress
budget; repeat, stop, progress, and assistant-output protections remain active.
Denials use the documented tools.guard API and remain normal structured DSH tool
results, preserving session persistence.

## Verification

npm test
npm run check

