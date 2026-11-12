# dsh-agent-loop-guard

Current release line: **0.2.x** (runtime loop guard, oscillation detection, pseudo-tool prevention, and payload bloat control).

## Purpose
Fail-closed runtime tool-call loop guard for DeepSeek Harness (DSH):
- Detection and cancellation of repetitive identical tool executions.
- Multi-tool oscillation detection (e.g. tool A -> tool B -> tool A cycling).
- Detection and blocking of pseudo-tool text hallucination patterns.
- Payload bloat guard (defense against excessive context explosion).
- Assistant output repetition detection (repeating lines or blocks).
- Volatile configuration support: instant live updates without server restart.
- Native settings card and row seat injection for DSH Web UI.

## Status
- Package: `@goodandready/dsh-agent-loop-guard`
- Version: see `package.json`
- Verified: `npm test` (all unit test suites pass, 0 fail), `npm run check` (syntax & packaging checks)

## Paths
- DEV root: `/mnt/external/Project/DEV/dhsplugins/dsh-agent-loop-guard`
- Worktrees: `.worktrees/<branch>` only; DEV root checkout is read-only
- Gitea: `goodandready/dsh-agent-loop-guard` (internal source of truth)
- GitHub: `GooDAnDReaDY/dsh-agent-loop-guard` (sanitized public product mirror only)
- Production service: `dsh-web.service` on MiniAI (`192.168.1.111`), port 3080

## Entry Points
- Server entry: `lib/index.js` (Cordis plugin `apply`, settings schema, route registration)
- Client entry: `lib/client.js` (Browser bundle for DSH `window.__ModuleLoader__.load()`)
- Bundle patch: `cordis.patch.yml`

## Modules
- `lib/index.js` — Plugin lifecycle, Cordis service bindings, middleware interception
- `lib/guard-state.js` — LoopGuardState session tracker, repeat counters, telemetry state
- `lib/guard-helpers.js` — Oscillation detection, stop patterns, fingerprints, and data sanitization
- `lib/assistant-output-state.js` — Assistant streamed text deduplication and repetition guard
- `lib/plugin-updater.js` — In-app update route handler (`/api/@goodandready/dsh-agent-loop-guard/update`)
- `lib/client.js` — Compiled client bundle (settings card UI, status badges, telemetry reset)

## Commands
```bash
npm test                 # Run all automated unit tests
npm run check            # Run syntax checks and pack validation
npm run build:client     # Rebuild lib/client.js from src/client fragments
npm run pack:check       # Verify file size budget (< 256 KiB) and packaging cleanliness
npm run pack:release     # Package release tarball into ~/.dsh/artifacts
```
