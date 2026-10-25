import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const browserSources = [
  'src/fyshuffle-core.js',
  'src/core/base64.browser.js',
  'src/fyshuffle-crypto.js',
  'src/fyshuffle-dom.js',
];

function stripModuleSyntax(code) {
  return code
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('import')) {
        return null;
      }

      const exportMatch = trimmed.match(/^export\s+(function|const|let|var|class)\s/);
      if (exportMatch) {
        return line.replace(/^export\s+/, '');
      }

      if (trimmed.startsWith('export')) {
        return null;
      }

      return line;
    })
    .filter(Boolean)
    .join('\n');
}

async function loadBrowserContext(options = {}) {
  const warnings = [];
  const context = {
    console: {
      warn(message) {
        warnings.push(message);
      },
    },
    encodeURIComponent,
    atob(value) {
      return Buffer.from(value, 'base64').toString('binary');
    },
    btoa(value) {
      return Buffer.from(value, 'binary').toString('base64');
    },
    TextDecoder,
    TextEncoder,
    Uint8Array,
    warnings,
    ...options,
  };
  context.globalThis = context;
  context.window = context;

  const code = (
    await Promise.all(
      browserSources.map(async (file) => stripModuleSyntax(await readFile(file, 'utf8')))
    )
  ).join('\n\n');

  vm.runInNewContext(code, context);
  return context;
}

async function loadBrowserArtifactContext(file, options = {}) {
  const warnings = [];
  const context = {
    console: {
      warn(message) {
        warnings.push(message);
      },
    },
    encodeURIComponent,
    atob(value) {
      return Buffer.from(value, 'base64').toString('binary');
    },
    btoa(value) {
      return Buffer.from(value, 'binary').toString('base64');
    },
    TextDecoder,
    TextEncoder,
    Uint8Array,
    warnings,
    ...options,
  };
  context.globalThis = context;
  context.window = context;

  vm.runInNewContext(await readFile(`dist/${file}`, 'utf8'), context);
  return context;
}

async function loadCurrentBrowserArtifactContext(options = {}) {
  const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
  const file = manifest.files.browser.dev || manifest.files.browser.legacy;
  return loadBrowserArtifactContext(file, options);
}

function createFakeIntersectionObserver() {
  const instances = [];

  class FakeIntersectionObserver {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      this.observed = [];
      this.unobserved = [];
      this.disconnected = false;
      instances.push(this);
    }

    observe(element) {
      this.observed.push(element);
    }

    unobserve(element) {
      this.unobserved.push(element);
      this.observed = this.observed.filter((observed) => observed !== element);
    }

    disconnect() {
      this.disconnected = true;
      this.observed = [];
    }

    trigger(entries) {
      this.callback(entries);
    }
  }

  FakeIntersectionObserver.instances = instances;
  return FakeIntersectionObserver;
}

class FakeTextNode {
  constructor(text) {
    this.nodeType = 3;
    this.textContent = String(text);
    this.parentNode = null;
  }
}

function childText(parent) {
  return parent.children.map((child) => child.textContent);
}

class FakeParent {
  constructor(children = []) {
    this.children = [];
    for (const child of children) {
      this.appendChild(child);
    }
  }

  appendChild(child) {
    this.#assertNode(child);
    child.parentNode = this;
    this.children.push(child);
  }

  insertBefore(child, reference) {
    this.#assertNode(child);
    const index = this.children.indexOf(reference);
    if (index === -1) {
      throw new Error('reference node is not a child');
    }
    child.parentNode = this;
    this.children.splice(index, 0, child);
  }

  replaceChild(child, oldChild) {
    this.#assertNode(child);
    const index = this.children.indexOf(oldChild);
    if (index === -1) {
      throw new Error('old child is not a child');
    }
    child.parentNode = this;
    this.children[index] = child;
    oldChild.parentNode = null;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    this.children.splice(index, 1);
    child.parentNode = null;
  }

  #assertNode(child) {
    if (!(child instanceof FakeElement || child instanceof FakeTextNode)) {
      throw new TypeError('insertBefore requires a Node');
    }
  }
}

class FakeElement {
  constructor(tagName, { className = '', id = '', dataset = {} } = {}) {
    this.tagName = tagName.toUpperCase();
    this.className = className;
    this.id = id;
    this.dataset = { ...dataset };
    this.parentNode = null;
    this.href = '';
    this.text = '';
    this.children = [];
  }

  appendChild(child) {
    if (!(child instanceof FakeElement || child instanceof FakeTextNode)) {
      throw new TypeError('appendChild requires a Node');
    }
    child.parentNode = this;
    this.children.push(child);
  }
}

