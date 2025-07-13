import { FYForward, FYBackward } from './fyshuffle-crypto.js';

/**
 * Decodes a base64-encoded class name and calls mailtoClass with the result.
 *
 * @param {string} base64ClassName - A base64-encoded string representing a CSS class name.
 * @param {number} key - A numeric key used for decoding obfuscated content.
 * @throws {Error} If the provided class name is not valid base64.
 */
export function mailtoClass2(base64ClassName, key) {
  let decoded;
  try {
    decoded = atob(base64ClassName);
  } catch (err) {
    throw new Error(`Invalid base64 class name: ${base64ClassName}`);
  }

  mailtoClass(decoded, key);
}

/**
 * Replace obfuscated email spans with <a href="mailto:..."> links.
 * Also supports optional `data-cc`, `data-bcc`, `data-subject`, and `data-body` attributes.
 *
 * @param {string} classId - The class name of elements to target (without the dot prefix).
 * @param {number} key - The numeric scramble key used to decode email addresses.
 */
export function mailtoClass(classId, key) {
    classId = '.' + classId;
    /** @type {NodeListOf<HTMLElement>} */
    const elements = document.querySelectorAll(classId);

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

/**
 * Replaces obfuscated elements with their decoded plain text content.
 *
 * @param {string} classId - The class name of elements to unscramble.
 * @param {number} key - The numeric scramble key used to decode the content.
 */
export function unscrambleClass(classId, key) {
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
export function scrambleClass(classId, key) {
    classId = '.' + classId;
    /** @type {NodeListOf<HTMLElement>} */
    const elements = document.querySelectorAll(classId);

    Array.prototype.forEach.call(elements, function (element) {
        const target = FYForward(element.dataset['content'], key);
        element.insertAdjacentHTML('beforebegin', target);
        element.parentNode.removeChild(element);
    });
}
