# AGENTS.md

## Product / Purpose

- Project: dsh-agent-loop-guard
- DEV: /mnt/external/Project/DEV/dhsplugins/dsh-agent-loop-guard
- OPT: undefined; deployment needs explicit user approval.
- Purpose: host-only DeepSeek Harness plugin that bounds tool-call loops.
- Current status: active development.
- Status verified: 2026-08-20 through Gitea and installed DSH lifecycle inspection.

## Constraints

- Use public DSH tools.guard API. Never patch DSH core.
- Keep the bundle host-only. No client metadata or browser entrypoint.
- Guard rejections must remain normal DSH tool results; never create session events manually.
- Deploy path remains undefined until approved.

## Locked Decisions

- 2026-08-19: enforce with tools.guard rather than agent/pre-step.
  - Reason: pre-step rejection ends a turn without a model text response.
  - Revisit only if documented DSH adds a response-preserving final-turn API.
- 2026-08-19: repeat protection is keyed by normalized call arguments, not tool name.
  - Reason: a single workflow legitimately reuses bash/curl for different issue,
    label, PR and comment operations; tool-name-only caps block progress.
- 2026-08-20: allow five consecutive exact or normalized-equivalent calls.
  - Reason: ordinary development workflows legitimately retry a read/edit/test
    operation several times; the sixth consecutive repeat is the loop boundary.
- 2026-08-20: account calls at DSH tools/execute, not inside tools.guard.
  - Reason: tools.guard runs before later guard layers. A later denial must not
    poison the repeat/duplicate state; tools/result releases reservations for
    those denials.
- 2026-08-20: ordinary aggregate cap defaults to 64; value 0 disables only that
  cap.
  - Reason: the aggregate cap must not replace repeat protection or block normal
    read/edit/test/commit/push workflows. Stop, repeat, duplicate, and progress
    protections remain active.

## Testing

- Unit tests: npm test
- Syntax validation: npm run check

- 2026-08-20: progress/state tools use a separate finite per-turn budget.
  - Reason: todo_write is a mandatory session-state update and must remain
    available after ordinary tool work reaches its safety cap.
  - Exact and normalized repeats still apply after five consecutive calls; the
    separate budget is not an unlimited bypass.


- 2026-08-20: streaming assistant-output loops are guarded through
  session/event plus the public agents.get(session.id).cancel API.
  - Reason: the observed failure emitted hundreds of assistant/chunk text
    records without new tool calls, so tools.guard could not see it.
  - The default threshold is five consecutive identical normalized complete
    lines; cancellation uses keepInbox: true. Active tool calls suppress this
    detector, and no DSH core or session-log mutation is allowed.

- 2026-08-20: assistant-output repetition is session-scoped across block, step,
  and turn boundaries, with assistant/message as a final-message fallback.
  - Reason: the observed reinstall loop crossed DSH steps/turns and was persisted
    as text-chunks, so resetting at every step made the old detector blind.
- 2026-08-20: output-loop cancellation uses keepInbox: false and latches until
  the next user message.
  - Reason: preserving the pending inbox allowed a cancelled loop to re-enter
    and repeat; clearing it is required to stop the generation at the boundary.
