import test from 'node:test';
import assert from 'node:assert/strict';
import { LoopGuardState, detectOscillation } from '../lib/guard-state.js';

function accept(state, agent, name, args, callId, result, extra = {}) {
  assert.equal(state.denyReason(agent, name, args, callId), undefined);
  state.commitCall(agent, callId);
  return state.recordResult(agent, { callId, result, ...extra });
}

test('detectOscillation identifies repeating cyclical patterns', () => {
  // Period 2 (A -> B repeated 3 times)
  const seq2 = ['call:toolA', 'call:toolB', 'call:toolA', 'call:toolB', 'call:toolA', 'call:toolB'];
  const res2 = detectOscillation(seq2, 3, 2, 4);
  assert.ok(res2);
  assert.equal(res2.period, 2);
  assert.equal(res2.repeats, 3);
  assert.deepEqual(res2.cycle, ['call:toolA', 'call:toolB']);

  // Period 3 (A -> B -> C repeated 3 times)
  const seq3 = ['A', 'B', 'C', 'A', 'B', 'C', 'A', 'B', 'C'];
  const res3 = detectOscillation(seq3, 3, 2, 4);
  assert.ok(res3);
  assert.equal(res3.period, 3);
  assert.equal(res3.repeats, 3);
  assert.deepEqual(res3.cycle, ['A', 'B', 'C']);

  // Period 4 (A -> B -> C -> D repeated 3 times)
  const seq4 = ['p', 'A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C', 'D'];
  const res4 = detectOscillation(seq4, 3, 2, 4);
  assert.ok(res4);
  assert.equal(res4.period, 4);
  assert.equal(res4.repeats, 3);

  // All-same elements should NOT trigger oscillation (handled by repeat guard)
  const seqSame = ['A', 'A', 'A', 'A', 'A', 'A'];
  assert.equal(detectOscillation(seqSame, 3, 2, 4), null);

  // Insufficient repeats
  const seqShort = ['A', 'B', 'A', 'B'];
  assert.equal(detectOscillation(seqShort, 3, 2, 4), null);

  // Non-repeating random sequence
  const seqDiff = ['A', 'B', 'C', 'D', 'E', 'F'];
  assert.equal(detectOscillation(seqDiff, 3, 2, 4), null);
});

test('LoopGuardState detects 2-tool ping-pong oscillation and rejects with LOOP_GUARD_OSCILLATION', () => {
  const guard = new LoopGuardState({
    oscillationDetection: true,
    maxOscillationRepeats: 3,
    maxCallsPerRepeatGroup: 10,
    blockExactDuplicates: false,
  });

  const agent = 'agent-osc-1';
  guard.beginTurn(agent, 1, false);

  // Initial runs establish baseline result
  accept(guard, agent, 'toolA', { path: 'a' }, 'c0-a', { data: 'a' });
  accept(guard, agent, 'toolB', { path: 'b' }, 'c0-b', { data: 'b' });

  // Cycle repetition 1
  accept(guard, agent, 'toolA', { path: 'a' }, 'c1', { data: 'a' });
  accept(guard, agent, 'toolB', { path: 'b' }, 'c2', { data: 'b' });

  // Cycle repetition 2
  accept(guard, agent, 'toolA', { path: 'a' }, 'c3', { data: 'a' });
  accept(guard, agent, 'toolB', { path: 'b' }, 'c4', { data: 'b' });

  // Cycle repetition 3
  accept(guard, agent, 'toolA', { path: 'a' }, 'c5', { data: 'a' });

  // Call 6: toolB completes 3rd repetition of [toolA, toolB] without progress
  const denial = guard.denyReason(agent, 'toolB', { path: 'b' }, 'c6');
  assert.ok(denial);
  assert.match(denial, /LOOP_GUARD_OSCILLATION/);
  assert.match(denial, /oscillation|alternating/i);
  assert.match(denial, /Break the cycle/i);

  const telemetry = guard.getTelemetry();
  assert.equal(telemetry.byCode.LOOP_GUARD_OSCILLATION, 1);
});

