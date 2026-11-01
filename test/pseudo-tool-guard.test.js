import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LoopGuardState,
  DEFAULT_PSEUDO_TOOL_PATTERNS,
  compilePseudoToolPatterns,
  isPseudoToolCallText,
} from '../lib/guard-state.js';
import { apply } from '../lib/index.js';

test('isPseudoToolCallText detects pseudo-tool call syntaxes and rejects normal text', () => {
  // XML-style invoke tags
  assert.equal(isPseudoToolCallText('<invoke name="bash"><command>ls</command></invoke>'), true);
  assert.equal(isPseudoToolCallText('Let me check that. </invoke>'), true);
  assert.equal(isPseudoToolCallText('<function_call>{"name": "fetch"}</function_call>'), true);
  assert.equal(isPseudoToolCallText('<tool_call>\n{"arguments": {}}\n</tool_call>'), true);
  assert.equal(isPseudoToolCallText('<call:system_cmd arg="1"/>'), true);

  // Markdown code blocks
  assert.equal(isPseudoToolCallText('```tool_call\n{"action": "read"}\n```'), true);
  assert.equal(isPseudoToolCallText('```invoke\n{"tool": "bash"}\n```'), true);
  assert.equal(isPseudoToolCallText('```function_call\n{"tool": "bash"}\n```'), true);

  // Bracket syntaxes
  assert.equal(isPseudoToolCallText('[TOOL_CALL: search(query="test")]'), true);
  assert.equal(isPseudoToolCallText('[TOOL_CALLS] search [/TOOL_CALLS]'), true);
  assert.equal(isPseudoToolCallText('[CALL: api_read]'), true);

  // Normal conversation text should NOT match
  assert.equal(isPseudoToolCallText('Here is how to invoke the API using Python.'), false);
  assert.equal(isPseudoToolCallText('The function call failed due to timeout.'), false);
  assert.equal(isPseudoToolCallText('You can use the tool call feature if enabled.'), false);
  assert.equal(isPseudoToolCallText('```javascript\nconsole.log("hello");\n```'), false);
  assert.equal(isPseudoToolCallText(''), false);
  assert.equal(isPseudoToolCallText(null), false);
});

test('compilePseudoToolPatterns handles string literals, regex patterns, and empty patterns', () => {
  const patterns = compilePseudoToolPatterns(['[CUSTOM_TAG]', '/\\[SPECIAL_CALL:\\w+\\]/i', '   ']);
  assert.equal(patterns.length, 2);
  assert.equal(isPseudoToolCallText('[CUSTOM_TAG]', ['[CUSTOM_TAG]']), true);
  assert.equal(isPseudoToolCallText('[SPECIAL_CALL:run]', ['/\\[SPECIAL_CALL:\\w+\\]/i']), true);
  assert.equal(isPseudoToolCallText('other text', ['[CUSTOM_TAG]']), false);
});

test('LoopGuardState detects runaway pseudo-tool calls after threshold completed turns (#128, gh-2)', () => {
  const state = new LoopGuardState({ pseudoToolCallThreshold: 3 });
  const agent = 'session-loop-1';

  // Turn 1: model outputs pseudo tool call, zero real tool calls
  state.beginTurn(agent, 1);
  state.observeAssistantText(agent, 'I will search for the file.\n<invoke name="find_file">{"path": "a.txt"}</invoke>');
  const hit1 = state.endTurn(agent);
  assert.equal(hit1, undefined, 'Turn 1 should not trigger violation');

  // Turn 2: model repeats pseudo tool call with variation, zero real tool calls
  state.beginTurn(agent, 2);
  state.observeAssistantText(agent, 'Retrying search...\n```tool_call\n{"path": "b.txt"}\n```');
  const hit2 = state.endTurn(agent);
  assert.equal(hit2, undefined, 'Turn 2 should not trigger violation');

  // Turn 3: 3rd consecutive turn with pseudo tool call -> triggers violation!
  state.beginTurn(agent, 3);
  state.observeAssistantText(agent, '<function_call>{"path": "c.txt"}</function_call>');
  const hit3 = state.endTurn(agent);
  assert.ok(hit3, 'Turn 3 must trigger pseudo tool call loop violation');
  assert.equal(hit3.code, 'LOOP_GUARD_PSEUDO_TOOL_CALL');
  assert.equal(hit3.count, 3);
  assert.match(hit3.reason, /LOOP_GUARD_PSEUDO_TOOL_CALL/);
  assert.match(hit3.detail, /completed 3 consecutive turns/);
});

