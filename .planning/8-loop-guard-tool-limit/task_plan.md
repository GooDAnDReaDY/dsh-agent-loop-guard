# Fix LOOP_GUARD_LIMIT blocking required tools

## Goal

Keep the runtime anti-loop guard effective while allowing mandatory progress/state tools such as `todo_write` to run after ordinary tool work reaches the safety budget.

## Current Phase

Phase 3 — verification

## Phases

- [completed] 1. Confirm the failure, inspect DSH tool semantics, and choose a bounded policy.
- [completed] 2. Implement configuration/state changes and regression tests.
- [in_progress] 3. Update project documentation and run unit/syntax checks.
- [pending] 4. Push branch, open PR, review/merge, and prepare deployment evidence.
- [pending] 5. Deploy only after explicit user approval, smoke-test, and close issue.

## Next Step

Record verification evidence, then commit and open the PR.

## Decisions

- Do not patch DSH core or disable the guard globally.
- `todo_write` is a state/progress tool: it must not consume the ordinary loop-attempt budget, but it must retain exact/repeat protections and have its own finite per-turn cap.
- Keep ordinary tool calls bounded by the existing per-turn cap; make all budgets explicit in the plugin configuration.

## Errors Encountered

| Error | Attempt | Resolution |
