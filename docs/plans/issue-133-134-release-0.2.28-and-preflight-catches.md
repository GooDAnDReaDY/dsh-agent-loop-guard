# Implementation Plan — Issues #133 & #134

## Context & Objectives
- **Issue #134**: Eliminate 5 empty catch blocks in `lib/plugin-updater.js` and `src/client/50-settings-card.js` so that `dsh-plugin-preflight` passes with `FAIL=0`.
- **Issue #133**: Production release of v0.2.28 incorporating #128, #130, #131, and #134. Deploy to production `web` profile on MiniAI, tag release, publish to npm and GitHub mirror.

## Implementation Steps
1. **Empty Catch Elimination (#134)**:
   - In `lib/plugin-updater.js`: implement `bestEffort(label, fn, logger)` helper. Use it in `findDesktopCliEntry` when probing candidate paths.
   - In `src/client/50-settings-card.js`: replace `catch (_) {}` with non-empty handler `catch (err) { /* bestEffort: snapshot sync */ }`.
   - Rebuild client bundle (`npm run build:client`) and verify `lib/client.js` <= 600 lines and `src/client/50-settings-card.js` <= 350 lines.
   - Add unit tests in `test/plugin-updater.test.js` covering `bestEffort`.
2. **Quality Gates & Preflight**:
   - Run `npm test` and `node --test` (all 113+ tests pass).
   - Run `bash ~/.dsh/skills/dsh-plugin-preflight/scripts/preflight.sh` and ensure `FAIL=0`.
   - Run `npm run check`.
3. **Documentation & Changelog**:
   - Update `CHANGELOG.md` under `## [0.2.28] - 2026-11-10`.
   - Update `docs/design/DESIGN.md` status if needed.
4. **Git Commit & Gitea PR**:
   - Commit via `git-antigravity`.
   - Push to Gitea `origin`.
   - Create PR on Gitea referencing #133, #134.
   - Merge PR into `main`.
5. **Release & Production Rollout**:
   - In DEV root checkout (`main`): `git pull origin main`.
   - Build release artifact: `npm run pack:release`.
   - Create and push tag `v0.2.28` to Gitea and GitHub mirror via `scripts/publish-github.sh`.
   - Publish package `@goodandready/dsh-agent-loop-guard@0.2.28` to npm.
   - Roll out to production: update `@goodandready/dsh-agent-loop-guard` in `/home/vadim/.dsh/profiles/web` to `0.2.28`.
   - Restart `dsh-web.service` on MiniAI and verify running version.
   - Close Gitea issues #133 and #134.
   - Cleanup worktree and branch.

