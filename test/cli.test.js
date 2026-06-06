import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const cli = fileURLToPath(new URL('../bin/fyshuffle.js', import.meta.url));

async function runCli(args) {
  return execFileAsync(process.execPath, [cli, ...args]);
}

test('CLI encode output round-trips through decode', async () => {
  const encoded = await runCli(['encode', '--key', '123456', '--text', 'hello@example.com']);
  const decoded = await runCli(['decode', '--key', '123456', '--text', encoded.stdout.trim()]);

  assert.equal(decoded.stdout.trim(), 'hello@example.com');
});

test('CLI mailto emits obfuscated HTML snippet', async () => {
  const { stdout } = await runCli([
    'mailto',
    '--key',
    '123456',
    '--to',
    'hello@example.com',
    '--subject',
    'Hello there',
    '--cc',
    'cc@example.com,cc2@example.com',
  ]);

  assert.match(stdout, /^<span class="fyshuffle-mailto" data-content="[^"]+"/);
  assert.match(stdout, /data-subject-content="[^"]+"/);
  assert.match(stdout, /data-cc-content="[^"]+"/);
  assert.doesNotMatch(stdout, /Hello there/);
  assert.doesNotMatch(stdout, /cc@example\.com/);
});

test('CLI mailto supports class and escaped visible text', async () => {
  const { stdout } = await runCli([
    'mailto',
    '--key',
    '123456',
    '--to',
    'hello@example.com',
    '--class',
    'contact',
    '--text',
    '<Contact & support>',
  ]);

  assert.match(stdout, /class="contact"/);
  assert.match(stdout, />&lt;Contact &amp; support&gt;<\/span>/);
});

test('CLI exits nonzero for missing required flags', async () => {
  await assert.rejects(
    () => runCli(['mailto', '--key', '123456']),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /Missing required --to/);
      return true;
    }
  );
});
