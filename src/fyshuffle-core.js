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
    console.warn(`FYShuffle: ${name}() is deprecated; use ${replacement} instead.`);
}

/**
 * @param {number} key
 * @param {string} apiName
 * @returns {number}
 */
export function validateKey_internal(key, apiName) {
    if (!Number.isSafeInteger(key) || key < 0) {
        throw new TypeError(`FYShuffle.${apiName} requires a non-negative integer key`);
    }

    return key;
}

/**
 * @param {number} X
 * @returns {number}
 */
export function nextRand_internal(X) {
    return (RAND_A * X + RAND_C) % RAND_M;
}

/**
 * @deprecated Use higher-level FYShuffle helpers instead.
 * @param {number} X
 * @returns {number}
 */
export function nextRand(X) {
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
export function shuffleArray_internal(items, key) {
    var n = items.length;
    for (var i = 0; i < n; ++i) {
        key = (RAND_A * key + RAND_C) % RAND_M;
        var j = key % (n - i) + i;
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
export function genPerm_internal(n, key, apiName) {
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
export function permuteArray(items, key) {
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
export function unpermuteArray(items, key) {
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
export function genPerm(n, key) {
    warnDeprecatedCore('genPerm', 'permuteArray()/unpermuteArray()');
    return genPerm_internal(n, key);
}
