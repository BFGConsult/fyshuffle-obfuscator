/* FYShuffle — Node (CommonJS) */

/** @type {Record<string, boolean>} */
const deprecatedCoreWarnings = {};
const RAND_A = 1103515245;
const RAND_C = 12345;
const RAND_M = 2147483648;
/**
 * @param {string} name
 * @param {string} replacement
 */
function warnDeprecatedCore(name, replacement) {
  if (deprecatedCoreWarnings[name]) {
    return;
  }
  deprecatedCoreWarnings[name] = true;
  console.warn(
    `FYShuffle: ${name}() is deprecated; use ${replacement} instead.`,
  );
}
/**
 * @param {number} key
 * @param {string} apiName
 * @returns {number}
 */
function validateKey_internal(key, apiName) {
  if (!Number.isSafeInteger(key) || key < 0) {
    throw new TypeError(
      `FYShuffle.${apiName} requires a non-negative integer key`,
    );
  }
  return key;
}
/**
 * @param {number} X
 * @returns {number}
 */
function nextRand_internal(X) {
  return (RAND_A * X + RAND_C) % RAND_M;
}
/**
 * @deprecated Use higher-level FYShuffle helpers instead.
 * @param {number} X
 * @returns {number}
 */
function nextRand(X) {
  warnDeprecatedCore('nextRand', 'FYForward()/FYBackward()');
  X = validateKey_internal(X, 'nextRand');
  return nextRand_internal(X);
}
/**
 * @template T
 * @param {T[]} items
 * @param {number} key
 * @returns {void}
 */
function shuffleArray_internal(items, key) {
  var n = items.length;
  for (var i = 0; i < n; ++i) {
    key = (RAND_A * key + RAND_C) % RAND_M;
    var j = (key % (n - i)) + i;
    var tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
}
/**
 * @param {number} n
 * @param {number} key
 * @param {string} [apiName]
 * @returns {number[]}
 */
function genPerm_internal(n, key, apiName) {
  key = validateKey_internal(key, apiName || 'genPerm');
  var perm = new Array(n);
  for (var i = 0; i < n; ++i) {
    perm[i] = i;
  }
  shuffleArray_internal(perm, key);
  return perm;
}
/**
 * @template T
 * @param {T[]} items
 * @param {number} key
 * @returns {T[]}
 */
function permuteArray(items, key) {
  if (!Array.isArray(items)) {
    throw new TypeError('FYShuffle.permuteArray requires an array');
  }
  key = validateKey_internal(key, 'permuteArray');
  var result = items.slice();
  shuffleArray_internal(result, key);
  return result;
}
/**
 * @template T
 * @param {T[]} items
 * @param {number} key
 * @returns {T[]}
 */
function unpermuteArray(items, key) {
  if (!Array.isArray(items)) {
    throw new TypeError('FYShuffle.unpermuteArray requires an array');
  }
  var n = items.length;
  var perm = genPerm_internal(n, key, 'unpermuteArray');
  var result = new Array(n);
  for (var i = 0; i < n; ++i) {
    result[perm[i]] = items[i];
  }
  return result;
}
/**
 * @deprecated Use higher-level FYShuffle helpers instead.
 * @param {number} n
 * @param {number} key
 * @returns {number[]}
 */
function genPerm(n, key) {
  warnDeprecatedCore('genPerm', 'permuteArray()/unpermuteArray()');
  return genPerm_internal(n, key);
}

/**
 * Encodes a string to base64 using Buffer (Node.js).
 * @param {string} str - The string to encode.
 * @returns {string}
 */
function base64Encode(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}
/**
 * Decodes a base64-encoded string using Buffer (Node.js).
 * @param {string} b64 - The base64 string to decode.
 * @returns {string}
 */
function base64Decode(b64) {
  return Buffer.from(b64, 'base64').toString('utf8');
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
  key = validateKey_internal(key, 'FYForward');
  var b64 = base64Encode(text);
  if (b64.endsWith('==')) {
    b64 = b64.slice(0, -2);
  } else if (b64.endsWith('=')) {
    b64 = b64.slice(0, -1);
  }
  var chars = b64.split('');
  shuffleArray_internal(chars, key);
  return chars.join('');
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
  var perm = genPerm_internal(n, key, 'FYBackward');
  var b64a = new Array(n);
  for (var i = 0; i < n; ++i) {
    b64a[perm[i]] = enc[i];
  }
  return base64Decode(b64a.join(''));
}

module.exports = {
  FYForward,
  FYBackward,
  genPerm,
  nextRand,
  permuteArray,
  unpermuteArray,
};
