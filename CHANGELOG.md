# Changelog

## [0.2.20] - 2026-10-09

### Fixed
- **Streamed Text Memory Cap (#97)**: Capped `streamedText` buffer in `AssistantOutputGuardState` to `maxAssistantBlockChars` to prevent unbounded memory growth during long streaming assistant turns.
- **Volatile Config Reload Subscription (#98)**: Subscribed to Cordis `loader/volatile-update` event alongside `app-boot/config-reload` and `internal/update` for instant volatile settings reload without requiring manual refresh.
- **Settings Loader Fallback Cleanup (#99)**: Removed dead `typeof sctx.settings.get === 'function'` fallback from live config reader.
- **Language Independence & Configurable Stop Patterns (#103)**: Removed Cyrillic regex in engine core `lib/guard-state.js`, added balanced standard `en` and `zh` default patterns, and added configurable `stopPatterns` in `Config` (with `.volatile()`) and `hasStopRequest()`.

## [0.2.19] - 2026-10-08

### Fixed
- **Settings Contract & Snapshot Reader (#90)**: Replaced non-existent  with synchronous , unpacked settings values from  ( contract) instead of , and bound reactive updates through .
- **Locale Resolution & Reactivity (#40)**: Read active locale identifier from  in  with fallback to  and , ensuring settings card respects the host language selection over browser .
- **Volatile Schema Verification (#89)**: Verified and tested that all 13 user-facing  schema fields carry  (), ensuring live configuration registration under DSH 0.2.0.

## [0.2.18] - 2026-09-30

### Fixed
- **Cordis Volatile Unwrapping (#93)**: Unwrapped Volatile settings references recursively via `plainConfig()` and `resolveConfig()` before and after Schemastery `Config(...)` validation, preventing `ValidationError: $.maxToolAttemptsPerTurn expected number but got [object Object]` during plugin activation under DSH 0.2.0-rc.2.
- **Strict Validation Integrity**: Preserved strict error throwing on invalid user types (e.g. non-numeric volatile values or arbitrary non-volatile objects) without silent coercion.

## [0.2.17] - 2026-09-29

### Fixed
- **Settings Form ID Binding (#92)**: Keyed form presentation under the entry ID for DSH 0.1.7-rc.2 and 0.2.0 hosts.

## 0.2.16

### Fixed
- **Peer gate on DSH 0.2.0-rc.1** (#58): DSH skips a profile bundle whose `peerDependencies` exclude the running version, so this plugin was absent from the profile with no error in the UI. Every `@deepseek-ai/dsh-*` peer now names both the 0.1.7-rc.2 and 0.2.0-rc.1 lines, because semver does not admit a prerelease of the next minor into a range that does not name it.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.15] - 2026-09-25

### Fixed
- **SettingsForms API Migration**: Replaced legacy, removed `sctx.settings.register()` call with modern DSH 0.1.7-rc.1 `SettingsForms` lifecycle integration (#85).
- **Presentation Policy**: Configured `sctx.settings.configure({ auto: false }, ctx.fiber)` to register page policy with proper disposer in `sctx.effect`.
- **Live Settings Resolution**: Resolved live configuration via `sctx.settings.describe()` and subscribed to `settings/document-updated` event.
- **Config Reload Contract**: Supported `app-boot/config-reload` and `internal/update` events for runtime guard limit re-synchronization.
- **Optional Dependency**: Removed `settings` from top-level required `inject` array, enabling the plugin to run cleanly in headless or minimal environments.

## [0.2.14] - 2026-09-24

### Added
- **Streaming Assistant Block Hashing**: Incremental SHA-256 hashing for assistant output blocks exceeding 16,384 characters, preventing false positive loop rejections caused by truncated suffixes (#79).
- **Large Payload Fingerprints**: SHA-256 fingerprint hashing for tool arguments and results larger than 256 bytes, drastically lowering memory usage and serialization overhead in long turns (#70, #66).
- **Client Modular Architecture**: Extracted monolithic client source into clean submodules under `src/client/` (`00-header.js`, `10-styles.js`, `20-locales.js`, `50-settings-card.js`, `60-slots.js`, `90-footer.js`) with automated build via `scripts/build-client.mjs`, reducing final client bundle below the 600-line preflight threshold (#74).
- **Repository Clean Script**: Added standard `clean` npm script (`rm -f *.tgz`) (#67).

### Fixed
- **Immediate Duplicate Tool Call Blocking**: `blockExactDuplicates: true` now rejects identical duplicate tool calls immediately on the first recurrence (`exactCount >= 1`), while `blockExactDuplicates: false` allows iterations up to `maxCallsPerRepeatGroup` (#76).
- **Memory Leak in Session State**: `LoopGuardState.byAgent` now removes agent session entries when `session/disposed` fires, preventing memory growth in persistent daemon processes (#69, #65).
- **Group Counter Rollback**: Releasing uncommitted or canceled tool calls in `recordResult` properly decrements `repeatGroups` and `exactGroups` counters (#78).
- **Assistant Message Fallback Key**: Normalized message text is now used as fallback key when message ID is absent, replacing unreliable string length comparison (#77).
- **Telemetry Violation Accuracy**: Preserved primary violation code (`blockReason`) during `answerOnly` mode, eliminating false spikes of `LOOP_GUARD_STOP` in telemetry when agents attempt subsequent tools (#73).
- **LAN Origin Authorization**: Permitted same-origin update and telemetry requests from local network host headers matching the server socket address (#72).
- **Bare Mode UI Activation**: Enabled automatic telemetry polling and updater checks when rendering bare settings on `plugins.item` and `plugins.row.config` seats without manual header clicks (#64).

### Performance
- Replaced array-copy reversal (`[...calls].reverse().find`) with native `Array.prototype.findLast` in `findCall` (#71).

### Documentation
- Updated `docs/design/DESIGN.md` to document dual-seat integration (`plugins.row.config` and `plugins.item`), justify runtime functional Cyrillic stop word heuristics, and refresh npm packaging metrics (#68).

## 0.2.13

### Fixed
- Settings no longer wait on the removed settingsScope service. The client uses configForms (#75).

## [0.2.12] - 2026-09-19

- **Settings reachable again on the plugin's own page**: the current DSH core
  (0.1.6-alpha.2) renders a plugin's configuration page only for entries registered
  in the plugin-list seat `plugins.item` — that is how `dsh-agentrouter` and
  `dsh-agent-orchestrator` show their settings, while the row seat and the legacy
  card alone leave the page without the form. `PluginItem` is now registered there
  too (`id: '@goodandready/dsh-agent-loop-guard'`, order 10, static label), with both
  older seats kept as fallbacks.
- The seat-composition test now expects the list seat and asserts its `id`, static
  `label` and component.

## [0.2.11] - 2026-09-18

- **Settings reachable again**: the settings card registered into
  `settings.plugin.item`, a slot the current DSH core no longer renders, so the
  guard's settings were unreachable. The surface now registers into the Plugins
  page row seat `plugins.row.config`, keyed
  `@goodandready/dsh-agent-loop-guard#@goodandready/dsh-agent-loop-guard` (row id
  as `cordis.patch.yml` declares it): the plugin's row gains a configure control
  whose page is the settings form (`view: 'page'`, rendered bare — `PluginCard`
  accepts a `bare` prop and drops the card chrome because the host page draws the
  title, icon, crumb and padding) plus a one-line state under the title
  (`view: 'summary'`). The legacy seat stays registered as a fallback for older
  cores.
- **Row-seat guard** (`test/row-config-seat.test.js`): checks the row key against
  `package.json` and `cordis.patch.yml`, the seat order (row seat first) and the
  bare page render.

## [0.2.10] - 2026-09-18

- **Documentation & Packaging Architecture**:
  - Migrated cumulative version changelogs from all three README files (`README.md`, `README.ru.md`, `README.zh.md`) to canonical root `CHANGELOG.md` adhering to Keep a Changelog standard (#56).
  - Explicitly added `CHANGELOG.md` to `files` whitelist in `package.json` for npm distribution.
  - Expanded thematic feature sections across all three language documentations with dedicated coverage of Native WebUI Settings Card, Protection Telemetry, and One-Click In-Place Updater.
  - Synchronized automated test count to 51 tests across Russian and Chinese documentations.
  - Updated design contract status and documentation standards in `docs/design/DESIGN.md`.

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
