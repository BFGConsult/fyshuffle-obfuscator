/* FYShuffle.js — browser (UMD-style) */

/**
 * @param {number} X
 * @returns {number}
 */
function nextRand(X) {
  var a = 1103515245;
  var c = 12345;
  var m = 1 << 31;
  return (a * X + c) % m;
}
/**
 * @param {number} n
 * @param {number} key
 * @returns {number[]}
 */
function genPerm(n, key) {
  var perm = [...Array(n).keys()];
  for (var i = 0; i < n; ++i) {
    key = nextRand(key);
    var j = (key % (n - i)) + i;
    var tmp = perm[i];
    perm[i] = perm[j];
    perm[j] = tmp;
  }
  return perm;
}

/**
 * Encodes a string to base64 using the browser's `btoa` function.
 *
 * @param {string} str - The input string to encode.
 * @returns {string} - The base64-encoded output.
 */
function base64Encode(str) {
  return window.btoa(str);
}
/**
 * Decodes a base64-encoded string using the browser's `atob` function.
 *
 * @param {string} str - The base64 string to decode.
 * @returns {string} - The decoded plain string.
 */
function base64Decode(str) {
  return window.atob(str);
}

// @ts-ignore: TS2792 - base64.js is resolved during bundle
/**
 * Obfuscates a string using a base64 permutation based on a numeric key.
 *
 * @param {string} text - The input string to encode.
 * @param {number} key - A numeric key used to seed the permutation.
 * @returns {string} The obfuscated output string.
 */
function FYForward(text, key) {
  var b64 = base64Encode(text);
  b64 = b64.replace(/=+$/, '');
  var n = b64.length;
  var perm = genPerm(n, key);
  var enc = '';
  for (var i = 0; i < n; ++i) {
    enc += b64[perm[i]];
  }
  return enc;
}
/**
 * Reverses the obfuscation produced by FYForward.
 *
 * @param {string} enc - The obfuscated input string.
 * @param {number} key - The numeric key that was used to encode the string.
 * @returns {string} The original decoded string.
 */
function FYBackward(enc, key) {
  var n = enc.length;
  var perm = genPerm(n, key);
  var b64a = [];
  for (var i = 0; i < n; ++i) {
    b64a[perm[i]] = enc[i];
  }
  return base64Decode(b64a.join(''));
}

