#!/usr/bin/env node

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { FYForward, FYBackward } = require('../dist/FYShuffle.node.cjs');

function usage() {
  return [
    'Usage:',
    '  fyshuffle encode --key <number> --text <value>',
    '  fyshuffle decode --key <number> --text <value>',
    '  fyshuffle mailto --key <number> --to <email> [--cc <list>] [--bcc <list>] [--subject <text>] [--body <text>] [--class <name>] [--text <fallback>] [--mode full|compact]',
  ].join('\n');
}

function parseArgs(argv) {
  const args = {};
  const positionals = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    const eq = arg.indexOf('=');
    if (eq !== -1) {
      args[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }

    const name = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for --${name}`);
    }
    args[name] = value;
    i++;
  }

  return { args, positionals };
}

function requireValue(args, name) {
  if (args[name] === undefined) {
    throw new Error(`Missing required --${name}`);
  }
  return args[name];
}

function parseKey(args) {
  const raw = requireValue(args, 'key');
  const key = Number(raw);
  if (!Number.isFinite(key)) {
    throw new Error('--key must be a number');
  }
  return key;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function mailtoSnippet(args) {
  const key = parseKey(args);
  const className = args.class || 'fyshuffle-mailto';
  const text = args.text || 'Protected contact';
  const mode = args.mode || 'full';
  const to = requireValue(args, 'to');
  const attrs = [['class', className]];

  if (mode !== 'full' && mode !== 'compact') {
    throw new Error('--mode must be full or compact');
  }

  if (mode === 'compact') {
    const payload = { to };
    for (const field of ['cc', 'bcc', 'subject', 'body']) {
      if (args[field] !== undefined) {
        payload[field] = args[field];
      }
    }
    attrs.push(['data-content', FYForward(JSON.stringify(payload), key)]);
  } else {
    attrs.push(['data-content', FYForward(to, key)]);

    for (const field of ['cc', 'bcc', 'subject', 'body']) {
      if (args[field] !== undefined) {
        attrs.push([`data-${field}-content`, FYForward(args[field], key)]);
      }
    }
  }

  const attrText = attrs
    .map(([name, value]) => `${name}="${escapeHtml(value)}"`)
    .join(' ');

  return `<span ${attrText}>${escapeHtml(text)}</span>`;
}

function main(argv) {
  const command = argv[0];
  const { args, positionals } = parseArgs(argv.slice(1));

  if (positionals.length > 0) {
    throw new Error(`Unexpected argument: ${positionals[0]}`);
  }

  if (command === 'encode') {
    return FYForward(requireValue(args, 'text'), parseKey(args));
  }
  if (command === 'decode') {
    return FYBackward(requireValue(args, 'text'), parseKey(args));
  }
  if (command === 'mailto') {
    return mailtoSnippet(args);
  }

  throw new Error(command ? `Unknown command: ${command}` : 'Missing command');
}

try {
  console.log(main(process.argv.slice(2)));
} catch (error) {
  console.error(error.message);
  console.error('');
  console.error(usage());
  process.exitCode = 1;
}
