# Test plan

Unit coverage includes canonical argument equality, normalized repeat-group
identity, exact duplicate blocking, distinct commands sharing one tool
(including Gitea-like API paths), total attempt cap, near-identical repeat cap,
Russian stop and loop detection, malformed non-array user content, and turn
reset.

Separate assistant-output unit coverage verifies whitespace normalization,
five-line threshold behavior, split streaming chunks, cross-block/step/turn
persistence, assistant/message fallback with malformed-content safety,
deduplication, tool-call suppression, user-message reset, and configurable
thresholds. The fixture is derived from the observed reinstall narration loop.

Syntax checks validate ESM source files. An integration smoke test must emit
session/event assistant/chunk events through a fake DSH context and verify one
agent.cancel call with keepInbox: true. Runtime installation and deployment
smoke tests are deferred until deployment is approved.
