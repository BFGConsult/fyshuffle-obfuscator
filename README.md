# FYShuffle

**FYShuffle** is a JavaScript-based text scrambler based on the [Fisher-Yates shuffle](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle) algorithm. It is designed to obfuscate arbitrary text—primarily email addresses—so they are hidden from bots while remaining readable to users with JavaScript enabled.

---

## Features

- Works in both browser and Node.js environments
- Deterministic scrambling using a 31-bit numeric key
- Output is reversible with the correct key
- No external dependencies
- Distributed in multiple formats:
  - `FYShuffle.js`: browser-compatible UMD build
  - `FYShuffle.min.js`: minified UMD
  - `FYShuffle.module.js`: ES module for bundlers
  - `FYShuffle.node.js`: CommonJS build for Node

---

## Cryptographic Strength

Do **not** use FYShuffle for anything requiring actual security.

This is not a cryptographic algorithm and is not designed to resist serious attacks. The keyspace is limited (2³¹), and the shuffle is reversible. That said, for its intended use—discouraging bots—it provides practical obfuscation without exposing the original text directly.

With shorter inputs, brute-force is inefficient. With longer inputs, statistical attacks become feasible. Still, it's far more effective than leaving plain text in the DOM.

---

## Why Does This Work?

In theory, it shouldn’t—if a browser can unscramble the content, so can a bot. But in practice, bots don’t execute JavaScript on every page they crawl. Doing so is too resource-intensive when crawling at scale.

- Bots usually see the placeholder or scrambled data
- Human users see the original content after client-side decoding

This asymmetry is enough to meaningfully reduce spam and scraping in many real-world cases.

---

## Accessibility Considerations

This is not a best-practice approach to accessibility. Screen readers, text-only browsers, and users with JavaScript disabled will not see the unscrambled content.

If you use FYShuffle:

- Limit its use to cases where obfuscation is necessary
- Provide alternate access where appropriate (e.g., contact forms)
- Consider fallback content or progressive enhancement

---

## Usage

### In the Browser

```html
<script src="FYShuffle.js"></script>

<div class="email" data-content="obfuscatedBase64String"></div>

<script>
  FYShuffle.apply({ key: 123456, mailto: 'email' }); // Decodes and replaces with a <a href="mailto:...">
</script>
```

Other modes include `text` for decoded plain text and `scramble` for encoding visible content.
Legacy helpers such as `mailtoClass()`, `scrambleClass()`, and `unscrambleClass()` still work,
but they are deprecated in favor of `FYShuffle.apply()`.

---

### In Node.js

```js
import { FYForward, FYBackward } from 'FYShuffle';

const key = 123456;
const input = 'hello@example.com';

const scrambled = FYForward(input, key);
const original = FYBackward(scrambled, key);

console.log(original); // hello@example.com
```

---

## Installation

If published to npm:

```bash
npm install FYShuffle
```

If working from source:

```bash
git clone https://github.com/BFGConsult/FYShuffle.git
cd FYShuffle
npm install
```

---

## Build

To generate the output bundles:

```bash
npm run build
```

The following files will be created in the `dist/` directory:

```
dist/
├── FYShuffle.js         // UMD (for browsers)
├── FYShuffle.min.js     // Minified UMD
├── FYShuffle.module.js  // ESM (for bundlers)
├── FYShuffle.node.js    // CommonJS (for Node)
```

Use `npm run build -v` for verbose logging.

---

## Demo

Try FYShuffle live at:

[https://bfgconsult.github.io/FYShuffle/](https://bfgconsult.github.io/FYShuffle/)

The demo lets you:

- Enter custom text and key
- See the scrambled result
- Test browser rendering of decoded content

---

## Project Structure

```
.
├── dist/                # Final build artifacts
│   ├── FYShuffle.js
│   ├── FYShuffle.min.js
│   ├── FYShuffle.module.js
│   └── FYShuffle.node.js
├── index.html           # Demo/test page
├── package.json         # Project metadata and build config
├── package-lock.json
├── README.md
├── LICENSE              # GNU Affero General Public License
├── scripts/
│   └── build.js         # Build and bundling script
└── src/
    ├── core/
    │   ├── base64.browser.js
    │   └── base64.node.js
    ├── fyshuffle-core.js
    ├── fyshuffle-crypto.js
    └── fyshuffle-dom.js
```
