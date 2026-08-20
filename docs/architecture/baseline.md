# Architecture baseline

The plugin owns in-memory guard state only. Agent pre-step records turn and stop mode. The documented DSH tools.guard hook synchronously evaluates each tool attempt and returns either allow or a denial reason. Repeat protection is keyed by the tool plus a normalized argument group (whitespace-only formatting differences are grouped), not by tool name alone; this lets a workflow reuse `bash` or `curl` for distinct operations.

user message -> pre-step records turn -> model tool call -> tools.guard -> normalized DSH tool result -> model text response

No DSH core, session log, client plugin, database, or external service changes.

Ordinary loop-prone tools consume maxToolAttemptsPerTurn. Explicit progress/state
tools (default todo_write) use a separate finite maxProgressToolCallsPerTurn
budget, so required checklist writes remain available after ordinary research
reaches its cap without creating an unlimited escape from the guard. Exact and
normalized-repeat checks run before either budget and apply to both classes.
