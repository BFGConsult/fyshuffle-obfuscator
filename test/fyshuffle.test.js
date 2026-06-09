import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const expectedExports = [
  'FYBackward',
  'FYForward',
  'genPerm',
  'nextRand',
  'permuteArray',
  'unpermuteArray',
];
const browserOnlyExports = [
  'apply',
  'init',
  'observe',
  'mailtoClass',
  'mtoClass',
  'scrambleClass',
  'unscrambleClass',
];

function assertPublicExports(module) {
  assert.deepEqual(Object.keys(module).sort(), expectedExports);
  for (const name of expectedExports) {
    assert.equal(typeof module[name], 'function', `${name} should be a function`);
  }
  for (const name of browserOnlyExports) {
    assert.equal(name in module, false, `${name} should remain browser-only`);
  }
}

async function withoutConsoleWarn(fn) {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.warn = originalWarn;
  }
}

test('ESM bundle exposes the public API', async () => {
  const fyshuffle = await import('../dist/FYShuffle.module.js');

  assertPublicExports(fyshuffle);
});

test('package import exposes the public API', async () => {
  const fyshuffle = await import('fyshuffle-obfuscator');

  assertPublicExports(fyshuffle);
});

test('CommonJS require exposes the public API', () => {
  const require = createRequire(import.meta.url);
  const fyshuffle = require('fyshuffle-obfuscator');

  assertPublicExports(fyshuffle);
});

test('nextRand produces the expected first value for a zero seed', async () => {
  const { nextRand } = await import('../dist/FYShuffle.module.js');

  assert.equal(await withoutConsoleWarn(() => nextRand(0)), 12345);
});

test('genPerm returns a complete permutation', async () => {
  const { genPerm } = await import('../dist/FYShuffle.module.js');
  const perm = await withoutConsoleWarn(() => genPerm(8, 123456));

  assert.equal(perm.length, 8);
  assert.deepEqual([...perm].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('genPerm is deterministic for the same length and key', async () => {
  const { genPerm } = await import('../dist/FYShuffle.module.js');

  assert.deepEqual(
    await withoutConsoleWarn(() => genPerm(12, 98765)),
    await withoutConsoleWarn(() => genPerm(12, 98765))
  );
});

test('array permutation helpers round-trip arbitrary array values', async () => {
  const { permuteArray, unpermuteArray } = await import('../dist/FYShuffle.module.js');
  const first = { value: 'first' };
  const original = [first, 42, 'text', null, ['nested']];

  const permuted = permuteArray(original, 123456);
  const restored = unpermuteArray(permuted, 123456);

  assert.notEqual(permuted, original);
  assert.notEqual(restored, permuted);
  assert.deepEqual(restored, original);
  assert.equal(restored[0], first);
  assert.deepEqual(original, [first, 42, 'text', null, ['nested']]);
});

test('array permutation helpers reject non-arrays', async () => {
  const { permuteArray, unpermuteArray } = await import('../dist/FYShuffle.module.js');

  assert.throws(() => permuteArray('abc', 123456), /permuteArray requires an array/);
  assert.throws(() => unpermuteArray('abc', 123456), /unpermuteArray requires an array/);
});

test('public APIs reject negative and fractional keys', async () => {
  const { FYForward, FYBackward, genPerm, nextRand, permuteArray, unpermuteArray } = await import(
    '../dist/FYShuffle.module.js'
  );

  for (const badKey of [-1, 0.5]) {
    assert.throws(() => FYForward('hello@example.com', badKey), /non-negative integer key/);
    assert.throws(() => FYBackward('abc', badKey), /non-negative integer key/);
    assert.throws(() => permuteArray(['a', 'b'], badKey), /non-negative integer key/);
    assert.throws(() => unpermuteArray(['a', 'b'], badKey), /non-negative integer key/);
    assert.throws(() => genPerm(2, badKey), /non-negative integer key/);
    assert.throws(() => nextRand(badKey), /non-negative integer key/);
  }
});

test('FYForward and FYBackward round-trip representative text', async () => {
  const { FYForward, FYBackward } = await import('../dist/FYShuffle.module.js');
  const cases = [
    { text: 'hello@example.com', key: 123456 },
    { text: '', key: 0 },
    { text: 'hi', key: 42 },
    { text: 'æøå café', key: 8675309 },
  ];

  for (const { text, key } of cases) {
    assert.equal(FYBackward(FYForward(text, key), key), text);
  }
});
