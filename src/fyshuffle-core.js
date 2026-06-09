/** @type {Record<string, boolean>} */
const deprecatedCoreWarnings = {};

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
 * @param {number} X
 * @returns {number}
 */
export function nextRand_internal(X) {
    var a = 1103515245;
    var c = 12345;
    var m = 1 << 31;
    return (a * X + c) % m;
}

/**
 * @deprecated Use higher-level FYShuffle helpers instead.
 * @param {number} X
 * @returns {number}
 */
export function nextRand(X) {
    warnDeprecatedCore('nextRand', 'FYForward()/FYBackward()');
    return nextRand_internal(X);
}

/**
 * @param {number} n
 * @param {number} key
 * @returns {number[]}
 */
export function genPerm_internal(n, key) {
    var perm = [...Array(n).keys()];
    for (var i = 0; i < n; ++i) {
        key = nextRand_internal(key);
        var j = key % (n - i) + i;
        var tmp = perm[i];
        perm[i] = perm[j];
        perm[j] = tmp;
    }
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

    var perm = genPerm_internal(items.length, key);
    var result = [];
    for (var i = 0; i < items.length; ++i) {
        result[i] = items[perm[i]];
    }
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

    var perm = genPerm_internal(items.length, key);
    var result = [];
    for (var i = 0; i < items.length; ++i) {
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
