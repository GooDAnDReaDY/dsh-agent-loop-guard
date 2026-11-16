# Changelog

## [0.3.3] - 2026-11-16

### Added
- **Hot Path Performance & Memory Optimizations (#158)**:
  - **Pre-Compiled Pseudo-Tool Regex**: Regex patterns are compiled once in `LoopGuardState` constructor and config reload (`compiledPseudoPatterns`), eliminating re-compilation on every streaming delta chunk.
  - **Sliding Tail Window Scan**: `observeAssistantText` inspects only an overlap tail window (`text.length + 256` bytes) instead of rescanning up to 64 KB on every delta, eliminating $O(N^2)$ streaming overhead.
  - **Large Payload Fast Fingerprinting**: String arguments exceeding 2048 characters are hashed via deterministic prefix + length + SHA-256 fingerprint in `callFingerprint` and `callRepeatFingerprint`, preventing multi-megabyte JSON serialization and heap spikes during massive file writes.
  - **Bounded Call Sequence History**: `state.calls` is bounded to the most recent 64 entries, preventing unbounded array growth in long-running sessions.
- **Audit-First Dry-Run Mode (#162)**: Extended `dryRunMode` to output repetition guard (`cancelOnOutputHit`) and pseudo-tool loop detector (`cancelOnPseudoHit`). Violations are recorded to telemetry and incident journals for audit without terminating agent execution or cancelling generation.
- **Automated Preset Parity Gate (#159)**: Added automated test suite `test/presets-parity.test.js` validating 1:1 parameter parity across server `GUARD_PRESETS` and client `CLIENT_PRESETS` for all profiles (`Strict`, `Balanced`, `Autonomous`). Aligned `LoopGuardState` constructor fallback for `maxUnchangedReadsPerTarget` with schema default (3).

### Fixed
- **Dead Imports & Redundant Delegate Elimination (#165)**: Removed unused imports `GUARD_PRESETS` and `hasStopRequest` in `lib/index.js`. Removed redundant wrapper `LoopGuardState.decrementReservations` in favor of direct module function invocation.
- **SMB Mount Filemode Drift Protection (#166)**: Documented and enforced `core.fileMode = false` for SMB/Windows-mounted checkouts, preventing spurious 100755/100644 git status diffs.

## [0.3.2] - 2026-11-16

### Added
- **Target Quota Escalation Guard (#148)**: Target-specific non-latching denials now escalate to hard `answerOnly` text mode when an agent repeatedly ignores target quota denials (threshold: 3 consecutive denials on the same target, configurable via `maxTargetDenialsBeforeEscalation`). Prevents fail-open token burning loops while preserving non-latching flexibility for self-correcting models. Added `targetDenials` metric and updated steering warning text.
- **Smart Steering Recovery for Error Thrashing (#149)**: Introduced single-attempt recovery grace (`thrashingRecoveryGrace`) following `LOOP_GUARD_ERROR_THRASHING` steering warnings. Allows the agent to execute an alternative tool call or diagnosis command to recover. Resets failure counters and steering state on successful tool execution, and escalates to hard violation only if recovery fails.
- **Target Quota Engine Modular Extraction (#164)**: Extracted all target quota operations (`classifyToolAction`, `extractTargetKey`, `checkTargetQuota`, `recordTargetOutcome`, `handleTargetViolation`) into dedicated module `lib/target-quota-guard.js`, keeping all server modules strictly under line budget limits (< 450 lines in `guard-helpers.js`, < 595 lines in `guard-state.js`).

### Fixed
- **Accurate Tool Action Classification (#150)**: Fixed token-boundary classification in `classifyToolAction` using camelCase/separator tokenization and exact action dictionaries. Eliminates false positive substring matches (`format_code`, `perform_action`, `confirm_changes` no longer misclassified as `delete` via `rm`; `review_changes`, `preview_url`, `locate_symbol` no longer misclassified as `read` via `view`/`cat`).
- **Path Case Preservation & Lexical Normalization (#151)**: Enhanced `extractTargetKey` with POSIX segment normalization (`..` and `.` resolution), symlink canonicalization via `fs.realpathSync`, Windows drive letter normalization (`c:`), and Linux case preservation (`README.md` and `readme.md` maintained as distinct targets on case-sensitive filesystems).
- **Per-Target Per-Turn Quota Accumulation (#152)**: Fixed per-target quota counters (`maxReadsPerTarget`, `maxEditsPerTarget`, `maxTargetAttempts`) being erroneously wiped on unrelated global progress. Counters now consistently accumulate per turn across interleaved tool calls.
- **Output Guard Orphaned Tool Call Cleanup (#155)**: Resolved silent output guard suppression caused by aborted or cancelled tool calls. `activeTools` reservations are now automatically cleared on turn boundaries (`turn/end`), step changes, and user interventions (`resetForUser`), with a hard upper bound of 64 active calls.
- **Telemetry Data Redaction & LAN Security (#156)**: Hardened `/api/@goodandready/dsh-agent-loop-guard/telemetry` against sensitive data leaks over LAN. Replaced raw session identifiers with pseudonymous hashes (`maskSessionId`) and sanitized absolute filesystem paths in incident reasons to masked basenames (`redactTelemetryText`).

## [0.3.1] - 2026-11-16

### Added
- **Target Quota Guard (#146, gh-3)**: Multi-layer protection against runaway per-file loop operations (such as repeated reads of unchanged files or endless edit-fail-retry loops on a single file).
  - **Canonical Path & Target Key Extraction (`extractTargetKey`)**: Unifies and normalizes target parameters across diverse tool schemas (`path`, `file`, `filePath`, `target`, `filename`, `uri`, `dest`, `destination`, `src`, `source`, `params.path`, `params.file`), standardizing backslashes (`\` to `/`), stripping `file://`, trimming whitespace, and collapsing redundant relative path segments.
  - **Unchanged Re-Read Protection (`maxUnchangedReadsPerTarget`)**: Tracks content fingerprints (`resultFingerprint`) across file reads per session turn. Rejects re-reads when the content has not changed and exceeds `maxUnchangedReadsPerTarget` (default: 3). Resets automatically when the target is successfully modified.
  - **Per-Target Operation Quotas (`maxReadsPerTarget`, `maxEditsPerTarget`, `maxTargetAttempts`)**: Prevents excessive operations on any single target within a turn, independent of argument variations or interleaved tool calls.
  - **Non-Latching Denial Architecture (`LOOP_GUARD_TARGET_QUOTA`, `LOOP_GUARD_UNREFRESHED_READ`)**: Target-specific violations reject *only* the offending tool call to that target, without latching the session into global `answerOnly` mode. The agent remains free to explore alternative files, call other tools, or execute cleanup commands.
  - **UI & Presets Integration**: Added 5 user-facing fields to `Config` with `.volatile()` reactivity, native UI controls in DSH Web UI Settings Card with complete localization in English, Russian, and Chinese, and updated `Strict`, `Balanced`, and `Autonomous` presets.

## [0.3.0] - 2026-11-14

### Added
- **Error Thrashing Guard (#141)**: Automatic detection and cancellation of tool failure loops (`LOOP_GUARD_ERROR_THRASHING`). Extracts normalized error signatures (`FS_ENOENT`, `FS_EPERM`, `FS_ENOSPC`, `EXIT_*`, `HTTP_*`, `TIMEOUT`, `CONN_REFUSED`) across tool calls with different parameters. Halts runaway retry cycles when failures exceed `maxConsecutiveFailures` (default: 4, configurable). Resets immediately on productive tool progress.
- **Smart Steering (#142)**: 2-stage defensive mechanism that provides actionable steering directives (`[LOOP_GUARD_STEER] Warning: ...`) before hard cancellation. Injects contextual guidance prompting the agent to change tool parameters, switch tools, diagnose root causes, or provide a text answer. Escalates to hard stop (`answerOnly`) if the agent ignores the directive. Configurable via `adaptiveSteering` (boolean, default: true).
- **Incident Journal & Post-Mortem in UI (#143)**: Circular buffer (capacity 30) capturing all violations and steering events with timestamp, session, code, tool name, reason, and call chain history. Exposed via `/api/@goodandready/dsh-agent-loop-guard/telemetry` with reverse chronological order (last 20). Integrated into DSH Web UI Settings Card with incident list and 1-click "Copy Diagnostic Dump" button for rapid troubleshooting and bug reports.
- **Sensitivity Presets (#144)**: 1-click preset selector in DSH Web UI Settings Card offering 3 tuned profiles: `Strict` (tight limits for small or hallucinating models), `Balanced` (default optimal limits for production workloads), and `Autonomous Coding` (expanded limits for deep multi-file refactoring). Exported `GUARD_PRESETS` in public API. Complete localization in EN, RU, and ZH.


## [0.2.29] - 2026-11-12

### Added
- **Canonical Entry Points & Documentation (#136)**: Added standard project entry files `AGENTS.md` (agent workflow constraints, identity invariants, build commands), `index.md` (project roadmap, architecture, commands, test matrix), and `deploy.sh` (canonical test, identity, and profile installation script). Added `.gitattributes` with `export-ignore` rules, ensuring internal documentation is strictly excluded from npm releases and public GitHub mirrors.
- **Package Cleanliness & Root Artifact Guard (#137)**: Added `scripts/pack-check.mjs` and `npm run pack:check` script. Enforces that untracked `.tgz` archives cannot reside in the repository root (moved to persistent `~/.dsh/artifacts/`) and validates the strict file size budget (<= 256 KiB) across all packaged files. Added automated unit tests in `test/pack-release.test.js`.

### Fixed
- **Security Vulnerability Remediations (#138)**: Resolved high-severity vulnerability in `zod` (GHSA-mrhx-c7xc-m3w5) and moderate-severity vulnerability in `fast-uri` (GHSA-w74x-v6f9-j3xg) via explicit `overrides` in `package.json` (`zod >= 4.6.6`, `fast-uri >= 3.1.9`). Cleaned `npm audit --omit=dev` down to 0 vulnerabilities.
- **Dead Export Removal & Architecture Modularization (#139)**: Removed unused and dead export `DEFAULT_STOP_PATTERNS` from `lib/guard-state.js` in favor of anchored regular expressions `EXPLICIT_STOP_EN` / `EXPLICIT_STOP_ZH` in `isDefaultStopRequest()`. Modularized helper functions, pattern compilers, and fingerprint generators into `lib/guard-helpers.js` with full backward-compatible re-exports, bringing all server files strictly under the 600-line limit and eliminating preflight warnings.

## [0.2.28] - 2026-11-10

### Added
- **Multi-Tool Oscillation Loop Guard (#130)**: Implemented cycle detection for alternating multi-tool sequences (period $P \in [2, 4]$) repeating $K$ times (default `maxOscillationRepeats = 3`). Prevents runaway ping-pong loops (such as A ➔ B ➔ A ➔ B or A ➔ B ➔ C ➔ A ➔ B ➔ C) when tools repeat cyclical operations without state progression. Triggers `LOOP_GUARD_OSCILLATION` with actionable guidance directing the agent to modify its strategy or provide a direct response. Added `oscillationDetection` (boolean) and `maxOscillationRepeats` (number) settings with `.volatile()` reactivity and UI localization.
- **Payload Bloat Guard (#131)**: Safeguarded model context window from excessive tool outputs via automatic head/tail truncation for execution results exceeding `maxToolResultChars` (default: 65,536 chars / 64 KB, 0 = disabled). Injects a clear steering banner instructing the agent to use line ranges, grep, head, tail, or save to file instead of dumping entire content. Records `LOOP_GUARD_PAYLOAD_TRUNCATED` in telemetry without failing tool execution. Added `payloadBloatGuard` and `maxToolResultChars` settings with `.volatile()` reactivity and UI controls.

### Fixed
- **Preflight Empty Catch Elimination (#134)**: Replaced 5 unhandled empty `catch` blocks in `lib/plugin-updater.js` (`findDesktopCliEntry`) and `src/client/50-settings-card.js` with `bestEffort(label, fn, logger)` helper and explicit snapshot sync handling. Ensures clean preflight checks (`FAIL=0`).

## [0.2.27] - 2026-11-01

### Added
- **Pseudo Tool-Call Runaway Loop Guard (#128, gh-2)**: Implemented fail-closed detection and cancellation for runaway pseudo tool-calls (`LOOP_GUARD_PSEUDO_TOOL_CALL`). When a model gets stuck after a tool failure or hallucination and outputs raw tool-call tags/blocks (e.g. `<invoke name="...">`, `<function_call>`, `<tool_call>`, ```tool_call, `[TOOL_CALL: ...]`) across consecutive turns without triggering real DSH `tool/call` events, the guard monitors turn completions (`turn/end`). If `pseudoToolCallThreshold` (default: 3) consecutive turns complete with pseudo tool-call syntax and 0 real tool executions, the agent is canceled cleanly via `agent.cancel()`. Added `pseudoToolCallThreshold` and `pseudoToolCallPatterns` to Schemastery Config with `.volatile()` reactivity, updated Settings Card with EN/ZH localization, and recorded violations in live telemetry.

## [0.2.26] - 2026-10-20

### Fixed
- **Tools Result Payload Forwarding (#125, gh-1)**: Fixed tool outcome tracking in `lib/index.js` where `tools/result` event listener only captured the first argument (`execution`), losing the actual result payload passed as the second argument (`result`) by the DSH runtime (`dsh-tools`). Updated `tools/result` to capture `(execution, result)` and forward `{ ...execution, result }` to `state.recordResult()`. Updated `outcomeFromExecution` and `recordResult` in `lib/guard-state.js` to accept `maybeResult` and extract result payload, properly recognizing successful tool executions as productive progress (`productive: true`), advancing `progressEpoch`, and clearing `exactGroups`. Resolves false-positive `LOOP_GUARD_DUPLICATE` blocks on legitimate retries and eliminates catastrophic lockouts into `answerOnly` mode.

## [0.2.25] - 2026-10-19

### Fixed
- **Stop Command Detection & History Isolation (#120)**: Hardened `hasStopRequest` in `lib/guard-state.js` to inspect only the latest user message (`source.kind === 'user'` or `role === 'user'`), eliminating cross-turn leakage where a past stop command in turn 1 permanently locked tools in subsequent turns. Removed broad keywords `answer` and `回答` from default stop patterns, and introduced `isDefaultStopRequest` to require explicit standalone or imperative stop commands ("stop", "halt", "cancel", "abort", "terminate", "please stop", "停止", "暂停", "取消", "终止", "死循环"), eliminating false-positive blocks on regular user requests ("answer in Russian", "please answer using files", "stop the service and fix it").
- **Bounded Streaming Output Buffer (#121)**: Bounded `state.pending` buffer in `AssistantOutputGuardState.observeText` to `maxAssistantBlockChars` and parsed newlines incrementally via `indexOf('\n')` instead of `split(/\n/gu)`, preventing unbounded memory growth and O(N^2) CPU stalls during long streaming outputs without line breaks (such as minified JSON or base64 payloads).
- **Issue Label Deduplication (#122)**: Reassigned affected issues to canonical project labels and cleaned up duplicate labels in Gitea repository.

## [0.2.24] - 2026-10-15

### Fixed
- **Supply-Chain Guard Compliance (#116)**: Removed `--config.minimumReleaseAge=0` override in plugin updater (`lib/plugin-updater.js`), enforcing compliance with pnpm global supply-chain quarantine and release age delay policies across fleet environments.
- **Client Slots Cleanup (#116)**: Removed deprecated dead slot `settings.plugin.item` from `src/client/60-slots.js` and unified configuration card rendering across `plugins.row.config` and `plugins.item`, reducing bundle size and keeping `lib/client.js` at 582 lines (under the 600 line limit).

## [0.2.23] - 2026-10-11

### Fixed
- **Desktop Updater Fallback (#113)**: Detected DSH Desktop profile via `isDesktopProfile` and located bundled desktop CLI binary via `findDesktopCliEntry`. Added `isDesktop` and `canAutoUpdate` flags to updater status endpoint. Added `shell: true` option when spawning Windows `.cmd` binaries in `installExact`. Replaced "Update Now" button in settings card with localized hint (`Update in Plugins page` / `请在插件页面更新`) when running in DSH Desktop or when automatic updates cannot be performed. Preserved standard "Update Now" flow in headless/web server profiles.

## [0.2.22] - 2026-10-09

### Fixed
- **Telemetry Route Security Boundary (#102)**: Integrated `getConnection(ctx)` and delegated request verification to DSH core service `connection.requestRejection(request)`. Enforced loopback and mandatory `sec-fetch-site` (`same-origin` or `none`) fallback when connection service is absent. Enforced `x-dsh-loop-guard: '1'` header and origin/host verification on POST telemetry reset, preventing unauthorized access or state reset from loopback/LAN bridges.
- **Persistent Release Packaging & Clean Isolation (#101)**: Relocated production web profile tarball dependency to external persistent directory `/home/vadim/.dsh/artifacts/`. Replaced indiscriminate `rm -f *.tgz` in `clean` script with `scripts/clean-pack.mjs` to safeguard release tarballs from local repository cleanup. Added `scripts/pack-release.mjs` (`npm run pack:release`) to build, pack into persistent artifacts directory, and generate `.sha256` checksums.

## [0.2.21] - 2026-10-09

### Fixed
- **Canonical Design Tokens (#100)**: Replaced 38 occurrences of non-existent theme tokens (`--dsw-alias-accent-primary`, `status-success`, `status-danger`, `status-warning`, `bg-hover`, `bg-layer-hover`) in `src/client/10-styles.js` and `src/client/50-settings-card.js` with canonical DSH theme tokens (`brand-primary`, `state-success-primary`, `state-error-primary`, `state-warn-primary`, `interactive-bg-hover`), restoring native styling, status coloring, and updater button appearance across themes.
- **Theme Token Validation Guard (#104)**: Extended `test/theme-guard.test.js` to extract all `--dsw-alias-*` tokens from `lib/client.js` and assert adherence to the canonical 79-token design system of `@deepseek-ai/dsh-client-ui-theme`, preventing regression on unknown tokens.

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
