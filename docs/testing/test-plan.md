# Test plan

Unit coverage verifies canonical and normalized fingerprints, result/state
progress epochs, productive same-argument iterations, unchanged-result
no-progress loops, read/edit retries, contextual aggregate and progress
budgets, distinct Gitea/curl endpoints, stop recovery on the next turn,
redacted structured violation logs, failed-result handling, explicit progress
tokens, malformed non-array user content, and turn reset.

Separate assistant-output coverage verifies whitespace normalization, five-line
threshold behavior, split streaming chunks, cross-block/step/turn persistence,
assistant/message fallback with malformed-content safety, deduplication,
tool-call suppression, user-message reset, and configurable thresholds. The
fixture is derived from the observed reinstall narration loop.

Syntax checks validate ESM source files. Runtime smoke tests install the bundle
in both the container and host/test profiles, replay productive and
no-progress tool-result sequences through the public tools.guard lifecycle,
and verify one structured denial plus an answer-only stop path. Assistant
output smoke verifies one cancellation with keepInbox:false.
