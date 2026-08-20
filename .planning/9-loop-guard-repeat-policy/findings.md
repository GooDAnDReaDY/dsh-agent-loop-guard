# Findings

- DSH documents the pipeline as pre-execute → monotonic guards → tools/execute → tools/post-execute → tools/result.
- The old plugin mutated duplicate, repeat and budget state inside tools.guard. That callback can run before a later guard denies the same call.
- tools/execute is called only after all guards allow the call, so it is the correct commit point.
- tools/result is emitted for the final result, including guard-denied results; pending reservations can be released there.
- The working profile still had maxToolAttemptsPerTurn 8, which caused LOOP_GUARD_LIMIT during normal read/edit/test sequences.
- New policy: five identical consecutive calls pass; the sixth exact repeat returns LOOP_GUARD_DUPLICATE. Formatting-equivalent calls use the same five-call consecutive window and return LOOP_GUARD_REPEAT on the sixth.
- A different call resets the consecutive repeat window. A reservation released after a later guard denial no longer poisons a retry.

