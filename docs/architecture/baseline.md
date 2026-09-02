# Architecture baseline

The plugin owns in-memory guard state only. Agent pre-step records turn and stop
mode. The documented DSH tools.guard hook synchronously evaluates each tool
attempt and returns either allow or a denial reason. Each accepted call enters a
progress ledger with a full argument fingerprint, a normalized repeat
fingerprint, and a pending/committed lifecycle. tools/result records the result
fingerprint and optional progress token. A successful change from the last
successful evidence advances a progress epoch, clears no-progress repeat
groups, and resets contextual budgets. Failed or unknown results leave the
no-progress counters intact.

The independent assistant-output branch subscribes to DSH session/event. It
tracks assistant/chunk text-delta events and assistant/message final content by
session. The final-message path accepts only Array.isArray(message.content)
text blocks and deduplicates messages already seen in the stream. After the
configured number of identical complete normalized lines, and only when no tool
call is active, it calls the public agent.cancel API with keepInbox: false.
The streak survives block, step, and turn boundaries and latches until a new
user message; tool calls reset the streak, and session-disposed events dispose
the in-memory state.

user message -> pre-step records turn -> model tool call -> tools.guard -> normalized DSH tool result -> model text response
assistant/chunk or assistant/message -> output state -> repeated-line threshold -> agent.cancel(keepInbox: false)

No DSH core, session log, client plugin, database, or external service changes.

Ordinary loop-prone tools consume maxToolAttemptsPerTurn. Explicit progress/state
tools (default todo_write) use a separate finite maxProgressToolCallsPerTurn
budget, so required checklist writes remain available after ordinary research
reaches its cap without creating an unlimited escape from the guard. Exact and
normalized-repeat checks run before either budget and apply to both classes.


## Assistant output loop detection

The host-only guard keeps two independent bounded detectors. The existing detector counts consecutive normalized complete lines. The multi-line detector fingerprints each completed assistant block (at block-end or final assistant message), keeps the count across step and turn boundaries, and trips only after the configured number of identical blocks without an intervening user message or tool call. A streamed block and its final message are counted once.
