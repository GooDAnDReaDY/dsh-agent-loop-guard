# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.9] - 2026-09-18

- **Theme Guard & Token Integrity**: eliminated 100% of hardcoded hex and rgba colors from `lib/client.js` in both CSS styles and JSX inline markup, switching entirely to DSH design tokens (`var(--dsw-alias-*)`) and `color-mix(in srgb, ...)`; added automated regression test `test/theme-guard.test.js` enforcing zero hex/rgba literals (#53, #39).
- **Updater Resilience**: hardened `currentVersion` and status endpoint against corrupted, non-JSON or missing manifests, returning safe fallback status without throwing unhandled exceptions (#47).
- **Distribution & Package Hygiene**: removed internal `docs` directory from npm distribution package `files` whitelist; added diagnostic warning with `bestEffort` annotation to client primitives loader; pruned stale branches and worktrees (#54).
- **Test Suite**: expanded to 51 automated tests covering theme token compliance and manifest corruption handling.

## [0.2.8] - 2026-09-18

- **Host & Security Engine Hardening**:
  - Expanded stop keyword detector with Russian keyword `'стоп'` for multilingual interrupt safety (#43).
  - Enforced loopback and same-origin validation on `/telemetry` endpoint (#37).
  - Eliminated dead `if(true)` branch and unused `releaseCall` method in core guard engine (#44).
  - Deprecated legacy alias `maxCallsPerToolPerTurn` in configuration schema per standard (#48).
  - Replaced empty catch blocks with structured debug logging via `ctx.logger('loop-guard')` (#49).
- **WebUI Client & Design System Alignment**:
  - Aligned settings card with DSH standard CSS variables `--dsw-alias-*` and primitive chevron icon with smooth 180° rotation (#39).
  - Removed emoji headers (`🛑`, `📊`) for a clean, professional interface (#39).
  - Fixed localization reactivity by resolving locale from `ctx.locale.getLocale()` and registering within `ctx.effect` lifecycle (#40, #41).
  - Removed hardcoded version strings; version is dynamically verified from updater endpoint (#42).
  - Enhanced accessibility: all form controls now link `<label>` with `<input>` using `htmlFor` and explicit IDs (#45).
  - Added robust HTTP error checking (`res.ok`) and user-facing error indicators for updater and telemetry actions (#49).
- **Distribution & Repository Hygiene**:
  - Cleaned repository root from temporary tarballs and pruned 15 merged branches (#46).
  - Removed internal planning and architectural documentation from the public package (#35, #36).
  - Documented canonical updater architecture and rationale in `DESIGN.md` (#47).
  - Full automated test suite expanded to 49 comprehensive unit and integration tests.

## [0.2.7] - 2026-09-17

- **Deferred Slot Injection**: wrapped `settings.plugin.item` registration in `registerSlotWhenReady` with `ctx.slots.inject` to prevent `slot "settings.plugin.item" is not declared` crash during early plugin initialization (#33).
- **Slot Specification Compliance**: aligned slot registration descriptor to use `key: NS` and `inject: () => ({ ctx })` according to `dsh-plugin-authoring` standard (#33).
- **Automated Client Suite**: added tests in `test/client.test.js` validating deferred slot injection and safe fallback (#33).

## [0.2.6] - 2026-09-16

- **Browser ModuleLoader Fix**: added explicit `var exports = module.exports;` in `lib/client.js` factory function to prevent `ReferenceError: exports is not defined` when client bundle is imported by DSH WebUI ModuleLoader (#31).
- **Client Test Suite**: added automated VM test in `test/client.test.js` validating client script execution in strict ModuleLoader environment (#31).

## [0.2.5] - 2026-09-15

- **One-Click Updater**: integrated reusable host-side updater (`lib/plugin-updater.js`) with endpoint `/api/@goodandready/dsh-agent-loop-guard/update` and settings UI button/status (#29).
- **Strict Tools & Adaptive Budgets**: added `strictTools` and `strictToolLimit` to impose tighter quotas on sensitive or mutating commands (#29).
- **Dry-Run / Audit-Only Mode**: added `dryRunMode` setting to audit agent execution and record metrics without breaking active tool calls (#29).
- **Protection Telemetry & Observability**: live incident counters (`LOOP_GUARD_DUPLICATE`, `LOOP_GUARD_REPEAT`, `LOOP_GUARD_LIMIT`, `LOOP_GUARD_OUTPUT`) exposed via endpoint `/api/@goodandready/dsh-agent-loop-guard/telemetry` and rendered in the UI card with one-click reset (#29).
- **Smart Recovery Guidance**: violation messages now provide structured steering instructions for LLMs (e.g. DeepSeek-R1 / V3) indicating exact corrective actions (#29).
- **Strict Multilingual Standards**: codebase cleaned to canonical English (`en`) and complete Chinese (`zh`) with zero internal Russian code, registered translation issue #197 in `goodandready/dsh-russian-lang` (#29).
- **Design Contract**: created mandatory `docs/design/DESIGN.md` per `project-design-contract` standard (#29).
- **Expanded Test Suite**: 37 automated tests covering updater semver/security, telemetry tracking, strict tool thresholds, and dry-run mode (#29).

## [0.2.4] - 2026-09-14

- **Settings UI**: allow saving `0` for `maxToolAttemptsPerTurn` to cleanly disable aggregate turn budget (#28).
- **Outcome Analysis**: recognize `{ error: null }` and `{ error: false }` as non-failures in execution outcome evaluation (#28).
- **Alternating Loop Breaker**: track prior results per tool fingerprint (`state.lastResults`) to block alternating non-productive loops (A ➔ B ➔ A ➔ B) (#28).
- **Settings Card**: add reactive `settings.plugin.item` card in DSH Settings with live configuration updates (#26).
- **Test Suite**: expanded to 31 automated tests covering error edge cases and alternating loop enforcement (#28).
