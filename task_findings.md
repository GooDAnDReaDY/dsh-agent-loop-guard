# Findings

- The line guard misses A->B->C->A->B->C because each individual line repeats only after other lines.
- Streaming chunks and the final assistant/message may describe one block; it must be counted once.
- The user selected a public plugin version; production stays untouched until separately approved.
