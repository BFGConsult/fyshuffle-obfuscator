import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const expectedExports = ['FYBackward', 'FYForward', 'genPerm', 'nextRand'];

function assertPublicExports(module) {
  assert.deepEqual(Object.keys(module).sort(), expectedExports);
  for (const name of expectedExports) {
    assert.equal(typeof module[name], 'function', `${name} should be a function`);
  }
}

test('ESM bundle exposes the public API', async () => {
  const fyshuffle = await import('../dist/FYShuffle.module.js');

  assertPublicExports(fyshuffle);
});

test('package import exposes the public API', async () => {
  const fyshuffle = await import('fyshuffle');

  assertPublicExports(fyshuffle);
});

test('CommonJS require exposes the public API', () => {
  const require = createRequire(import.meta.url);
  const fyshuffle = require('fyshuffle');

  assertPublicExports(fyshuffle);
});

test('nextRand produces the expected first value for a zero seed', async () => {
  const { nextRand } = await import('../dist/FYShuffle.module.js');

  assert.equal(nextRand(0), 12345);
});

test('genPerm returns a complete permutation', async () => {
  const { genPerm } = await import('../dist/FYShuffle.module.js');
  const perm = genPerm(8, 123456);

  assert.equal(perm.length, 8);
  assert.deepEqual([...perm].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('genPerm is deterministic for the same length and key', async () => {
  const { genPerm } = await import('../dist/FYShuffle.module.js');

  assert.deepEqual(genPerm(12, 98765), genPerm(12, 98765));
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
