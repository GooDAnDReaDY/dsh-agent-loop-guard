import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LoopGuardState,
  callFingerprint,
  callRepeatFingerprint,
  isPseudoToolCallText,
  compilePseudoToolPatterns,
} from '../lib/guard-state.js';

test('hot path: observeAssistantText sliding window does not exhibit quadratic degradation (#158)', () => {
  const guard = new LoopGuardState();
  const agent = 'agent-bench';
  guard.beginTurn(agent, 1, false);

  const chunk = 'Here is another thought step and token batch for processing.\n';
  const start = performance.now();

  // Process 2000 chunks (simulating a 30,000 token response)
  for (let i = 0; i < 2000; i++) {
    guard.observeAssistantText(agent, chunk);
  }

  const duration = performance.now() - start;
  // With sliding window and precompiled regex, 2000 chunks take < 40ms (previously took 500ms+)
  assert.ok(duration < 200, `observeAssistantText took ${duration.toFixed(1)}ms (must be < 200ms)`);
  assert.equal(guard.stateFor(agent).turnHadPseudoCall, false);

  // Now inject pseudo tool tag: detected immediately
  guard.observeAssistantText(agent, '<invoke name="bash">');
  assert.equal(guard.stateFor(agent).turnHadPseudoCall, true);
});

test('hot path: callFingerprint handles large string arguments efficiently (#158)', () => {
  const hugeString = 'x'.repeat(500_000); // 500 KB string
  const args = { file: 'big.txt', content: hugeString };

  const start = performance.now();
  const fp1 = callFingerprint('write_file', args);
  const fp2 = callFingerprint('write_file', args);
  const duration = performance.now() - start;

  assert.equal(fp1, fp2);
  assert.match(fp1, /^write_file:/);
  assert.ok(duration < 50, `Hashing 500KB argument took ${duration.toFixed(1)}ms (must be < 50ms)`);
});

test('hot path: state.calls array is bounded to prevent unbounded memory growth (#158)', () => {
  const guard = new LoopGuardState({ maxToolAttemptsPerTurn: 200 });
  const agent = 'agent-bound-calls';
  guard.beginTurn(agent, 1, false);

  for (let i = 0; i < 150; i++) {
    guard.denyReason(agent, 'tool_test', { i }, `c-${i}`);
    guard.commitCall(agent, `c-${i}`);
  }

  const state = guard.stateFor(agent);
  assert.ok(state.calls.length <= 64, `state.calls length must be <= 64, got ${state.calls.length}`);
});