class FakeDocument {
  constructor(elements = []) {
    this.root = new FakeParent(elements);
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  createTextNode(text) {
    return new FakeTextNode(text);
  }

  querySelectorAll(selector) {
    return this.#elements(this.root.children).filter((element) => this.matches(element, selector));
  }

  matches(element, selector) {
    if (selector === '[data-fyshuffle]') {
      return 'fyshuffle' in element.dataset;
    }
    if (selector.startsWith('.')) {
      return element.className.split(/\s+/).includes(selector.slice(1));
    }
    if (selector.startsWith('#')) {
      return element.id === selector.slice(1);
    }
    return element.tagName.toLowerCase() === selector.toLowerCase();
  }

  #elements(nodes) {
    const elements = [];
    for (const node of nodes) {
      if (!(node instanceof FakeElement)) {
        continue;
      }
      elements.push(node);
      elements.push(...this.#elements(node.children));
    }
    return elements;
  }
}

test('browser namespace exposes FYShuffle.apply and core helpers', async () => {
  const context = await loadBrowserContext();
  const expectedNamespace = [
    'FYBackward',
    'FYForward',
    'apply',
    'genPerm',
    'init',
    'mailtoClass',
    'mtoClass',
    'nextRand',
    'observe',
    'permuteArray',
    'scrambleClass',
    'unpermuteArray',
    'unscrambleClass',
  ];

  assert.equal(typeof context.FYShuffle, 'object');
  assert.deepEqual(Object.keys(context.FYShuffle).sort(), expectedNamespace);
  for (const name of expectedNamespace) {
    assert.equal(typeof context.FYShuffle[name], 'function', `${name} should be available`);
  }
});

test('browser build exposes deprecated DOM helpers as legacy globals', async () => {
  const context = await loadBrowserContext();

  for (const name of ['mtoClass', 'mailtoClass', 'unscrambleClass', 'scrambleClass']) {
    assert.equal(context[name], context.FYShuffle[name]);
  }
});

test('deprecated core helpers warn once and call through', async () => {
  const context = await loadBrowserContext();

  assert.equal(context.FYShuffle.nextRand(0), 12345);
  assert.equal(context.FYShuffle.nextRand(0), 12345);

  const perm = context.FYShuffle.genPerm(8, 123456);
  context.FYShuffle.genPerm(8, 123456);

  assert.equal(perm.length, 8);
  assert.deepEqual([...perm].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(context.warnings, [
    'FYShuffle: nextRand() is deprecated; use FYForward()/FYBackward() instead.',
    'FYShuffle: genPerm() is deprecated; use permuteArray()/unpermuteArray() instead.',
  ]);
});

test('FYForward and FYBackward do not trigger deprecated core warnings', async () => {
  const context = await loadBrowserContext();
  const key = 123456;

  assert.equal(
    context.FYBackward(context.FYForward('hello@example.com', key), key),
    'hello@example.com'
  );
  assert.deepEqual(context.warnings, []);
});

test('array permutation helpers round-trip without mutation or warnings', async () => {
  const context = await loadBrowserContext();
  const first = { id: 1 };
  const second = { id: 2 };
  const original = [first, second, { id: 3 }, { id: 4 }];

  const permuted = context.FYShuffle.permuteArray(original, 123456);
  const restored = context.FYShuffle.unpermuteArray(permuted, 123456);

  assert.notEqual(permuted, original);
  assert.notEqual(restored, permuted);
  assert.deepEqual(original, [first, second, { id: 3 }, { id: 4 }]);
  assert.deepEqual(Array.from(restored, (item) => item.id), [1, 2, 3, 4]);
  assert.equal(restored[0], first);
  assert.equal(restored[1], second);
  assert.deepEqual(context.warnings, []);
});

test('array permutation helpers require arrays', async () => {
  const context = await loadBrowserContext();

  assert.throws(
    () => context.FYShuffle.permuteArray('abc', 123456),
    /permuteArray requires an array/
  );
  assert.throws(
    () => context.FYShuffle.unpermuteArray('abc', 123456),
    /unpermuteArray requires an array/
  );
});

test('browser public APIs reject negative and fractional keys', async () => {
  const context = await loadBrowserContext();

  for (const badKey of [-1, 0.5]) {
    assert.throws(
      () => context.FYShuffle.FYForward('hello@example.com', badKey),
      /non-negative integer key/
    );
    assert.throws(() => context.FYShuffle.FYBackward('abc', badKey), /non-negative integer key/);
    assert.throws(
      () => context.FYShuffle.permuteArray(['a', 'b'], badKey),
      /non-negative integer key/
    );
    assert.throws(
      () => context.FYShuffle.unpermuteArray(['a', 'b'], badKey),
      /non-negative integer key/
    );
    assert.throws(() => context.FYShuffle.genPerm(2, badKey), /non-negative integer key/);
    assert.throws(() => context.FYShuffle.nextRand(badKey), /non-negative integer key/);
    assert.throws(() => context.FYShuffle.apply({ key: badKey }), /non-negative integer key/);
    assert.throws(() => context.FYShuffle.observe({ key: badKey }), /non-negative integer key/);
    assert.throws(
      () => context.FYShuffle.mailtoClass('email', badKey),
      /non-negative integer key/
    );
    assert.throws(
      () => context.FYShuffle.unscrambleClass('secret', badKey),
      /non-negative integer key/
    );
    assert.throws(
      () => context.FYShuffle.scrambleClass('encode', badKey),
      /non-negative integer key/
    );
    assert.throws(() => context.FYShuffle.mtoClass(badKey), /non-negative integer key/);
  }
});

test('FYShuffle.init processes declarative targets immediately', async () => {
  const context = await loadBrowserContext();
  const key = 123456;
  const mail = new FakeElement('span', {
    dataset: {
      fyshuffle: 'mailto',
      key: String(key),
      content: context.FYForward('hello@example.com', key),
      subjectContent: context.FYForward('Hello there', key),
    },
  });
  const text = new FakeElement('span', {
    dataset: {
      fyshuffle: 'text',
      key: String(key),
      content: context.FYForward('Hidden text', key),
    },
  });
  const scramble = new FakeElement('span', {
    dataset: {
      fyshuffle: 'scramble',
      key: String(key),
      content: 'visible@example.com',
    },
  });
  context.document = new FakeDocument([mail, text, scramble]);

  const controller = context.FYShuffle.init({ immediate: true });

  assert.equal(typeof controller.disconnect, 'function');
  assert.equal(typeof controller.apply, 'function');
  assert.equal(context.document.root.children[0].tagName, 'A');
  assert.equal(
    context.document.root.children[0].href,
    'mailto:hello@example.com?subject=Hello%20there'
  );
  assert.equal(context.document.root.children[1].textContent, 'Hidden text');
  assert.equal(
    context.document.root.children[2].textContent,
    context.FYForward('visible@example.com', key)
  );
});

test('FYShuffle.init defaults to observing declarative targets', async () => {
  const IntersectionObserver = createFakeIntersectionObserver();
  const context = await loadBrowserContext({ IntersectionObserver });
  const key = 123456;
  const element = new FakeElement('span', {
    dataset: {
      fyshuffle: 'mailto',
      key: String(key),
      content: context.FYForward('hello@example.com', key),
    },
  });
  context.document = new FakeDocument([element]);

  const controller = context.FYShuffle.init();

  const observer = IntersectionObserver.instances[0];
  assert.equal(typeof controller.disconnect, 'function');
  assert.equal(typeof controller.apply, 'function');
  assert.deepEqual(observer.observed, [element]);
  assert.deepEqual(context.document.root.children, [element]);

  observer.trigger([{ target: element, isIntersecting: true }]);

  assert.equal(context.document.root.children[0].tagName, 'A');
  assert.equal(context.document.root.children[0].href, 'mailto:hello@example.com');
  assert.deepEqual(observer.unobserved, [element]);
});

test('FYShuffle.init passes observer options and fallback text through', async () => {
  const IntersectionObserver = createFakeIntersectionObserver();
  const root = {};
  const context = await loadBrowserContext({ IntersectionObserver });
  const key = 123456;
  const element = new FakeElement('span', {
    dataset: {
      fyshuffle: 'text',
      key: String(key),
      content: context.FYForward('Hidden text', key),
    },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.init({
    immediate: false,
    root,
    rootMargin: '50px',
    threshold: 0.5,
    fallbackText: 'Hidden fallback',
  });

  const observer = IntersectionObserver.instances[0];
  assert.equal(observer.options.root, root);
  assert.equal(observer.options.rootMargin, '50px');
  assert.equal(observer.options.threshold, 0.5);
});

test('FYShuffle.observe waits for the configured intersection threshold', async () => {
  const IntersectionObserver = createFakeIntersectionObserver();
  const context = await loadBrowserContext({ IntersectionObserver });
  const key = 123456;
  const element = new FakeElement('span', {
    className: 'secret',
    dataset: { content: context.FYForward('Hidden text', key) },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.observe({ key, text: 'secret', threshold: 0.5 });
  const observer = IntersectionObserver.instances[0];
  observer.trigger([{ target: element, isIntersecting: true, intersectionRatio: 0.49 }]);
  assert.equal(context.document.root.children[0], element);
  assert.deepEqual(observer.unobserved, []);

  observer.trigger([{ target: element, isIntersecting: true, intersectionRatio: 0.5 }]);
  assert.equal(context.document.root.children[0].textContent, 'Hidden text');
  assert.deepEqual(observer.unobserved, [element]);
});

test('FYShuffle.init observes until its configured threshold is met', async () => {
  const IntersectionObserver = createFakeIntersectionObserver();
  const context = await loadBrowserContext({ IntersectionObserver });
  const key = 123456;
  const element = new FakeElement('span', {
    dataset: {
      fyshuffle: 'text',
      key: String(key),
      content: context.FYForward('Hidden text', key),
    },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.init({ threshold: [0, 0.5] });
  const observer = IntersectionObserver.instances[0];
  observer.trigger([{ target: element, isIntersecting: true, intersectionRatio: 0.1 }]);
  assert.equal(context.document.root.children[0], element);

  observer.trigger([{ target: element, isIntersecting: true, intersectionRatio: 0.5 }]);
  assert.equal(context.document.root.children[0].textContent, 'Hidden text');
});

test('FYShuffle.init controller can force apply or disconnect observed declarative targets', async () => {
  const IntersectionObserver = createFakeIntersectionObserver();
  const context = await loadBrowserContext({ IntersectionObserver });
  const key = 123456;
  const first = new FakeElement('span', {
    dataset: {
      fyshuffle: 'text',
      key: String(key),
      content: context.FYForward('First', key),
    },
  });
  const second = new FakeElement('span', {
    dataset: {
      fyshuffle: 'text',
      key: String(key),
      content: context.FYForward('Second', key),
    },
  });
  context.document = new FakeDocument([first, second]);

  const controller = context.FYShuffle.init({ immediate: false });
  const observer = IntersectionObserver.instances[0];

  controller.disconnect();
  assert.equal(observer.disconnected, true);

  controller.apply();
  assert.deepEqual(childText(context.document.root), ['First', 'Second']);
  assert.deepEqual(observer.unobserved, [first, second]);
});

test('FYShuffle.init with keyUrl transforms declarative targets immediately', async () => {
  const key = 123456;
  const context = await loadBrowserContext({
    fetch(url) {
      assert.equal(url, '/path/to/fyshuffle-key.json');
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ key }),
      });
    },
  });
  const mail = new FakeElement('span', {
    dataset: {
      fyshuffle: 'mailto',
      content: context.FYForward('hello@example.com', key),
    },
  });
  const text = new FakeElement('span', {
    dataset: {
      fyshuffle: 'text',
      content: context.FYForward('Hidden text', key),
    },
  });
  const scramble = new FakeElement('span', {
    dataset: {
      fyshuffle: 'scramble',
      content: 'visible@example.com',
    },
  });
  context.document = new FakeDocument([mail, text, scramble]);

  const initResult = context.FYShuffle.init({
    keyUrl: '/path/to/fyshuffle-key.json',
    immediate: true,
  });

  assert.equal(typeof initResult.then, 'function');
  const controller = await initResult;

  assert.equal(typeof controller.disconnect, 'function');
  assert.equal(typeof controller.apply, 'function');
  assert.equal(context.document.root.children[0].tagName, 'A');
  assert.equal(context.document.root.children[0].href, 'mailto:hello@example.com');
  assert.equal(context.document.root.children[1].textContent, 'Hidden text');
  assert.equal(
    context.document.root.children[2].textContent,
    context.FYForward('visible@example.com', key)
  );
});

test('FYShuffle.init with keyUrl observes only after the key is fetched', async () => {
  const IntersectionObserver = createFakeIntersectionObserver();
  let resolveFetch;
  const key = 123456;
  const context = await loadBrowserContext({
    IntersectionObserver,
    fetch() {
      return new Promise((resolve) => {
        resolveFetch = resolve;
      });
    },
  });
  const element = new FakeElement('span', {
    dataset: {
      fyshuffle: 'text',
      content: context.FYForward('Hidden text', key),
    },
  });
  context.document = new FakeDocument([element]);

  const initResult = context.FYShuffle.init({ keyUrl: '/path/to/fyshuffle-key.json' });

  assert.equal(typeof initResult.then, 'function');
  assert.deepEqual(IntersectionObserver.instances, []);
  assert.deepEqual(context.document.root.children, [element]);

  resolveFetch({
    ok: true,
    json: () => Promise.resolve({ key }),
  });
  const controller = await initResult;
  const observer = IntersectionObserver.instances[0];

  assert.equal(typeof controller.disconnect, 'function');
  assert.deepEqual(observer.observed, [element]);
  assert.deepEqual(context.document.root.children, [element]);

  observer.trigger([{ target: element, isIntersecting: true }]);

  assert.deepEqual(childText(context.document.root), ['Hidden text']);
  assert.deepEqual(observer.unobserved, [element]);
});

test('FYShuffle.init data-key overrides fetched key per element', async () => {
  const remoteKey = 111111;
  const elementKey = 222222;
  const context = await loadBrowserContext({
    fetch() {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ key: remoteKey }),
      });
    },
  });
  const remoteElement = new FakeElement('span', {
    dataset: {
      fyshuffle: 'text',
      content: context.FYForward('Remote key text', remoteKey),
    },
  });
  const overrideElement = new FakeElement('span', {
    dataset: {
      fyshuffle: 'text',
      key: String(elementKey),
      content: context.FYForward('Element key text', elementKey),
    },
  });
  context.document = new FakeDocument([remoteElement, overrideElement]);

  await context.FYShuffle.init({
    keyUrl: '/path/to/fyshuffle-key.json',
    immediate: true,
  });

  assert.deepEqual(childText(context.document.root), ['Remote key text', 'Element key text']);
});

