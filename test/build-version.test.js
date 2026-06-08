import assert from 'node:assert/strict';
import test from 'node:test';

import {
  incrementPatch,
  latestReleaseVersion,
  resolveBuildVersion,
  resolveStableVersion,
} from '../scripts/build-version.js';

test('incrementPatch increments only the micro version', () => {
  assert.equal(incrementPatch('0.9.2'), '0.9.3');
});

test('latestReleaseVersion finds the highest semver tag with or without v prefix', () => {
  assert.equal(latestReleaseVersion(['v0.9.1', '0.9.2', 'notes'], '0.1.0'), '0.9.2');
});

test('dev builds use the next patch after the latest release tag', () => {
  assert.equal(
    resolveBuildVersion({
      packageVersion: '0.9.2',
      tagsAtHead: [],
      allTags: ['v0.9.2'],
    }),
    '0.9.3-dev'
  );
});

test('release builds use the package version exactly', () => {
  assert.equal(
    resolveBuildVersion({
      packageVersion: '0.9.2',
      releaseOverride: true,
      allTags: ['v0.9.2'],
    }),
    '0.9.2'
  );
});

test('builds at the matching release tag use the package version exactly', () => {
  assert.equal(
    resolveBuildVersion({
      packageVersion: '0.9.2',
      tagsAtHead: ['v0.9.2'],
      allTags: ['v0.9.2'],
    }),
    '0.9.2'
  );
});

test('dev build stable recommendation uses the latest stable tag', () => {
  assert.equal(
    resolveStableVersion({
      packageVersion: '0.9.2',
      buildVersion: '0.9.3-dev',
      allTags: ['v0.9.1', 'v0.9.2'],
    }),
    '0.9.2'
  );
});

test('dev build stable recommendation falls back to package version without tags', () => {
  assert.equal(
    resolveStableVersion({
      packageVersion: '0.9.2',
      buildVersion: '0.9.3-dev',
      allTags: [],
    }),
    '0.9.2'
  );
});
