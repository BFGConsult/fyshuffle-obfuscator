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
    const decodedContent = FYBackward(element.dataset['content'], key);
    const compact = parseCompactMailto(decodedContent);
    const target = compact ? compact.to : decodedContent;
    const anchor = document.createElement("a");
    const fields = [];
    const esc = encodeURIComponent;

    function getMailtoField(field) {
        if (compact && field in compact) {
            return compact[field];
        }

        const encodedField = `${field}Content`;
        const hasCleartext = field in element.dataset;
        const hasEncoded = encodedField in element.dataset;

        if (hasCleartext && hasEncoded) {
            throw new Error(`FYShuffle: data-${field} and data-${field}-content cannot both be set`);
        }
        if (hasEncoded) {
            return FYBackward(element.dataset[encodedField], key);
        }
        if (hasCleartext) {
            return element.dataset[field];
        }
        return undefined;
    }

    for (const field of ['cc', 'bcc', 'subject', 'body']) {
        const value = getMailtoField(field);
        if (value !== undefined) {
            if (field[field.length - 1] === 'c') {
                for (const mail of value.split(',')) {
                    fields.push(`${field}=${esc(mail)}`);
                }
            } else {
                fields.push(`${field}=${esc(value)}`);
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

function parseCompactMailto(value) {
    let payload;
    try {
        payload = JSON.parse(value);
    } catch {
        return null;
    }

    if (!payload || typeof payload !== 'object' || typeof payload.to !== 'string') {
        return null;
    }

    for (const field of ['cc', 'bcc', 'subject', 'body']) {
        if (field in payload && typeof payload[field] !== 'string') {
            return null;
        }
    }

    return payload;
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
        const fallbackText = config.fallbackText === undefined
            ? 'Protected content unavailable'
            : config.fallbackText;
        replaceTargetsWithFallback(
            targets,
            fallbackText
        );
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
    observe: observeConfig,
    mtoClass,
    mailtoClass,
    unscrambleClass,
    scrambleClass,
};