test('FYShuffle.init with keyUrl rejects invalid remote key responses', async () => {
  for (const payload of [{}, { key: '123456' }]) {
    const context = await loadBrowserContext({
      fetch() {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(payload),
        });
      },
    });
    context.document = new FakeDocument([
      new FakeElement('span', {
        dataset: {
          fyshuffle: 'text',
          content: 'ignored',
        },
      }),
    ]);

    await assert.rejects(
      () => context.FYShuffle.init({ keyUrl: '/path/to/fyshuffle-key.json' }),
      /response must contain a numeric key/
    );
  }
});

test('FYShuffle.init with keyUrl rejects negative and fractional remote keys', async () => {
  for (const payload of [{ key: -1 }, { key: 0.5 }]) {
    const context = await loadBrowserContext({
      fetch() {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(payload),
        });
      },
    });
    context.document = new FakeDocument([
      new FakeElement('span', {
        dataset: {
          fyshuffle: 'text',
          content: 'ignored',
        },
      }),
    ]);

    await assert.rejects(
      () => context.FYShuffle.init({ keyUrl: '/path/to/fyshuffle-key.json' }),
      /non-negative integer key/
    );
  }
});

test('FYShuffle.init with keyUrl rejects failed fetches', async () => {
  const context = await loadBrowserContext({
    fetch() {
      return Promise.resolve({ ok: false, json: () => Promise.resolve({ key: 123456 }) });
    },
  });
  context.document = new FakeDocument([
    new FakeElement('span', {
      dataset: {
        fyshuffle: 'text',
        content: 'ignored',
      },
    }),
  ]);

  await assert.rejects(
    () => context.FYShuffle.init({ keyUrl: '/path/to/fyshuffle-key.json' }),
    /keyUrl request failed/
  );
});

