# Architecture baseline

The plugin owns in-memory guard state only. Agent pre-step records turn and stop mode. The documented DSH tools.guard hook synchronously evaluates each tool attempt and returns either allow or a denial reason.

user message -> pre-step records turn -> model tool call -> tools.guard -> normalized DSH tool result -> model text response

No DSH core, session log, client plugin, database, or external service changes.
