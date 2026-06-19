#!/usr/bin/env node
import { execFile } from 'child_process';
import fs from 'fs/promises';
import { pathToFileURL } from 'url';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export function allowedReleaseTags(version) {
  return [version, `v${version}`];
}

export function assertTagMatchesPackage(tagsAtHead, version) {
  const allowed = new Set(allowedReleaseTags(version));
  const matchingTag = tagsAtHead.find((tag) => allowed.has(tag));

  if (!matchingTag) {
    throw new Error(`No local release tag at HEAD matches package version ${version}`);
  }

  return matchingTag;
}

export function requiredReleaseFiles(version) {
  return [
    'LICENSE',
    'README.md',
    'bin/fyshuffle.js',
    'dist/FYShuffle.d.ts',
    'dist/FYShuffle.js',
    'dist/FYShuffle.min.js',
    'dist/FYShuffle.module.js',
    `dist/FYShuffle.module.v${version}.js`,
    'dist/FYShuffle.node.cjs',
    `dist/FYShuffle.node.v${version}.cjs`,
    `dist/FYShuffle.v${version}.js`,
    'dist/manifest.json',
    'package.json',
  ];
}

export function validatePackOutput(output, version) {
  const missing = requiredReleaseFiles(version).filter((file) => !output.includes(file));
  if (missing.length > 0) {
    throw new Error(`npm pack output is missing expected release files: ${missing.join(', ')}`);
  }

  const devArtifactPattern = /dist\/[^\s]*-dev[^\s]*/;
  const match = output.match(devArtifactPattern);
  if (match) {
    throw new Error(`npm pack output includes development artifact: ${match[0]}`);
  }
}

async function readPackageVersion() {
  const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
  return pkg.version;
}

async function run(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    maxBuffer: 1024 * 1024 * 10,
    ...options,
  });
  return `${result.stdout || ''}${result.stderr || ''}`;
}

async function tagsAtHead() {
  const output = await run('git', ['tag', '--points-at', 'HEAD']);
  return output.split(/\r?\n/).filter(Boolean);
}

async function packDryRun() {
  try {
    return await run(npmCommand, ['pack', '--dry-run']);
  } catch (err) {
    const output = `${err.stdout || ''}${err.stderr || ''}`;
    if (!output.includes('Your cache folder contains root-owned files')) {
      throw err;
    }
    return run(npmCommand, ['--cache', '/private/tmp/fyshuffle-npm-cache', 'pack', '--dry-run']);
  }
}

export async function main() {
  const version = await readPackageVersion();
  const matchingTag = assertTagMatchesPackage(await tagsAtHead(), version);

  console.log(`✓ Release tag ${matchingTag} matches package version ${version}`);

  await run(npmCommand, ['test']);
  console.log('✓ npm test passed');

  await run(npmCommand, ['run', 'build']);
  console.log('✓ npm run build passed');

  await run('git', ['diff', '--exit-code']);
  console.log('✓ checked-in artifacts are current');

  validatePackOutput(await packDryRun(), version);
  console.log('✓ npm pack --dry-run contents verified');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