test('FYShuffle.init fallback replaces declarative targets when IntersectionObserver is unavailable', async () => {
  const context = await loadBrowserContext();
  const key = 123456;
  const element = new FakeElement('span', {
    dataset: {
      fyshuffle: 'mailto',
      key: String(key),
      content: context.FYForward('hello@example.com', key),
    },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.init({ fallbackText: 'Contact unavailable' });

  assert.deepEqual(childText(context.document.root), ['Contact unavailable']);
});

test('FYShuffle.init fallback prefers per-element fallback text', async () => {
  const context = await loadBrowserContext();
  const key = 123456;
  const element = new FakeElement('span', {
    dataset: {
      fyshuffle: 'mailto',
      key: String(key),
      content: context.FYForward('hello@example.com', key),
      fallbackText: 'Use the contact form below',
    },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.init({ fallbackText: 'Global fallback' });

  assert.deepEqual(childText(context.document.root), ['Use the contact form below']);
});

test('FYShuffle.init fallback inserts plain text', async () => {
  const context = await loadBrowserContext();
  const key = 123456;
  const element = new FakeElement('span', {
    dataset: {
      fyshuffle: 'text',
      key: String(key),
      content: context.FYForward('Hidden text', key),
      fallbackText: '<strong>Use the contact form</strong>',
    },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.init();

  assert.deepEqual(childText(context.document.root), ['<strong>Use the contact form</strong>']);
});

test('FYShuffle.init rejects invalid declarative markup', async () => {
  const context = await loadBrowserContext();
  const key = 123456;

  assert.throws(
    () => context.FYShuffle.init(null),
    /FYShuffle\.init requires a config object/
  );
  assert.throws(
    () => context.FYShuffle.init({ immediate: 'true' }),
    /FYShuffle\.init immediate must be boolean/
  );
  assert.throws(
    () => context.FYShuffle.init({ keyUrl: 123456 }),
    /FYShuffle\.init keyUrl must be a string/
  );

  context.document = new FakeDocument([
    new FakeElement('span', {
      dataset: {
        fyshuffle: 'text',
        content: context.FYForward('Hidden text', key),
      },
    }),
  ]);
  assert.throws(
    () => context.FYShuffle.init({ immediate: true }),
    /data-key is required/
  );

  context.document = new FakeDocument([
    new FakeElement('span', {
      dataset: {
        fyshuffle: 'text',
        key: 'not-a-number',
        content: context.FYForward('Hidden text', key),
      },
    }),
  ]);
  assert.throws(
    () => context.FYShuffle.init({ immediate: true }),
    /data-key must be numeric/
  );

  context.document = new FakeDocument([
    new FakeElement('span', {
      dataset: {
        fyshuffle: 'text',
        key: '-1',
        content: context.FYForward('Hidden text', key),
      },
    }),
  ]);
  assert.throws(
    () => context.FYShuffle.init({ immediate: true }),
    /non-negative integer key/
  );

  context.document = new FakeDocument([
    new FakeElement('span', {
      dataset: {
        fyshuffle: 'text',
        key: '0.5',
        content: context.FYForward('Hidden text', key),
      },
    }),
  ]);
  assert.throws(
    () => context.FYShuffle.init({ immediate: true }),
    /non-negative integer key/
  );

  context.document = new FakeDocument([
    new FakeElement('span', {
      dataset: {
        fyshuffle: 'text',
        key: '',
        content: context.FYForward('Hidden text', key),
      },
    }),
  ]);
  assert.throws(
    () => context.FYShuffle.init({ immediate: true }),
    /data-key must be numeric/
  );

  context.document = new FakeDocument([
    new FakeElement('span', {
      dataset: {
        fyshuffle: 'unknown',
        key: String(key),
        content: context.FYForward('Hidden text', key),
      },
    }),
  ]);
  assert.throws(
    () => context.FYShuffle.init({ immediate: true }),
    /unknown data-fyshuffle value "unknown"/
  );
});

test('FYShuffle.init rejects declarative targets missing data-content', async () => {
  const context = await loadBrowserContext();
  const key = 123456;

  for (const mode of ['mailto', 'text', 'scramble']) {
    context.document = new FakeDocument([
      new FakeElement('span', {
        dataset: {
          fyshuffle: mode,
          key: String(key),
        },
      }),
    ]);

    assert.throws(
      () => context.FYShuffle.init({ immediate: true }),
      /data-content is required/
    );
  }
});

test('browser FYForward and FYBackward round-trip representative Unicode text', async () => {
  const context = await loadBrowserContext();
  const cases = [
    { text: 'hello@example.com', key: 123456 },
    { text: '', key: 0 },
    { text: 'hi', key: 42 },
    { text: 'æøå café', key: 8675309 },
    { text: 'Snowman ☃ and emoji 😀', key: 998877 },
    { text: '\uFEFF', key: 42 },
    { text: '\uFEFFleading byte-order mark', key: 42 },
    { text: 'embedded \uFEFF byte-order mark', key: 42 },
  ];

  for (const { text, key } of cases) {
    assert.equal(context.FYBackward(context.FYForward(text, key), key), text);
  }
});

test('browser FYForward matches the Node UTF-8 implementation', async () => {
  const context = await loadBrowserContext();
  const node = await import('../dist/FYShuffle.module.js');
  const cases = [
    { text: 'hello@example.com', key: 123456 },
    { text: 'hi', key: 42 },
    { text: 'æøå café', key: 8675309 },
    { text: 'Snowman ☃ and emoji 😀', key: 998877 },
  ];

  for (const { text, key } of cases) {
    assert.equal(context.FYForward(text, key), node.FYForward(text, key));
  }
});

test('browser FYBackward decodes legacy Latin-1 browser payloads where possible', async () => {
  const context = await loadBrowserContext();
  const key = 8675309;
  const text = 'æøå café';
  const b64 = Buffer.from(text, 'binary').toString('base64').replace(/=+$/, '');
  const perm = context.genPerm(b64.length, key);
  let encoded = '';

  for (let i = 0; i < b64.length; i++) {
    encoded += b64[perm[i]];
  }

  assert.equal(context.FYBackward(encoded, key), text);
});

test('FYShuffle shorthand targets escape class names that are not CSS identifiers', async () => {
  const selectors = [];
  const context = await loadBrowserContext({
    document: {
      querySelectorAll(selector) {
        selectors.push(selector);
        return [];
      },
    },
  });

  context.FYShuffle.apply({ key: 2, text: '123contact' });
  context.FYShuffle.apply({ key: 2, text: '-1contact' });
  context.FYShuffle.apply({ key: 2, text: '#already-a-selector' });
  context.FYShuffle.mtoClass(2);

  assert.deepEqual(selectors, [
    '.\\31 23contact',
    '.-\\31 contact',
    '#already-a-selector',
    '.\\31 WZhwWa',
  ]);
});

test('FYShuffle.observe waits for intersecting mailto targets', async () => {
  const IntersectionObserver = createFakeIntersectionObserver();
  const context = await loadBrowserContext({ IntersectionObserver });
  const key = 123456;
  const element = new FakeElement('span', {
    className: 'email',
    dataset: { content: context.FYForward('hello@example.com', key) },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.observe({ key, mailto: 'email' });

  const observer = IntersectionObserver.instances[0];
  assert.equal(observer.options.root, null);
  assert.equal(observer.options.rootMargin, '0px');
  assert.equal(observer.options.threshold, 0);
  assert.deepEqual(context.document.root.children, [element]);

  observer.trigger([{ target: element, isIntersecting: false }]);
  assert.deepEqual(context.document.root.children, [element]);

  observer.trigger([{ target: element, isIntersecting: true }]);
  const anchor = context.document.root.children[0];
  assert.equal(anchor.tagName, 'A');
  assert.equal(anchor.href, 'mailto:hello@example.com');
  assert.deepEqual(observer.unobserved, [element]);
});

test('FYShuffle.observe transforms text and scramble targets on intersection', async () => {
  const IntersectionObserver = createFakeIntersectionObserver();
  const context = await loadBrowserContext({ IntersectionObserver });
  const key = 42;
  const text = new FakeElement('span', {
    id: 'secret',
    dataset: { content: context.FYForward('Hidden text', key) },
  });
  const scramble = new FakeElement('span', {
    className: 'encode',
    dataset: { content: 'hello@example.com' },
  });
  context.document = new FakeDocument([text, scramble]);

  context.FYShuffle.observe({ key, text: '#secret', scramble: 'encode', rootMargin: '25px' });

  const observer = IntersectionObserver.instances[0];
  assert.equal(observer.options.rootMargin, '25px');
  observer.trigger([{ target: text, isIntersecting: true }]);
  assert.equal(context.document.root.children[0].textContent, 'Hidden text');
  assert.equal(context.document.root.children[1], scramble);

  observer.trigger([{ target: scramble, isIntersecting: true }]);
  assert.equal(
    context.document.root.children[1].textContent,
    context.FYForward('hello@example.com', key)
  );
});

test('FYShuffle.observe controller can disconnect or force apply', async () => {
  const IntersectionObserver = createFakeIntersectionObserver();
  const context = await loadBrowserContext({ IntersectionObserver });
  const key = 7;
  const first = new FakeElement('span', {
    className: 'secret',
    dataset: { content: context.FYForward('First', key) },
  });
  const second = new FakeElement('span', {
    className: 'secret',
    dataset: { content: context.FYForward('Second', key) },
  });
  context.document = new FakeDocument([first, second]);

  const controller = context.FYShuffle.observe({ key, text: 'secret' });
  const observer = IntersectionObserver.instances[0];

  controller.disconnect();
  assert.equal(observer.disconnected, true);

  controller.apply();
  assert.deepEqual(childText(context.document.root), ['First', 'Second']);
  assert.deepEqual(observer.unobserved, [first, second]);
});

test('FYShuffle.observe fallback replaces targets with default text', async () => {
  const context = await loadBrowserContext();
  const key = 123456;
  const mail = new FakeElement('span', {
    className: 'email',
    dataset: { content: context.FYForward('hello@example.com', key) },
  });
  const text = new FakeElement('span', {
    className: 'secret',
    dataset: { content: context.FYForward('Hidden text', key) },
  });
  context.document = new FakeDocument([mail, text]);

  const controller = context.FYShuffle.observe({ key, mailto: 'email', text: 'secret' });

  assert.deepEqual(childText(context.document.root), [
    'Protected content unavailable',
    'Protected content unavailable',
  ]);
  controller.apply();
  assert.deepEqual(childText(context.document.root), [
    'Protected content unavailable',
    'Protected content unavailable',
  ]);
});

test('current browser artifact uses text nodes for observer fallback', async () => {
  const context = await loadCurrentBrowserArtifactContext();
  const key = 123456;
  const element = new FakeElement('span', {
    className: 'secret',
    dataset: { content: context.FYShuffle.FYForward('Hidden text', key) },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.observe({ key, text: 'secret', fallbackText: '<strong>Fallback</strong>' });

  assert.equal(context.document.root.children.length, 1);
  assert.ok(context.document.root.children[0] instanceof FakeTextNode);
  assert.equal(context.document.root.children[0].textContent, '<strong>Fallback</strong>');
});

test('FYShuffle.observe fallbackText overrides default fallback', async () => {
  const context = await loadBrowserContext();
  const key = 123456;
  const element = new FakeElement('span', {
    className: 'email',
    dataset: { content: context.FYForward('hello@example.com', key) },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.observe({
    key,
    mailto: 'email',
    fallbackText: 'Contact information goes here',
  });

  assert.deepEqual(childText(context.document.root), ['Contact information goes here']);
});

test('FYShuffle.observe fallback prefers per-element fallback text', async () => {
  const context = await loadBrowserContext();
  const key = 123456;
  const element = new FakeElement('span', {
    className: 'email',
    dataset: {
      content: context.FYForward('hello@example.com', key),
      fallbackText: 'Use the contact form below',
    },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.observe({
    key,
    mailto: 'email',
    fallbackText: 'Global fallback',
  });

  assert.deepEqual(childText(context.document.root), ['Use the contact form below']);
});

test('FYShuffle.apply processes mailto targets using simple class names', async () => {
  const context = await loadBrowserContext();
  const key = 123456;
  const element = new FakeElement('span', {
    className: 'email',
    dataset: {
      content: context.FYForward('hello@example.com', key),
      cc: 'cc@example.com,cc2@example.com',
      subject: 'Hello there',
    },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.apply({ key, mailto: 'email' });

  const anchor = context.document.root.children[0];
  assert.equal(anchor.tagName, 'A');
  assert.equal(
    anchor.href,
    'mailto:hello@example.com?cc=cc%40example.com%2Ccc2%40example.com&subject=Hello%20there'
  );
  assert.equal(anchor.text, 'hello@example.com');
});

test('FYShuffle.apply decodes obfuscated mailto parameters', async () => {
  const context = await loadBrowserContext();
  const key = 123456;
  const element = new FakeElement('span', {
    className: 'email',
    dataset: {
      content: context.FYForward('hello@example.com', key),
      ccContent: context.FYForward('cc@example.com,cc2@example.com', key),
      bccContent: context.FYForward('bcc@example.com', key),
      subjectContent: context.FYForward('Hello there', key),
      bodyContent: context.FYForward('Body text', key),
    },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.apply({ key, mailto: 'email' });

  const anchor = context.document.root.children[0];
  assert.equal(
    anchor.href,
    'mailto:hello@example.com?cc=cc%40example.com%2Ccc2%40example.com&bcc=bcc%40example.com&subject=Hello%20there&body=Body%20text'
  );
});

test('FYShuffle.apply decodes Unicode mailto content', async () => {
  const context = await loadBrowserContext();
  const key = 123456;
  const element = new FakeElement('span', {
    className: 'email',
    dataset: {
      content: context.FYForward('kontakt+æøå@example.com', key),
      subjectContent: context.FYForward('Møte på café ☕', key),
      bodyContent: context.FYForward('Hei fra Tromsø 😀', key),
    },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.apply({ key, mailto: 'email' });

  const anchor = context.document.root.children[0];
  assert.equal(
    anchor.href,
    'mailto:kontakt+%C3%A6%C3%B8%C3%A5@example.com?subject=M%C3%B8te%20p%C3%A5%20caf%C3%A9%20%E2%98%95&body=Hei%20fra%20Troms%C3%B8%20%F0%9F%98%80'
  );
  assert.equal(anchor.text, 'kontakt+æøå@example.com');
});

function assertMailtoParts(anchor, recipient) {
  const queryIndex = anchor.href.indexOf('?');
  assert.notEqual(queryIndex, -1);
  assert.equal(decodeURIComponent(anchor.href.slice('mailto:'.length, queryIndex)), recipient);

  const params = new URLSearchParams(anchor.href.slice(queryIndex + 1));
  assert.equal(params.get('cc'), 'first@example.com,second@example.com');
  assert.equal(params.getAll('cc').length, 1);
  assert.equal(params.get('bcc'), 'third@example.com,fourth@example.com');
  assert.equal(params.getAll('bcc').length, 1);
  assert.equal(params.get('subject'), 'Hello');
  assert.equal(params.get('body'), 'Body');
}

test('FYShuffle.apply serializes reserved recipient characters and full address headers', async () => {
  const context = await loadBrowserContext();
  const key = 123456;

  for (const recipient of ['a?b@example.com', 'a#b@example.com', 'a%20b@example.com']) {
    const element = new FakeElement('span', {
      className: 'email',
      dataset: {
        content: context.FYForward(recipient, key),
        cc: 'first@example.com,second@example.com',
        bcc: 'third@example.com,fourth@example.com',
        subject: 'Hello',
        body: 'Body',
      },
    });
    context.document = new FakeDocument([element]);

    context.FYShuffle.apply({ key, mailto: 'email' });

    const anchor = context.document.root.children[0];
    assert.equal(anchor.text, recipient);
    assertMailtoParts(anchor, recipient);
  }
});

test('FYShuffle.apply decodes compact obfuscated mailto payloads', async () => {
  const context = await loadBrowserContext();
  const key = 123456;
  const payload = {
    to: 'hello@example.com',
    cc: 'cc@example.com,cc2@example.com',
    bcc: 'bcc@example.com',
    subject: 'Hello there',
    body: 'Body text',
  };
  const element = new FakeElement('span', {
    className: 'email',
    dataset: {
      content: context.FYForward(JSON.stringify(payload), key),
    },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.apply({ key, mailto: 'email' });

  const anchor = context.document.root.children[0];
  assert.equal(
    anchor.href,
    'mailto:hello@example.com?cc=cc%40example.com%2Ccc2%40example.com&bcc=bcc%40example.com&subject=Hello%20there&body=Body%20text'
  );
});

test('FYShuffle.apply decodes compact Unicode mailto payloads', async () => {
  const context = await loadBrowserContext();
  const key = 123456;
  const payload = {
    to: 'kontakt+æøå@example.com',
    subject: 'Møte på café ☕',
    body: 'Hei fra Tromsø 😀',
  };
  const element = new FakeElement('span', {
    className: 'email',
    dataset: {
      content: context.FYForward(JSON.stringify(payload), key),
    },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.apply({ key, mailto: 'email' });

  assert.equal(
    context.document.root.children[0].href,
    'mailto:kontakt+%C3%A6%C3%B8%C3%A5@example.com?subject=M%C3%B8te%20p%C3%A5%20caf%C3%A9%20%E2%98%95&body=Hei%20fra%20Troms%C3%B8%20%F0%9F%98%80'
  );
});

test('FYShuffle.apply serializes reserved compact recipients and full address headers', async () => {
  const context = await loadBrowserContext();
  const key = 123456;

  for (const recipient of ['a?b@example.com', 'a#b@example.com', 'a%20b@example.com']) {
    const payload = {
      to: recipient,
      cc: 'first@example.com,second@example.com',
      bcc: 'third@example.com,fourth@example.com',
      subject: 'Hello',
      body: 'Body',
    };
    const element = new FakeElement('span', {
      className: 'email',
      dataset: { content: context.FYForward(JSON.stringify(payload), key) },
    });
    context.document = new FakeDocument([element]);

    context.FYShuffle.apply({ key, mailto: 'email' });

    const anchor = context.document.root.children[0];
    assert.equal(anchor.text, recipient);
    assertMailtoParts(anchor, recipient);
  }
});

test('current browser artifact serializes compact mailto recipients and address headers', async () => {
  const context = await loadCurrentBrowserArtifactContext();
  const key = 123456;
  const recipient = 'a?b@example.com';
  const payload = {
    to: recipient,
    cc: 'first@example.com,second@example.com',
    bcc: 'third@example.com,fourth@example.com',
    subject: 'Hello',
    body: 'Body',
  };
  const element = new FakeElement('span', {
    className: 'email',
    dataset: { content: context.FYShuffle.FYForward(JSON.stringify(payload), key) },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.apply({ key, mailto: 'email' });

  assertMailtoParts(context.document.root.children[0], recipient);
});

test('FYShuffle.apply rejects cleartext and obfuscated mailto field conflicts', async () => {
  const context = await loadBrowserContext();
  const key = 123456;
  const element = new FakeElement('span', {
    className: 'email',
    dataset: {
      content: context.FYForward('hello@example.com', key),
      subject: 'Clear subject',
      subjectContent: context.FYForward('Encoded subject', key),
    },
  });
  context.document = new FakeDocument([element]);

  assert.throws(
    () => context.FYShuffle.apply({ key, mailto: 'email' }),
    /data-subject and data-subject-content cannot both be set/
  );
});

test('FYShuffle.observe uses obfuscated mailto parameters on intersection', async () => {
  const IntersectionObserver = createFakeIntersectionObserver();
  const context = await loadBrowserContext({ IntersectionObserver });
  const key = 123456;
  const element = new FakeElement('span', {
    className: 'email',
    dataset: {
      content: context.FYForward('hello@example.com', key),
      subjectContent: context.FYForward('Observed subject', key),
    },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.observe({ key, mailto: 'email' });
  IntersectionObserver.instances[0].trigger([{ target: element, isIntersecting: true }]);

  assert.equal(
    context.document.root.children[0].href,
    'mailto:hello@example.com?subject=Observed%20subject'
  );
});

test('FYShuffle.observe uses compact obfuscated mailto payloads on intersection', async () => {
  const IntersectionObserver = createFakeIntersectionObserver();
  const context = await loadBrowserContext({ IntersectionObserver });
  const key = 123456;
  const element = new FakeElement('span', {
    className: 'email',
    dataset: {
      content: context.FYForward(
        JSON.stringify({ to: 'hello@example.com', subject: 'Observed subject' }),
        key
      ),
    },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.observe({ key, mailto: 'email' });
  IntersectionObserver.instances[0].trigger([{ target: element, isIntersecting: true }]);

  assert.equal(
    context.document.root.children[0].href,
    'mailto:hello@example.com?subject=Observed%20subject'
  );
});

test('FYShuffle.apply processes text targets using explicit selectors', async () => {
  const context = await loadBrowserContext();
  const key = 42;
  const element = new FakeElement('span', {
    id: 'secret',
    dataset: { content: context.FYForward('Hidden text', key) },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.apply({ key, text: '#secret' });

  assert.deepEqual(childText(context.document.root), ['Hidden text']);
});

test('FYShuffle.apply processes Unicode text targets', async () => {
  const context = await loadBrowserContext();
  const key = 42;
  const element = new FakeElement('span', {
    id: 'secret',
    dataset: { content: context.FYForward('Skjult æøå café 😀', key) },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.apply({ key, text: '#secret' });

  assert.deepEqual(childText(context.document.root), ['Skjult æøå café 😀']);
});

test('FYShuffle.apply renders decoded text as a text node', async () => {
  const context = await loadBrowserContext();
  const key = 42;
  const decoded = '<img src=x onerror="globalThis.reviewProof=1"> &amp;';
  const element = new FakeElement('span', {
    id: 'secret',
    dataset: { content: context.FYForward(decoded, key) },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.apply({ key, text: '#secret' });

  assert.equal(context.document.root.children.length, 1);
  assert.ok(context.document.root.children[0] instanceof FakeTextNode);
  assert.equal(context.document.root.children[0].textContent, decoded);
});

test('FYShuffle.apply processes scramble targets', async () => {
  const context = await loadBrowserContext();
  const key = 99;
  const element = new FakeElement('span', {
    className: 'encode',
    dataset: { content: 'hello@example.com' },
  });
  context.document = new FakeDocument([element]);

  context.FYShuffle.apply({ key, scramble: 'encode' });

  assert.deepEqual(childText(context.document.root), [context.FYForward('hello@example.com', key)]);
});

test('deprecated helpers call through and warn only once per helper', async () => {
  const context = await loadBrowserContext();
  const key = 123456;
  const mail = new FakeElement('span', {
    className: 'email',
    dataset: { content: context.FYForward('hello@example.com', key) },
  });
  const text = new FakeElement('span', {
    className: 'secret',
    dataset: { content: context.FYForward('Hidden text', key) },
  });
  const scramble = new FakeElement('span', {
    className: 'encode',
    dataset: { content: 'hello@example.com' },
  });
  context.document = new FakeDocument([mail, text, scramble]);

  context.mailtoClass('email', key);
  context.mailtoClass('email', key);
  context.unscrambleClass('secret', key);
  context.unscrambleClass('secret', key);
  context.scrambleClass('encode', key);
  context.scrambleClass('encode', key);

  assert.equal(context.document.root.children[0].tagName, 'A');
  assert.equal(context.document.root.children[0].href, 'mailto:hello@example.com');
  assert.equal(context.document.root.children[1].textContent, 'Hidden text');
  assert.equal(
    context.document.root.children[2].textContent,
    context.FYForward('hello@example.com', key)
  );
  assert.equal(
    context.warnings.filter((warning) => warning.startsWith('FYShuffle: mailtoClass()')).length,
    1
  );
  assert.equal(
    context.warnings.filter((warning) => warning.startsWith('FYShuffle: unscrambleClass()')).length,
    1
  );
  assert.equal(
    context.warnings.filter((warning) => warning.startsWith('FYShuffle: scrambleClass()')).length,
    1
  );
});

test('mtoClass warns only for mtoClass', async () => {
  const context = await loadBrowserContext();
  const key = 123456;
  context.document = new FakeDocument();

  context.mtoClass(key);
  context.mtoClass(key);

  assert.equal(context.warnings.length, 1);
  assert.match(context.warnings[0], /mtoClass\(\) is deprecated/);
  assert.doesNotMatch(context.warnings[0], /mailtoClass\(\)/);
});
