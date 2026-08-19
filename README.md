# dsh-agent-loop-guard

Host-only DeepSeek Harness bundle that prevents tool-call loops without changing DSH core.

## Behaviour

- blocks an exact tool name plus canonical JSON arguments repeat in one turn;
- caps all tool attempts in a turn; default is 8;
- caps repeated use of one tool in a turn; default is 3;
- when the user says stop, halt, answer, or петля, blocks tools for that turn and tells the model to answer in text.

Denials use the documented tools.guard API. DSH materializes them as normal structured tool results, preserving session persistence.

## Verification

npm test
npm run check
