# dsh-agent-loop-guard

Host-only DeepSeek Harness bundle that prevents tool-call loops without changing DSH core.

## Behaviour

- permits five identical consecutive calls; the sixth exact repeat is blocked;
- permits five formatting-equivalent consecutive calls; the sixth near-repeat is blocked;
- counts a call only after it passes all DSH guard layers, so a call rejected by
  another guard can be retried after its prerequisite is satisfied;
- caps ordinary tool attempts in a turn; default is 64, and 0 disables only this
  aggregate cap while repeat, stop, and progress protections remain active;
- progress/state tools (by default todo_write) do not consume the ordinary loop
  budget, but have their own bounded per-turn budget; default is 16;
- does not cap a tool merely because its name is reused: different Gitea API
  operations in separate commands remain allowed;
- when the user says stop, halt, answer, or петля, blocks tools for that turn and tells the model to answer in text.

`maxCallsPerRepeatGroup` controls the consecutive normalized repeat-group cap.
The legacy `maxCallsPerToolPerTurn` setting is still accepted as a compatibility
alias, but it is no longer applied to every call of the same tool.
`maxToolAttemptsPerTurn` accepts 0 to disable only the aggregate ordinary-call
cap. `progressToolNames` configures state/progress tools, and
`maxProgressToolCallsPerTurn` bounds them separately. Exact and near-identical
repeat protection still applies to progress tools.

Call accounting is connected to DSH's public `tools/execute` and
`tools/result` stages: reservations made while the guard chain is evaluated
are released when a later guard denies the call, and committed only once the
call reaches the around-dispatch stage.

Denials use the documented tools.guard API. DSH materializes them as normal structured tool results, preserving session persistence.

The optional assistant-output guard is enabled by default. It subscribes to the
documented session event stream and watches complete non-empty text lines from
assistant/chunk text-delta events. Five consecutive normalized copies of the
same line (configurable with maxRepeatedAssistantLines) cancel the active agent
with keepInbox: true, preserving pending work for a concise recovery response.
The guard resets at block/step/turn boundaries, pauses while a tool call is
active, and is disabled with assistantOutputGuard: false. This is specifically
for a stuck streaming text loop; it does not replace tool repeat protection.

## Verification

npm test
npm run check

