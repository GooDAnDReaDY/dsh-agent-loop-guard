# Architecture baseline

The plugin owns in-memory guard state only. Agent pre-step records turn and stop
mode. The documented DSH tools.guard hook synchronously evaluates each tool
attempt and returns either allow or a denial reason. Repeat protection is keyed
by the tool plus a normalized argument group (whitespace-only formatting
differences are grouped), not by tool name alone; this lets a workflow reuse
bash or curl for distinct operations.

The independent assistant-output branch subscribes to DSH session/event. It
tracks assistant/chunk text-delta events by session, turn, step, and text block.
After the configured number of identical complete normalized lines, and only
when no tool call is active, it calls the public agent.cancel API with
keepInbox: true. Block, step, turn, tool, and session-disposed events reset or
dispose the in-memory state.

user message -> pre-step records turn -> model tool call -> tools.guard -> normalized DSH tool result -> model text response
assistant/chunk text-delta -> output state -> repeated-line threshold -> agent.cancel(keepInbox)

No DSH core, session log, client plugin, database, or external service changes.

Ordinary loop-prone tools consume maxToolAttemptsPerTurn. Explicit progress/state
tools (default todo_write) use a separate finite maxProgressToolCallsPerTurn
budget, so required checklist writes remain available after ordinary research
reaches its cap without creating an unlimited escape from the guard. Exact and
normalized-repeat checks run before either budget and apply to both classes.
