# TODO

- Revisit npm publish automation. A draft GitHub Actions workflow existed for publishing on `v*` tags with `npm ci`, `npm run build`, and `npm publish --access public`, but release automation needs a deliberate pass before being committed.
- Consider declarative browser auto-initialization, where elements opt in with `data-fyshuffle` attributes and the browser bundle can process them without manual helper calls.
- Explore whether browser DOM helpers should support attribute-based targeting in addition to, or instead of, class-based targeting.
- Improve universal design and accessibility behavior for browser usage, including clearer fallback patterns for no-JavaScript, screen readers, and assistive technologies.
