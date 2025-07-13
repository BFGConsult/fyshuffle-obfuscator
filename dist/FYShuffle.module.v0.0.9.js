/* FYShuffle — ES module */

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

export { FYForward, FYBackward, genPerm, nextRand };