test('LoopGuardState detects 3-tool cyclical oscillation', () => {
  const guard = new LoopGuardState({
    oscillationDetection: true,
    maxOscillationRepeats: 3,
    maxCallsPerRepeatGroup: 10,
    blockExactDuplicates: false,
  });

  const agent = 'agent-osc-2';
  guard.beginTurn(agent, 1, false);

  const cycle = [
    { name: 'read', args: { f: '1' }, res: { d: 1 } },
    { name: 'search', args: { q: 'x' }, res: { d: 2 } },
    { name: 'list', args: { dir: '.' }, res: { d: 3 } },
  ];

  // Initial runs establish baseline
  for (let i = 0; i < cycle.length; i++) {
    accept(guard, agent, cycle[i].name, cycle[i].args, `init-${i}`, cycle[i].res);
  }

  let idCounter = 1;
  // Repeat 1 & 2 without progress (6 calls)
  for (let r = 0; r < 2; r++) {
    for (const item of cycle) {
      accept(guard, agent, item.name, item.args, `c-${idCounter++}`, item.res);
    }
  }

  // Repeat 3: call 1 (read), call 2 (search)
  accept(guard, agent, cycle[0].name, cycle[0].args, `c-${idCounter++}`, cycle[0].res);
  accept(guard, agent, cycle[1].name, cycle[1].args, `c-${idCounter++}`, cycle[1].res);

  // Repeat 3: call 3 (list) -> completes 3rd cycle, triggers oscillation denial!
  const denial = guard.denyReason(agent, cycle[2].name, cycle[2].args, `c-${idCounter++}`);
  assert.ok(denial);
  assert.match(denial, /LOOP_GUARD_OSCILLATION/);
});

test('Productive progress resets oscillation sequence', () => {
  const guard = new LoopGuardState({
    oscillationDetection: true,
    maxOscillationRepeats: 3,
    maxCallsPerRepeatGroup: 10,
    blockExactDuplicates: false,
  });

  const agent = 'agent-osc-3';
  guard.beginTurn(agent, 1, false);

  // Initial baseline
  accept(guard, agent, 'toolA', { path: 'a' }, 'c0-a', { data: 'a' });
  accept(guard, agent, 'toolB', { path: 'b' }, 'c0-b', { data: 'b' });

  // 2 repetitions of [toolA, toolB] without progress
  accept(guard, agent, 'toolA', { path: 'a' }, 'c1', { data: 'a' });
  accept(guard, agent, 'toolB', { path: 'b' }, 'c2', { data: 'b' });
  accept(guard, agent, 'toolA', { path: 'a' }, 'c3', { data: 'a' });
  accept(guard, agent, 'toolB', { path: 'b' }, 'c4', { data: 'b' });

  // Now a productive call happens (e.g. write tool modifies state)
  accept(guard, agent, 'write', { path: 'c' }, 'c-prod', { status: 'created file' });

  // Next cycle toolA -> toolB should NOT trigger oscillation since progress occurred
  accept(guard, agent, 'toolA', { path: 'a' }, 'c5', { data: 'a' });

  const denial = guard.denyReason(agent, 'toolB', { path: 'b' }, 'c6');
  assert.equal(denial, undefined);
});

test('oscillationDetection: false ignores cyclical alternating patterns', () => {
  const guard = new LoopGuardState({
    oscillationDetection: false,
    maxOscillationRepeats: 3,
    maxCallsPerRepeatGroup: 10,
    blockExactDuplicates: false,
  });

  const agent = 'agent-osc-disabled';
  guard.beginTurn(agent, 1, false);

  for (let i = 1; i <= 8; i++) {
    const isA = i % 2 !== 0;
    const name = isA ? 'toolA' : 'toolB';
    accept(guard, agent, name, {}, `c-${i}`, { unchanged: true });
  }
});

