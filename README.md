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
  - `FYShuffle-dev.js`: development browser build for untagged builds
  - `FYShuffle.min.js`: minified UMD
  - `FYShuffle.module.js`: ES module for bundlers
  - `FYShuffle.node.cjs`: CommonJS build for Node

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

FYShuffle is progressive enhancement, not full accessibility coverage. Screen readers, text-only browsers, and users with JavaScript disabled will not see the unscrambled content until JavaScript has transformed it.

If you use FYShuffle:

- Limit its use to cases where obfuscation is necessary
- Provide alternate access for critical contact paths, such as contact forms
- Use fallback text that describes the limitation or alternate route without revealing protected content
- Avoid putting real protected values in `aria-label`, `title`, `noscript`, hidden content, or fallback text

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

Mailto parameters can also be obfuscated with `data-*-content` attributes:

```html
<span
  class="fyshuffle-mailto"
  data-content="obfuscatedTo"
  data-subject-content="obfuscatedSubject"
  data-body-content="obfuscatedBody"
>
  Protected contact
</span>
```

For more compact markup, put a single obfuscated JSON payload in `data-content`:

```html
<span class="fyshuffle-mailto" data-content="obfuscatedMailtoPayload">
  Protected contact
</span>
```

The decoded payload has this shape:

```json
{
  "to": "hello@example.com",
  "subject": "Hello"
}
```

Do not mix cleartext and obfuscated forms for the same field. For example,
`data-subject` and `data-subject-content` on the same element is an error.

Use `FYShuffle.observe()` to delay DOM transformations until matching elements become visible:

```html
<script>
  FYShuffle.observe({ key: 123456, mailto: 'email' });
</script>
```

If `IntersectionObserver` is unavailable, `observe()` replaces matching elements with plain
fallback text instead of decoding protected content. The default fallback is
`Protected content unavailable`; override it globally with `fallbackText` or per element with
`data-fallback-text`.

Declarative markup can opt in with `data-fyshuffle` and a per-element `data-key`:

```html
<span
  data-fyshuffle="mailto"
  data-key="123456"
  data-content="obfuscatedTo"
  data-fallback-text="Use the contact form below"
>
  Email address appears when this block enters the viewport.
</span>

<script>
  FYShuffle.init(); // Defaults to visibility-gated observe behavior.
</script>
```

Use `data-fyshuffle="mailto"`, `data-fyshuffle="text"`, or `data-fyshuffle="scramble"`.
Declarative elements must include `data-content`. By default, each declarative element must also
include `data-key`.

The key can also be loaded from the server:

```html
<span
  data-fyshuffle="mailto"
  data-content="obfuscatedTo"
  data-fallback-text="Use the contact form below"
>
  Email address appears when this block enters the viewport.
</span>

<script>
  const controller = await FYShuffle.init({
    keyUrl: '/path/to/fyshuffle-key.json'
  });
</script>
```

The key URL must return JSON with a numeric `key` field:

```json
{ "key": 123456 }
```

When `keyUrl` is used, `FYShuffle.init()` returns a promise for the normal controller. Elements
without `data-key` use the fetched key; elements with `data-key` override it individually. Loading
the key from a URL avoids embedding it directly in markup, but clients that can fetch the URL can
still read the key.

`FYShuffle.init()` timing is explicit:

| Call | Behavior |
| --- | --- |
| `FYShuffle.init()` | Observe declarative elements and transform them when visible |
| `FYShuffle.init({ immediate: false })` | Same as the default observe-style behavior |
| `FYShuffle.init({ immediate: true })` | Transform declarative elements immediately |

Observer options such as `root`, `rootMargin`, `threshold`, and `fallbackText` apply only when
`immediate` is omitted or `false`.

### Browser API Contract

For 1.0, the supported browser API is the `window.FYShuffle` namespace:

- Core helpers: `FYForward`, `FYBackward`, `genPerm`, `nextRand`
- DOM entrypoints: `apply(config)`, `observe(config)`, `init(config)`
- Deprecated compatibility helpers: `mtoClass`, `mailtoClass`, `unscrambleClass`, `scrambleClass`

`FYForward` and `FYBackward` are the primary core API. `genPerm` and `nextRand` remain public
low-level helpers for compatibility and deterministic testing.

The deprecated helpers are also available as legacy global functions in the browser build.
They warn once per page load and forward to `FYShuffle.apply()`.

Package imports remain core-only. The ESM and CommonJS package entries intentionally export
only `FYForward`, `FYBackward`, `genPerm`, and `nextRand`; browser DOM helpers are not package
exports and are not part of the package declaration file.

Browser DOM helpers are available from standalone browser files:

- `dist/FYShuffle.vX.Y.Z.js` for pinned release use
- `dist/FYShuffle.js` for the latest stable browser file in a release build
- `dist/FYShuffle-dev.js` for local development and testing only

The `package.json` `browser` field points to `dist/FYShuffle.js` for release/browser consumers,
while module imports remain core-only.

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

### CLI

```bash
fyshuffle encode --key 123456 --text hello@example.com
fyshuffle decode --key 123456 --text obfuscatedValue
fyshuffle mailto --key 123456 --to hello@example.com --subject "Hello"
fyshuffle mailto --key 123456 --to hello@example.com --subject "Hello" --mode compact
```

The `mailto` command prints an HTML snippet with obfuscated `data-*` attributes.
Use `--mode compact` to emit a snippet with only `class` and `data-content`.
The browser generator in `examples/generate-mailto.html` provides both modes in a page.

---

## Installation

If published to npm:

```bash
npm install fyshuffle-obfuscator
```

Package and runtime names are intentionally separate:

```text
Install package: fyshuffle-obfuscator
Browser global: window.FYShuffle
JS API namespace: FYShuffle
CLI command: fyshuffle
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

Development builds produce `FYShuffle-dev.js` and versioned `*-dev` files. Untagged development
builds use the next patch after the latest release tag, for example `0.9.3-dev` after release
tag `v0.9.2`. Release builds use the package version without `-dev`; run `npm run build:release`
only when preparing the final release artifact commit for a matching version tag.

The following files will be created in the `dist/` directory:

```
dist/
├── FYShuffle.js          // Stable browser build
├── FYShuffle-dev.js      // Development browser build
├── FYShuffle.min.js      // Minified browser build for release builds
├── FYShuffle.module.js   // ESM for bundlers
├── FYShuffle.node.cjs    // CommonJS for Node
└── manifest.json         // Build artifact manifest
```

Consumers should prefer versioned stable browser artifacts such as `FYShuffle.v1.0.0.js` for
long-term use. Development artifacts with `-dev` in the filename are not stable consumer targets.

Use `npm run build -v` for verbose logging.

For release steps, see [docs/release-checklist.md](docs/release-checklist.md).

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
│   ├── FYShuffle-dev.js
│   ├── FYShuffle.min.js
│   ├── FYShuffle.module.js
│   ├── FYShuffle.node.cjs
│   └── manifest.json
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
