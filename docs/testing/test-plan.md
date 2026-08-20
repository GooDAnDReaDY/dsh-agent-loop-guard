# Test plan

Unit coverage includes canonical argument equality, normalized repeat-group identity, exact duplicate blocking, distinct commands sharing one tool (including Gitea-like API paths), total attempt cap, near-identical repeat cap, Russian stop and loop detection, malformed non-array user content, and turn reset.

Syntax checks validate both ESM source files. Runtime integration and deployment smoke tests are deferred until deployment is approved.

Unit coverage also verifies a separate bounded progress-tool budget, progress
tool repeat protection, and that denied duplicate calls do not consume the
ordinary attempt budget.
