# Implementation Plan — Issue #128 (gh-2)

## 1. Context & Objective
Model loops in pseudo tool-calls: when a tool fails or gets stuck, certain models output text formatted as pseudo tool-calls (e.g. `<invoke name="...">`, `<function_call>`, ````tool_call`) without firing real `tool/call` events. Each turn ends with `turn/end(reason: 'completed')`.
Existing detectors do not catch this:
- Tool-call limit/duplicate checks only inspect real `tool/call` events.
- Output guard inspects consecutive identical lines/blocks within or across turns, but phrasing slightly varies across turns.

Goal:
1. Detect consecutive completed turns without real `tool/call` events where assistant output contains pseudo tool calls.
2. If `pseudoToolCallThreshold` (default: 3) consecutive turns without tools contain pseudo tool calls, break the runaway loop with `LOOP_GUARD_PSEUDO_TOOL_CALL`.
3. Support configurable `pseudoToolCallThreshold` (min: 1, default: 3, 0 = disabled) and `pseudoToolCallPatterns`.
4. Export configuration in Schemastery Config schema with `.volatile()`, update Web UI Settings Card, support EN/ZH i18n, write unit tests, update docs.

## 2. Changes
- `lib/guard-state.js`:
  - `PSEUDO_TOOL_CALL_PATTERNS`: regex list matching `<invoke`, `</invoke>`, `<function_call`, `</function_call>`, ````tool_call`, ````invoke`.
  - `isPseudoToolCallText(text, customPatterns)` helper.
  - In `LoopGuardState`:
    - Track `consecutiveTurnsWithoutTools` and `lastTurnHadRealToolCall` per session/agent.
    - Increment counter on turn end without tools, reset when real `tool/call` executes or user sends message.
    - Add `checkPseudoToolLoop(agent, turn, text)` or evaluate on turn end/message.
    - Add metrics code: `LOOP_GUARD_PSEUDO_TOOL_CALL`.
    - Provide actionable guidance for `LOOP_GUARD_PSEUDO_TOOL_CALL`.
- `lib/index.js`:
  - Config schema:
    - `pseudoToolCallThreshold: Schema.number().volatile().min(0).default(3)`
    - `pseudoToolCallPatterns: Schema.array(Schema.string()).volatile().default([])`
  - In `session/event`:
    - Track tool call occurrence per turn.
    - On `turn/end` or `assistant/message`, if pseudo tool call pattern matches and threshold reached: cancel agent via `agent.cancel()` or cancelOnOutputHit/recordExternalViolation.
- `src/client/` & `lib/client.js`:
  - Add `pseudoToolCallThreshold` to locales (en, zh), draft defaults, save payload, and inputs in `50-settings-card.js`.
  - Rebuild client.js via `scripts/build-client.mjs`. Verify <= 600 lines.
- `docs/design/DESIGN.md`:
  - Document `LOOP_GUARD_PSEUDO_TOOL_CALL`, `pseudoToolCallThreshold`, and pseudo call detection rules.
- Tests:
  - Add comprehensive unit tests in `test/guard-state.test.js` or `test/pseudo-tool-call.test.js`.
