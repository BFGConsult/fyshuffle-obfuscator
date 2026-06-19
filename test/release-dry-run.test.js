import assert from 'node:assert/strict';
import test from 'node:test';

import {
  allowedReleaseTags,
  assertTagMatchesPackage,
  validatePackOutput,
} from '../scripts/release-dry-run.js';

function packOutput(files) {
  return files.map((file) => `npm notice 1.0kB ${file}`).join('\n');
}

const validReleaseFiles = [
  'LICENSE',
  'README.md',
  'bin/fyshuffle.js',
  'dist/FYShuffle.d.ts',
  'dist/FYShuffle.js',
  'dist/FYShuffle.min.js',
  'dist/FYShuffle.module.js',
  'dist/FYShuffle.module.v0.10.0.js',
  'dist/FYShuffle.node.cjs',
  'dist/FYShuffle.node.v0.10.0.cjs',
  'dist/FYShuffle.v0.10.0.js',
  'dist/manifest.json',
  'package.json',
];

test('release dry-run accepts prefixed and unprefixed matching tags', () => {
  assert.deepEqual(allowedReleaseTags('0.10.0'), ['0.10.0', 'v0.10.0']);
  assert.equal(assertTagMatchesPackage(['v0.10.0'], '0.10.0'), 'v0.10.0');
  assert.equal(assertTagMatchesPackage(['0.10.0'], '0.10.0'), '0.10.0');
});

test('release dry-run rejects missing or mismatched tags', () => {
  assert.throws(
    () => assertTagMatchesPackage([], '0.10.0'),
    /No local release tag at HEAD matches package version 0\.10\.0/
  );
  assert.throws(
    () => assertTagMatchesPackage(['v0.9.2'], '0.10.0'),
    /No local release tag at HEAD matches package version 0\.10\.0/
  );
});

test('release dry-run accepts stable package contents', () => {
  assert.doesNotThrow(() => validatePackOutput(packOutput(validReleaseFiles), '0.10.0'));
});

test('release dry-run rejects missing stable package contents', () => {
  const files = validReleaseFiles.filter((file) => file !== 'dist/FYShuffle.v0.10.0.js');

  assert.throws(
    () => validatePackOutput(packOutput(files), '0.10.0'),
    /missing expected release files: dist\/FYShuffle\.v0\.10\.0\.js/
  );
});

test('release dry-run rejects development artifacts in package contents', () => {
  const files = [...validReleaseFiles, 'dist/FYShuffle.v0.10.1-dev.js'];

  assert.throws(
    () => validatePackOutput(packOutput(files), '0.10.0'),
    /includes development artifact: dist\/FYShuffle\.v0\.10\.1-dev\.js/
  );
});
