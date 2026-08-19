# Reuse-first research

Reviewed installed DSH components.

- dsh-repeat-tool-reminder warns about repeat chains but does not enforce a bound.
- dsh-approval-gate uses public tools.guard and demonstrates a fail-closed denial before tool execution.
- agent/pre-step can reject a whole step, but DSH ends that turn as blocked and gives no model text response.

GitHub search found no reusable external DSH anti-loop bundle on 2026-08-19. This project therefore adapts the documented DSH guard pattern with a small deterministic state module.
