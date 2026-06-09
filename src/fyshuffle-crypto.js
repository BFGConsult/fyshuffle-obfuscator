import { genPerm_internal, shuffleArray_internal, validateKey_internal } from './fyshuffle-core.js';
// @ts-ignore: TS2792 - base64.js is resolved during bundle
import { base64Encode, base64Decode } from './core/base64.js';

/**
 * Obfuscates a string using a base64 permutation based on a numeric key.
 *
 * @param {string} text - The input string to encode.
 * @param {number} key - A numeric key used to seed the permutation.
 * @returns {string} The obfuscated output string.
 */
export function FYForward(text, key) {
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
export function FYBackward(enc, key) {
    var n = enc.length;
    var perm = genPerm_internal(n, key, 'FYBackward');
    var b64a = new Array(n);
    for (var i = 0; i < n; ++i) {
        b64a[perm[i]] = enc[i];
    }
    return base64Decode(b64a.join(''));
}
