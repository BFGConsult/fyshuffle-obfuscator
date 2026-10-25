import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function createBuildFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'fyshuffle-build-'));
  const workspace = process.cwd();

  await Promise.all(
    ['package.json', 'scripts', 'src', 'dist'].map((entry) =>
      cp(path.join(workspace, entry), path.join(root, entry), { recursive: true })
    )
  );
  await symlink(path.join(workspace, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  t.after(() => rm(root, { force: true, recursive: true }));

  return root;
}

test('partial release builds reject a development artifact mode transition', async (t) => {
  const root = await createBuildFixture(t);
  const packagePath = path.join(root, 'package.json');
  const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
  packageJson.version = '9.8.7';
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

  await execFileAsync(process.execPath, ['scripts/build.js', '--dev'], { cwd: root });

  const manifest = JSON.parse(await readFile(path.join(root, 'dist/manifest.json'), 'utf8'));
  const paths = [
    path.join('dist', manifest.files.node.versioned),
    'dist/manifest.json',
    'package.json',
  ];
  const before = await Promise.all(paths.map((entry) => readFile(path.join(root, entry), 'utf8')));

  await assert.rejects(
    execFileAsync(process.execPath, ['scripts/build.js', '--release', '--target=node'], {
      cwd: root,
    }),
    /would invalidate existing metadata; run a full build instead/
  );

  const after = await Promise.all(paths.map((entry) => readFile(path.join(root, entry), 'utf8')));
  assert.deepEqual(after, before);
});
