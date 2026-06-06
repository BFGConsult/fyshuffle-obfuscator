import { genPerm, nextRand } from './fyshuffle-core.js';
import { FYForward, FYBackward } from './fyshuffle-crypto.js';

const deprecatedWarnings = {};

function warnDeprecated(name, replacement) {
    if (deprecatedWarnings[name]) {
        return;
    }
    deprecatedWarnings[name] = true;
    console.warn(`FYShuffle: ${name}() is deprecated; use ${replacement} instead.`);
}

function normalizeTarget(target) {
    if (typeof target !== 'string') {
        throw new TypeError('FYShuffle.apply target values must be strings');
    }
    if (/^[A-Za-z0-9_-]+$/.test(target)) {
        return '.' + target;
    }
    return target;
}

function selectTarget(target) {
    return document.querySelectorAll(normalizeTarget(target));
}

function applyMailto(target, key) {
    /** @type {NodeListOf<HTMLElement>} */
    const elements = selectTarget(target);

    Array.prototype.forEach.call(elements, function (element) {
        const target = FYBackward(element.dataset['content'], key);
        const anchor = document.createElement("a");
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

function applyText(target, key) {
    /** @type {NodeListOf<HTMLElement>} */
    const elements = selectTarget(target);

    Array.prototype.forEach.call(elements, function (element) {
        const target = FYBackward(element.dataset['content'], key);
        element.insertAdjacentHTML('beforebegin', target);
        element.parentNode.removeChild(element);
    });
}

function applyScramble(target, key) {
    /** @type {NodeListOf<HTMLElement>} */
    const elements = selectTarget(target);

    Array.prototype.forEach.call(elements, function (element) {
        const target = FYForward(element.dataset['content'], key);
        element.insertAdjacentHTML('beforebegin', target);
        element.parentNode.removeChild(element);
    });
}

function applyConfig(config) {
    if (!config || typeof config !== 'object') {
        throw new TypeError('FYShuffle.apply requires a config object');
    }

    const key = config.key;
    if (typeof key !== 'number' || !Number.isFinite(key)) {
        throw new TypeError('FYShuffle.apply requires a numeric key');
    }

    if (config.mailto !== undefined) {
        applyMailto(config.mailto, key);
    }
    if (config.text !== undefined) {
        applyText(config.text, key);
    }
    if (config.scramble !== undefined) {
        applyScramble(config.scramble, key);
    }
}

/**
 * Decodes a base64-encoded class name and calls mailtoClass with the result.
 *
 * The class name is assumed to be the class name 'email' encoded with key
 *
 * @param {number} key - A numeric key used for decoding obfuscated content.
 * @throws {Error} If the provided class name is not valid base64.
 */
export function mtoClass(key) {
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
export function mailtoClass(classId, key) {
    warnDeprecated('mailtoClass', `FYShuffle.apply({ key, mailto: "${classId}" })`);
    applyConfig({ key, mailto: classId });
}

/**
 * Replaces obfuscated elements with their decoded plain text content.
 *
 * @param {string} classId - The class name of elements to unscramble.
 * @param {number} key - The numeric scramble key used to decode the content.
 */
export function unscrambleClass(classId, key) {
    warnDeprecated('unscrambleClass', `FYShuffle.apply({ key, text: "${classId}" })`);
    applyConfig({ key, text: classId });
}

/**
 * Replaces visible text elements with scrambled strings.
 *
 * @param {string} classId - The class name of elements to scramble.
 * @param {number} key - The numeric scramble key used to encode the content.
 */
export function scrambleClass(classId, key) {
    warnDeprecated('scrambleClass', `FYShuffle.apply({ key, scramble: "${classId}" })`);
    applyConfig({ key, scramble: classId });
}

globalThis.FYShuffle = {
    FYForward,
    FYBackward,
    genPerm,
    nextRand,
    apply: applyConfig,
    mtoClass,
    mailtoClass,
    unscrambleClass,
    scrambleClass,
};