const deprecatedWarnings = {};
function warnDeprecated(name, replacement) {
  if (deprecatedWarnings[name]) {
    return;
  }
  deprecatedWarnings[name] = true;
  console.warn(
    `FYShuffle: ${name}() is deprecated; use ${replacement} instead.`,
  );
}
function normalizeTarget(target) {
  if (typeof target !== 'string') {
    throw new TypeError('FYShuffle target values must be strings');
  }
  if (/^[A-Za-z0-9_-]+$/.test(target)) {
    return '.' + target;
  }
  return target;
}
function selectTarget(target) {
  return document.querySelectorAll(normalizeTarget(target));
}
function replaceWithText(element, text) {
  element.insertAdjacentHTML('beforebegin', text);
  element.parentNode.removeChild(element);
}
function transformMailtoElement(element, key) {
  const target = FYBackward(element.dataset['content'], key);
  const anchor = document.createElement('a');
  const fields = [];
  const esc = encodeURIComponent;
  for (const field of ['cc', 'bcc', 'subject', 'body']) {
    if (field in element.dataset) {
      if (field[field.length - 1] === 'c') {
        for (const mail of element.dataset[field].split(',')) {
          fields.push(`${field}=${esc(mail)}`);
        }
      } else {
        fields.push(`${field}=${esc(element.dataset[field])}`);
      }
    }
  }
  let query = '';
  if (fields.length > 0) {
    query = '?' + fields.shift();
    for (const f of fields) {
      query += '&' + f;
    }
  }
  anchor.href = 'mailto:' + target + query;
  anchor.text = target;
  element.parentNode.replaceChild(anchor, element);
}
function transformTextElement(element, key) {
  replaceWithText(element, FYBackward(element.dataset['content'], key));
}
function transformScrambleElement(element, key) {
  replaceWithText(element, FYForward(element.dataset['content'], key));
}
function applyTarget(target, key, transform) {
  /** @type {NodeListOf<HTMLElement>} */
  const elements = selectTarget(target);
  Array.prototype.forEach.call(elements, function (element) {
    transform(element, key);
  });
}
function validateConfig(config, apiName) {
  if (!config || typeof config !== 'object') {
    throw new TypeError(`FYShuffle.${apiName} requires a config object`);
  }
  const key = config.key;
  if (typeof key !== 'number' || !Number.isFinite(key)) {
    throw new TypeError(`FYShuffle.${apiName} requires a numeric key`);
  }
  return key;
}
function applyConfig(config) {
  const key = validateConfig(config, 'apply');
  if (config.mailto !== undefined) {
    applyTarget(config.mailto, key, transformMailtoElement);
  }
  if (config.text !== undefined) {
    applyTarget(config.text, key, transformTextElement);
  }
  if (config.scramble !== undefined) {
    applyTarget(config.scramble, key, transformScrambleElement);
  }
}
function collectObservedTargets(config, key) {
  const seen = new Set();
  const targets = [];
  const addTargets = function (target, transform) {
    if (target === undefined) {
      return;
    }
    Array.prototype.forEach.call(selectTarget(target), function (element) {
      if (seen.has(element)) {
        return;
      }
      seen.add(element);
      targets.push({ element, transform, key });
    });
  };
  addTargets(config.mailto, transformMailtoElement);
  addTargets(config.text, transformTextElement);
  addTargets(config.scramble, transformScrambleElement);
  return targets;
}
function replaceTargetsWithFallback(targets, fallbackText) {
  targets.forEach(function (target) {
    if (target.element.parentNode) {
      replaceWithText(target.element, fallbackText);
    }
  });
}
function observeConfig(config) {
  const key = validateConfig(config, 'observe');
  const targets = collectObservedTargets(config, key);
  const pending = new Set(targets);
  const observerOptions = {
    root: config.root || null,
    rootMargin: config.rootMargin || '0px',
    threshold: config.threshold === undefined ? 0 : config.threshold,
  };
  function transformTarget(target, observer) {
    if (!pending.has(target)) {
      return;
    }
    pending.delete(target);
    if (observer) {
      observer.unobserve(target.element);
    }
    if (target.element.parentNode) {
      target.transform(target.element, target.key);
    }
  }
  if (typeof IntersectionObserver !== 'function') {
    const fallbackText =
      config.fallbackText === undefined
        ? 'Protected content unavailable'
        : config.fallbackText;
    replaceTargetsWithFallback(targets, fallbackText);
    return {
      disconnect() {},
      apply() {},
    };
  }
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) {
        return;
      }
      targets.forEach(function (target) {
        if (target.element === entry.target) {
          transformTarget(target, observer);
        }
      });
    });
  }, observerOptions);
  targets.forEach(function (target) {
    observer.observe(target.element);
  });
  return {
    disconnect() {
      observer.disconnect();
      pending.clear();
    },
    apply() {
      Array.from(pending).forEach(function (target) {
        transformTarget(target, observer);
      });
    },
  };
}
/**
 * Decodes a base64-encoded class name and calls mailtoClass with the result.
 *
 * The class name is assumed to be the class name 'email' encoded with key
 *
 * @param {number} key - A numeric key used for decoding obfuscated content.
 * @throws {Error} If the provided class name is not valid base64.
 */
function mtoClass(key) {
  warnDeprecated('mtoClass', 'FYShuffle.apply({ key, mailto: decodedClass })');
  const decoded = FYForward(atob('ZW1haWw='), key);
  applyConfig({ key, mailto: decoded });
}
/**
 * Replace obfuscated email spans with <a href="mailto:..."> links.
 * Also supports optional `data-cc`, `data-bcc`, `data-subject`, and `data-body` attributes.
 *
 * @param {string} classId - The class name of elements to target (without the dot prefix).
 * @param {number} key - The numeric scramble key used to decode email addresses.
 */
function mailtoClass(classId, key) {
  warnDeprecated(
    'mailtoClass',
    `FYShuffle.apply({ key, mailto: "${classId}" })`,
  );
  applyConfig({ key, mailto: classId });
}
/**
 * Replaces obfuscated elements with their decoded plain text content.
 *
 * @param {string} classId - The class name of elements to unscramble.
 * @param {number} key - The numeric scramble key used to decode the content.
 */
function unscrambleClass(classId, key) {
  warnDeprecated(
    'unscrambleClass',
    `FYShuffle.apply({ key, text: "${classId}" })`,
  );
  applyConfig({ key, text: classId });
}
/**
 * Replaces visible text elements with scrambled strings.
 *
 * @param {string} classId - The class name of elements to scramble.
 * @param {number} key - The numeric scramble key used to encode the content.
 */
function scrambleClass(classId, key) {
  warnDeprecated(
    'scrambleClass',
    `FYShuffle.apply({ key, scramble: "${classId}" })`,
  );
  applyConfig({ key, scramble: classId });
}
globalThis.FYShuffle = {
  FYForward,
  FYBackward,
  genPerm,
  nextRand,
  apply: applyConfig,
  observe: observeConfig,
  mtoClass,
  mailtoClass,
  unscrambleClass,
  scrambleClass,
};
