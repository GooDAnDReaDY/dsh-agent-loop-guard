# AGENTS.md

## Product / Purpose

- Project: dsh-agent-loop-guard
- DEV: /mnt/external/Project/DEV/dhsplugins/dsh-agent-loop-guard
- OPT: undefined; deployment needs explicit user approval.
- Purpose: host-only DeepSeek Harness plugin that bounds tool-call loops.
- Current status: active development.
- Status verified: 2026-08-19 through Gitea and installed DSH lifecycle inspection.

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
  - Reason: a single workflow legitimately reuses `bash`/`curl` for different
    issue, label, PR and comment operations; tool-name-only caps block progress.
  - Exact duplicates, formatting-equivalent repeats and the total turn cap remain
    protected.

## Testing

- Unit tests: npm test
- Syntax validation: npm run check
