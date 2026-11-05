import test from 'node:test';
import assert from 'node:assert/strict';
import { truncateText, truncateExecutionResult } from '../lib/index.js';
import { LoopGuardState } from '../lib/guard-state.js';

test('truncateText leaves short strings unaffected', () => {
  const short = 'Short output line';
  assert.equal(truncateText(short, 100), short);
  assert.equal(truncateText(short, 0), short);
  assert.equal(truncateText(12345, 10), 12345);
  assert.equal(truncateText(null, 10), null);
});

test('truncateText truncates oversized text preserving head and tail with informative banner', () => {
  const headPart = 'HEADER_START_' + 'A'.repeat(500);
  const middlePart = 'MIDDLE_BLAT_' + 'B'.repeat(5000);
  const tailPart = 'C'.repeat(200) + '_TAIL_END';
  const fullText = headPart + middlePart + tailPart;

  const maxChars = 500;
  const truncated = truncateText(fullText, maxChars, 0.7);

  assert.ok(truncated.length < fullText.length);
  assert.ok(truncated.startsWith('HEADER_START_'));
  assert.ok(truncated.endsWith('_TAIL_END'));
  assert.match(truncated, /\[TRUNCATED: Output size \(/);
  assert.match(truncated, /Use line ranges, grep, head, tail, or save to file/);
});

test('truncateExecutionResult truncates result.value string', () => {
  const state = new LoopGuardState({});
  const bigOutput = 'X'.repeat(1000);
  const result = {
    isError: false,
    value: bigOutput,
    content: [{ text: 'small' }],
  };

  const processed = truncateExecutionResult(result, 200, state, { name: 'run_command' });
  assert.equal(processed.isError, false);
  assert.ok(processed.value.length < 1000);
  assert.match(processed.value, /\[TRUNCATED:/);
  assert.equal(processed.content[0].text, 'small');

  const telemetry = state.getTelemetry();
  assert.equal(telemetry.byCode.LOOP_GUARD_PAYLOAD_TRUNCATED, 1);
});

test('truncateExecutionResult truncates result.value object properties (e.g. stdout)', () => {
  const state = new LoopGuardState({});
  const bigStdout = 'STDOUT_LINE\n'.repeat(500);
  const result = {
    isError: false,
    value: {
      exitCode: 0,
      stdout: bigStdout,
      stderr: 'ok',
    },
  };

  const processed = truncateExecutionResult(result, 300, state, { name: 'bash' });
  assert.equal(processed.isError, false);
  assert.equal(processed.value.exitCode, 0);
  assert.equal(processed.value.stderr, 'ok');
  assert.ok(processed.value.stdout.length < bigStdout.length);
  assert.match(processed.value.stdout, /\[TRUNCATED:/);

  const telemetry = state.getTelemetry();
  assert.equal(telemetry.byCode.LOOP_GUARD_PAYLOAD_TRUNCATED, 1);
});

test('truncateExecutionResult truncates result.content array text blocks', () => {
  const state = new LoopGuardState({});
  const bigContent = 'CONTENT_DATA_'.repeat(200);
  const result = {
    content: [
      { type: 'text', text: bigContent },
      { type: 'other', raw: 123 },
    ],
  };

  const processed = truncateExecutionResult(result, 250, state, { name: 'fetch' });
  assert.ok(processed.content[0].text.length < bigContent.length);
  assert.match(processed.content[0].text, /\[TRUNCATED:/);
  assert.equal(processed.content[1].raw, 123);
});

test('truncateExecutionResult does nothing if maxChars <= 0 or result within limits', () => {
  const state = new LoopGuardState({});
  const result = { value: 'Normal small response' };

  const res1 = truncateExecutionResult(result, 0, state);
  assert.equal(res1, result);

  const res2 = truncateExecutionResult(result, 1000, state);
  assert.equal(res2, result);

  assert.equal(state.getTelemetry().byCode.LOOP_GUARD_PAYLOAD_TRUNCATED, 0);
});

