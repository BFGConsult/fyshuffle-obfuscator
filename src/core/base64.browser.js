/**
 * Encodes a string to base64 using UTF-8 bytes and the browser's `btoa` function.
 *
 * @param {string} str - The input string to encode.
 * @returns {string} - The base64-encoded output.
 */
export function base64Encode(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';

    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }

    return window.btoa(binary);
}

/**
 * Decodes a base64-encoded UTF-8 string using the browser's `atob` function.
 *
 * @param {string} str - The base64 string to decode.
 * @returns {string} - The decoded plain string.
 */
export function base64Decode(str) {
    const padded = padBase64(str);
    const binary = window.atob(padded);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        return binary;
    }
}

function padBase64(str) {
    const missing = str.length % 4;
    if (missing === 0) {
        return str;
    }
    return str + '='.repeat(4 - missing);
}
