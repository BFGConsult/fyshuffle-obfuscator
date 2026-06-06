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

class FakeParent {
  constructor(children = []) {
    this.children = [];
    for (const child of children) {
      this.appendChild(child);
    }
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
  }

  insertBefore(child, reference) {
    const index = this.children.indexOf(reference);
    this.children.splice(index, 0, child);
  }

  replaceChild(child, oldChild) {
    const index = this.children.indexOf(oldChild);
    child.parentNode = this;
    this.children[index] = child;
    oldChild.parentNode = null;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    this.children.splice(index, 1);
    child.parentNode = null;
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
  }

  insertAdjacentHTML(position, html) {
    assert.equal(position, 'beforebegin');
    this.parentNode.insertBefore(html, this);
  }
}

class FakeDocument {
  constructor(elements = []) {
    this.root = new FakeParent(elements);
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  querySelectorAll(selector) {
    return this.root.children.filter(
      (child) => child instanceof FakeElement && this.matches(child, selector)
    );
  }

  matches(element, selector) {
    if (selector.startsWith('.')) {
      return element.className.split(/\s+/).includes(selector.slice(1));
    }
    if (selector.startsWith('#')) {
      return element.id === selector.slice(1);
    }
    return element.tagName.toLowerCase() === selector.toLowerCase();
  }
}

test('browser namespace exposes FYShuffle.apply and core helpers', async () => {
  const context = await loadBrowserContext();

  assert.equal(typeof context.FYShuffle, 'object');
  for (const name of [
    'FYForward',
    'FYBackward',
    'genPerm',
    'nextRand',
    'apply',
    'observe',
    'mtoClass',
    'mailtoClass',
    'unscrambleClass',
    'scrambleClass',
  ]) {
    assert.equal(typeof context.FYShuffle[name], 'function', `${name} should be available`);
  }
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
  assert.equal(context.document.root.children[0], 'Hidden text');
  assert.equal(context.document.root.children[1], scramble);

  observer.trigger([{ target: scramble, isIntersecting: true }]);
  assert.equal(context.document.root.children[1], context.FYForward('hello@example.com', key));
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

  controller.apply();
  assert.deepEqual(context.document.root.children, ['First', 'Second']);
  assert.deepEqual(observer.unobserved, [first, second]);

  controller.disconnect();
  assert.equal(observer.disconnected, true);
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

  assert.deepEqual(context.document.root.children, [
    'Protected content unavailable',
    'Protected content unavailable',
  ]);
  controller.apply();
  assert.deepEqual(context.document.root.children, [
    'Protected content unavailable',
    'Protected content unavailable',
  ]);
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

  assert.deepEqual(context.document.root.children, ['Contact information goes here']);
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
    'mailto:hello@example.com?cc=cc%40example.com&cc=cc2%40example.com&subject=Hello%20there'
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
    'mailto:hello@example.com?cc=cc%40example.com&cc=cc2%40example.com&bcc=bcc%40example.com&subject=Hello%20there&body=Body%20text'
  );
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
    'mailto:hello@example.com?cc=cc%40example.com&cc=cc2%40example.com&bcc=bcc%40example.com&subject=Hello%20there&body=Body%20text'
  );
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

  assert.deepEqual(context.document.root.children, ['Hidden text']);
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

  assert.deepEqual(context.document.root.children, [context.FYForward('hello@example.com', key)]);
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
  assert.equal(context.document.root.children[1], 'Hidden text');
  assert.equal(context.document.root.children[2], context.FYForward('hello@example.com', key));
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
