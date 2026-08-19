# dsh-agent-loop-guard

Host-only DeepSeek Harness bundle that prevents tool-call loops without changing DSH core.

## Behaviour

- blocks an exact tool name plus canonical JSON arguments repeat in one turn;
- caps all tool attempts in a turn; default is 8;
- caps formatting-equivalent (near-identical) calls in one repeat group; default is 3;
- does not cap a tool merely because its name is reused: different Gitea API operations in separate commands remain allowed;
- when the user says stop, halt, answer, or петля, blocks tools for that turn and tells the model to answer in text.

`maxCallsPerRepeatGroup` controls the normalized repeat-group cap. The legacy
`maxCallsPerToolPerTurn` setting is still accepted as a compatibility alias, but
it is no longer applied to every call of the same tool.

Denials use the documented tools.guard API. DSH materializes them as normal structured tool results, preserving session persistence.

## Verification

npm test
npm run check
