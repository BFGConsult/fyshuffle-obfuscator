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
 * @deprecated Use higher-level FYShuffle helpers instead.
 * @param {number} n
 * @param {number} key
 * @returns {number[]}
 */
export function genPerm(n, key) {
    warnDeprecatedCore('genPerm', 'FYForward()/FYBackward()');
    return genPerm_internal(n, key);
}
