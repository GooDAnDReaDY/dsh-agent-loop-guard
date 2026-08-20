# Task Plan: Loop guard repeat policy

## Goal

Allow normal DSH workflows to retry the same tool while preserving real loop protection.

## Phases

- [x] Phase 1 — inspect DSH pipeline and reproduce false duplicate
- [x] Phase 2 — move accounting after guard chain and allow five consecutive repeats
- [x] Phase 3 — test, document, commit and publish the fix

## Next Step

Commit the verified worktree and push the branch for review.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| A later guard denial was counted as a successful call | 1 | Account in tools/execute and release pending calls in tools/result |
| Ordinary cap remained 8 in the installed profile | 1 | Raise plugin default to 64; support 0 to disable only aggregate cap |
| First test expectation still used old repeat threshold | 1 | Updated tests to five allowed, sixth blocked |

