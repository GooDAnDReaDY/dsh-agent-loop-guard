# Findings
- Current 0.1.6 guard fingerprints tool name + normalized args and counts active/released calls, so it cannot know whether a result changed state.
- DSH public lifecycle exposes tools/execute and tools/result; plugin must stay host-only and must not patch DSH core.
- Progress evidence must be explicit and conservative: a tool result with a successful/new result marker or a changed state token releases the no-progress streak; unknown results do not.
- Gitea operations should use full command/endpoint arguments; common base URLs and auth headers must not be reduced to the same fingerprint.
- A denial must remain a normal structured tool result, while logging must be side-effect-only.
