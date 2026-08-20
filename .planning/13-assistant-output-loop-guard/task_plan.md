# Task Plan: assistant-output loop guard

## Goal
Add a conservative runtime guard to dsh-agent-loop-guard that detects repeated assistant streaming text, cancels only the owning agent while preserving pending inbox work, and keeps tool-call guard behavior unchanged.

## Phases
1. [complete] Preflight, issue #13, reuse research, and event/API design
2. [complete] Implement state machine, session/event listener, config, and unit tests
3. [complete] Run tests/checks, update docs and Memory Brain
4. [in_progress] Commit, push, open PR, review, and merge
5. [pending] Request deploy approval; deploy merged main and verify production smoke

## Definition of Ready
- Issue: #13
- Source: origin/main at 4e1cfc9
- Worktree: fix/dsh-agent-loop-guard-assistant-output
- Reuse: DSH session/event and agent.cancel(cause,{keepInbox:true}) are the public APIs used.
- Trace-MCP is unavailable in this environment; fallback source inspection is recorded in findings.md.
- No DSH core, persistence format, provider, Hermes config, or existing tool thresholds are changed.

## Next Step
Review the complete diff, commit, push, open the PR, and merge after checks.
