console.warn(
  'FYShuffle: You are using the unversioned FYShuffle.js. For long-term stability, consider switching to a versioned file like FYShuffle.v0.9.1.js',
);

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

/**
 * Decodes a base64-encoded class name and calls mailtoClass with the result.
 *
 * The class name is assumed to be the class name 'email' encoded with key
 *
 * @param {number} key - A numeric key used for decoding obfuscated content.
 * @throws {Error} If the provided class name is not valid base64.
 */
function mtoClass(key) {
  const decoded = FYForward(atob('ZW1haWw='), key);
  mailtoClass(decoded, key);
}
/**
 * Replace obfuscated email spans with <a href="mailto:..."> links.
 * Also supports optional `data-cc`, `data-bcc`, `data-subject`, and `data-body` attributes.
 *
 * @param {string} classId - The class name of elements to target (without the dot prefix).
 * @param {number} key - The numeric scramble key used to decode email addresses.
 */
function mailtoClass(classId, key) {
  classId = '.' + classId;
  /** @type {NodeListOf<HTMLElement>} */
  const elements = document.querySelectorAll(classId);
  Array.prototype.forEach.call(elements, function (element) {
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
  });
}
/**
 * Replaces obfuscated elements with their decoded plain text content.
 *
 * @param {string} classId - The class name of elements to unscramble.
 * @param {number} key - The numeric scramble key used to decode the content.
 */
function unscrambleClass(classId, key) {
  classId = '.' + classId;
  /** @type {NodeListOf<HTMLElement>} */
  const elements = document.querySelectorAll(classId);
  Array.prototype.forEach.call(elements, function (element) {
    const target = FYBackward(element.dataset['content'], key);
    element.insertAdjacentHTML('beforebegin', target);
    element.parentNode.removeChild(element);
  });
}
/**
 * Replaces visible text elements with scrambled strings.
 *
 * @param {string} classId - The class name of elements to scramble.
 * @param {number} key - The numeric scramble key used to encode the content.
 */
function scrambleClass(classId, key) {
  classId = '.' + classId;
  /** @type {NodeListOf<HTMLElement>} */
  const elements = document.querySelectorAll(classId);
  Array.prototype.forEach.call(elements, function (element) {
    const target = FYForward(element.dataset['content'], key);
    element.insertAdjacentHTML('beforebegin', target);
    element.parentNode.removeChild(element);
  });
}
