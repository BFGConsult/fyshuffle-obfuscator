# TODO

- Revisit npm publish automation. A draft GitHub Actions workflow existed for publishing on `v*` tags with `npm ci`, `npm run build`, and `npm publish --access public`, but release automation needs a deliberate pass before being committed.
- Consider adding a first-class CLI for encoding and decoding values, so users can generate `data-content` strings without opening the demo page or writing a Node script.
- Consider making browser encoding Unicode-safe so browser behavior matches the Node Buffer-based UTF-8 path for non-ASCII text.
- Consider supporting obfuscated `mailto:` parameters such as `cc`, `bcc`, `subject`, and `body`; today only the `to` address is obfuscated while the other fields remain cleartext.
- Define the stable browser/DOM public API for 1.0, including which global helper names are supported, whether DOM helpers need type declarations, and whether those helpers should also be exposed from module builds.
- Consider declarative browser auto-initialization, where elements opt in with `data-fyshuffle` attributes and the browser bundle can process them without manual helper calls.
- Explore whether browser DOM helpers should support attribute-based targeting in addition to, or instead of, class-based targeting.
- Improve universal design and accessibility behavior for browser usage, including clearer fallback patterns for no-JavaScript, screen readers, and assistive technologies.
- Add an `observe({...})` visibility-triggered DOM transformation API so obfuscated content is only decoded when it is near or inside the viewport, raising the cost for browser automation and Playwright-style scraping.
