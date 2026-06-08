import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function readText(path) {
  return readFile(path, 'utf8');
}

test('declarative init example includes expected browser controls and attributes', async () => {
  const html = await readText('examples/init-declarative.html');

  assert.match(html, /FYShuffle\.init\(/);
  assert.match(html, /data-fyshuffle=/);
  assert.match(html, /data-key=/);
  assert.match(html, /id="force-apply"/);
  assert.match(html, /id="disconnect"/);
});

test('observe fallback example disables IntersectionObserver and configures fallback text', async () => {
  const html = await readText('examples/observe-fallback.html');

  assert.match(html, /window\.IntersectionObserver\s*=\s*undefined/);
  assert.match(html, /FYShuffle\.observe\(/);
  assert.match(html, /fallbackText:/);
  assert.match(html, /data-fallback-text=/);
});

test('mailto generator shows inline and explicit fallback snippets', async () => {
  const html = await readText('examples/generate-mailto.html');

  assert.match(html, /Inline fallback HTML/);
  assert.match(html, /id="inline-output"/);
  assert.match(html, /Explicit fallback HTML/);
  assert.match(html, /id="explicit-output"/);
});

test('package and lockfile root versions match', async () => {
  const pkg = JSON.parse(await readText('package.json'));
  const lock = JSON.parse(await readText('package-lock.json'));

  assert.equal(lock.packages[''].version, pkg.version);
  assert.equal(lock.version, pkg.version);
});

test('package identity is distinct from runtime and CLI names', async () => {
  const pkg = JSON.parse(await readText('package.json'));
  const lock = JSON.parse(await readText('package-lock.json'));

  assert.equal(pkg.name, 'fyshuffle-obfuscator');
  assert.equal(lock.name, 'fyshuffle-obfuscator');
  assert.equal(lock.packages[''].name, 'fyshuffle-obfuscator');
  assert.deepEqual(pkg.bin, { fyshuffle: './bin/fyshuffle.js' });
});

test('package includes release build script', async () => {
  const pkg = JSON.parse(await readText('package.json'));

  assert.equal(pkg.scripts['build:release'], 'node scripts/build.js --release && npm run tsgen && npm run types');
});

test('declaration build targets the core module API, not browser bundles', async () => {
  const tsconfig = JSON.parse(await readText('tsconfig.build.json'));

  assert.equal(tsconfig.compilerOptions.declaration, true);
  assert.equal(tsconfig.compilerOptions.emitDeclarationOnly, true);
  assert.deepEqual(tsconfig.include, ['src/FYShuffle.module.js']);
});

test('publish workflow contains release verification and trusted publishing steps', async () => {
  const workflow = await readText('.github/workflows/publish.yml');

  assert.match(workflow, /tags:/);
  assert.match(workflow, /v\*\.\*\.\*/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /git diff --exit-code/);
  assert.match(workflow, /npm pack --dry-run/);
  assert.match(workflow, /npm publish --provenance --access public/);
  assert.match(workflow, /id-token: write/);
});
