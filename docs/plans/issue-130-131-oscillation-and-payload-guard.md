# Implementation Plan — Issues #130 & #131

## Context & Objectives
- **Issue #130**: Multi-tool oscillation / ping-pong loop guard (`LOOP_GUARD_OSCILLATION`).
  - Detect alternating cyclical patterns of 2, 3, or 4 tools (e.g. A ➔ B ➔ A ➔ B ➔ A ➔ B) within the same progress epoch.
  - Trigger `LOOP_GUARD_OSCILLATION` when a cycle repeats `maxOscillationRepeats` (default: 3) times.
  - Provide actionable guidance directing the agent to change approach or answer in text.
- **Issue #131**: Payload Bloat Guard (`LOOP_GUARD_PAYLOAD_TRUNCATED`).
  - Intercept tool results exceeding `maxToolResultChars` (default: 65,536 chars = 64 KB).
  - Safely truncate oversized outputs (head + banner + tail) preserving beginning and ending logs.
  - Inject explicit model-steering banner instructing the agent to use grep/head/tail/line-ranges instead of dumping whole files.
  - Record `LOOP_GUARD_PAYLOAD_TRUNCATED` in telemetry and warning logs without failing the tool.

## Key Files to Change
1. `lib/guard-state.js`:
   - `detectOscillation(sequence, maxRepeats, minPeriod, maxPeriod)`
   - In `LoopGuardState`:
     - Track `recentCallSequence` in state (cleared when progress epoch advances).
     - In `denyReason`: check `detectOscillation` with candidate call.
     - Add `LOOP_GUARD_OSCILLATION` and `LOOP_GUARD_PAYLOAD_TRUNCATED` to `metrics.byCode`.
     - Add violation guidance for `LOOP_GUARD_OSCILLATION`.
2. `lib/index.js`:
   - Export `truncateText` and `truncateExecutionResult`.
   - Update `Config` schema with 4 new volatile fields (total: 20 fields).
   - In `ctx.on('tools/execute')`: run `truncateExecutionResult` on `await next()`.
3. `src/client/`:
   - `20-locales.js`: add EN and ZH keys for all 4 settings.
   - `50-settings-card.js`: add defaults, save payload, and UI fields keeping file <= 350 lines.
   - Run `node scripts/build-client.mjs` ensuring `lib/client.js` <= 600 lines.
4. Testing:
   - Create `test/oscillation-guard.test.js` (detect period 2, 3, 4 cycles, reset on progress).
   - Create `test/payload-bloat-guard.test.js` (truncate string/object/content, banner format, telemetry).
   - Update `test/volatile-config.test.js` for 20 volatile fields.
5. Documentation & Release:
   - Update `docs/design/DESIGN.md`, `README.md`, `README.ru.md`, `README.zh.md`, `CHANGELOG.md`.
   - Bump version to `0.2.28` in `package.json`.