test('real tool execution resets consecutive pseudo turn counter', () => {
  const state = new LoopGuardState({ pseudoToolCallThreshold: 3 });
  const agent = 'session-real-tool';

  // Turn 1: pseudo call
  state.beginTurn(agent, 1);
  state.observeAssistantText(agent, '<invoke name="bash">ls</invoke>');
  assert.equal(state.endTurn(agent), undefined);

  // Turn 2: pseudo call in text, but real tool was also executed
  state.beginTurn(agent, 2);
  state.observeAssistantText(agent, '<invoke name="bash">ls</invoke>');
  state.markRealToolCall(agent);
  assert.equal(state.endTurn(agent), undefined);

  // Turn 3: pseudo call (counter should be 1 now, not 3!)
  state.beginTurn(agent, 3);
  state.observeAssistantText(agent, '<invoke name="bash">ls</invoke>');
  assert.equal(state.endTurn(agent), undefined, 'Counter was reset by real tool call, so turn 3 is only 1 consecutive turn');

  // Turn 4: pseudo call (counter = 2)
  state.beginTurn(agent, 4);
  state.observeAssistantText(agent, '<invoke name="bash">ls</invoke>');
  assert.equal(state.endTurn(agent), undefined);

  // Turn 5: pseudo call (counter = 3) -> hit!
  state.beginTurn(agent, 5);
  state.observeAssistantText(agent, '<invoke name="bash">ls</invoke>');
  const hit = state.endTurn(agent);
  assert.ok(hit, 'Turn 5 must trigger violation');
  assert.equal(hit.count, 3);
});

test('user message resets pseudo turn counter', () => {
  const state = new LoopGuardState({ pseudoToolCallThreshold: 3 });
  const agent = 'session-user-reset';

  // Turns 1 & 2: pseudo calls
  state.beginTurn(agent, 1);
  state.observeAssistantText(agent, '<invoke name="test"/>');
  state.endTurn(agent);

  state.beginTurn(agent, 2);
  state.observeAssistantText(agent, '<invoke name="test"/>');
  state.endTurn(agent);

  // User sends message
  state.resetForUser(agent);

  // Turn 3: pseudo call after user message (counter should be 1, not 3)
  state.beginTurn(agent, 3);
  state.observeAssistantText(agent, '<invoke name="test"/>');
  assert.equal(state.endTurn(agent), undefined, 'User message reset counter, so turn 3 is count 1');
});

test('pseudoToolCallThreshold = 0 disables detection', () => {
  const state = new LoopGuardState({ pseudoToolCallThreshold: 0 });
  const agent = 'session-disabled';

  for (let turn = 1; turn <= 10; turn++) {
    state.beginTurn(agent, turn);
    state.observeAssistantText(agent, '<invoke name="loop"/>');
    const hit = state.endTurn(agent);
    assert.equal(hit, undefined, `Turn ${turn} should never trigger when threshold is 0`);
  }
});

test('end-to-end integration: apply(ctx) cancels runaway agent when pseudo tool loop detected', async () => {
  let cancelledReason = null;
  const mockAgent = {
    cancel: (err) => {
      cancelledReason = err?.message;
    },
  };

  const handlers = new Map();
  const ctx = {
    logger: { warn: () => {}, debug: () => {} },
    agents: {
      get: (id) => (id === 'sess-int-1' ? mockAgent : null),
    },
    tools: {
      guard: () => {},
    },
    on: (evt, handler) => {
      handlers.set(evt, handler);
    },
    inject: () => {},
  };

  apply(ctx, { pseudoToolCallThreshold: 2 });
  const sessionHandler = handlers.get('session/event');
  assert.equal(typeof sessionHandler, 'function', 'session/event handler must be registered');

  const session = { id: 'sess-int-1' };

  // Turn 1
  sessionHandler(session, {
    type: 'assistant/chunk',
    data: { turn: 1, step: 0, chunk: { type: 'text-delta', text: 'I am running <invoke name="bash">pwd</invoke>' } },
  });
  sessionHandler(session, { type: 'turn/end', data: { turn: 1 } });
  assert.equal(cancelledReason, null, 'Turn 1 should not cancel');

  // Turn 2 -> reaches threshold 2!
  sessionHandler(session, {
    type: 'assistant/message',
    data: {
      turn: 2,
      step: 0,
      message: { content: [{ type: 'text', text: 'Still running: <invoke name="bash">ls</invoke>' }] },
    },
  });
  sessionHandler(session, { type: 'turn/end', data: { turn: 2 } });

  assert.ok(cancelledReason, 'Agent must be cancelled on turn 2');
  assert.match(cancelledReason, /LOOP_GUARD_PSEUDO_TOOL_CALL/);
  assert.match(cancelledReason, /completed 2 consecutive turns/);
});
