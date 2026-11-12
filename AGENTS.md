# AGENTS.md — @goodandready/dsh-agent-loop-guard

Project-specific rules only. Root `/mnt/external/Project/DEV/AGENTS.md` still applies.

## Identity
- Package name: `@goodandready/dsh-agent-loop-guard` (must match `package.json`, `cordis.patch.yml` `name:`, client `id: '@goodandready/dsh-agent-loop-guard'`, and server `export const name = '@goodandready/dsh-agent-loop-guard'`)
- Gitea: `goodandready/dsh-agent-loop-guard`
- Agent git wrapper: `git-<agent>` on MiniAI (`/home/vadim/.ssh/bin/git-antigravity`); never bare `git` for commit/push

## Layout & Worktrees
- Root checkout is read-only. All modifications happen strictly in `.worktrees/<branch>`
- Single DEV folder + single production profile (`dsh-web.service` on MiniAI)
- Client bundle: `lib/client.js` must remain self-contained (DSH ModuleLoader serves one browser bundle without in-browser bundler)
- Client fragments: edit `src/client/*.js` and run `node scripts/build-client.mjs` (never edit `lib/client.js` directly)
- Line limits: `src/client/50-settings-card.js` must remain <= 350 lines; `lib/client.js` <= 600 lines; all server modules in `lib/` < 600 lines

## Commands
```bash
npm test
# Equivalent to: node scripts/build-client.mjs && node --test test/*.test.js
npm run check
# Equivalent to: node --check on all lib/*.js and node scripts/pack-check.mjs
```
- Tests must execute locally without DSH harness and without external network connectivity
- Zero failures permitted in automated test suites

## Security & Architectural Constraints
- Fail-closed design: when in doubt or loop threshold reached, abort runaway agent turns to protect token budget
- Loopback and LAN isolation: updater and telemetry routes validate requests via `isTrustedCaller` / `isTrustedUpdateRequest` / `isTrustedTelemetryRequest`
- No wildcard CORS: `Access-Control-Allow-Origin: *` is strictly forbidden
- Zero empty catches: all `catch` blocks in `lib/` must either log or use safe `bestEffort` wrapper
- Packaging budget: all files in package must remain under 262144 bytes (`npm run pack:check`)

## Publication Safety (MUST NOT)
- `AGENTS.md`, `index.md`, and `deploy.sh` are internal project documentation and MUST NEVER be published to npm or mirrored to public GitHub
- Exclusion is guaranteed by `package.json` `files` allowlist, `.gitattributes export-ignore`, and `scripts/publish-github.sh` filter
- Do not use force flags (`--force`, `git push -f`, `npm publish --force`) under any circumstances
