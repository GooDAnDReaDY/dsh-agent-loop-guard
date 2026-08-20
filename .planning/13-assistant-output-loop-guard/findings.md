# Findings

## 2026-08-20

- The observed failure is a streaming assistant-output loop, not a tool-call loop. Session 8e1124c5-7448-48f6-ac83-2e5563378171 contains repeated assistant/chunk/text-chunks records in turn 20, step 7, with no tool/call during the repetition.
- The existing guard subscribed only to agent/pre-step, tools/execute, tools/result, and tools.guard.
- DSH exposes a durable ctx.on('session/event', (session,event) => ...) stream. assistant/chunk text-delta events carry stream text; tool/call and tool/result allow active-tool safety tracking.
- The Agent API exposes ctx.agents.get(session.id) and agent.cancel(cause, options?), with keepInbox available to preserve pending work.
- No reusable DSH output-loop guard was found locally. opencode-auto-resume has a similar OpenCode-specific detector and is reference-only.
- Design: detect repeated non-empty complete lines in one assistant stream; normalize Unicode whitespace; count consecutive identical lines; default threshold 5; reset on block/step/turn/tool/session boundaries; cancel once with keepInbox=true; suppress while a tool is active.
- Tests and smoke checks pass. npm audit cannot run without a package lock, and no dependency graph changed.
