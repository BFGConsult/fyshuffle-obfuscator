# Release Checklist

Use this checklist before tagging and publishing a stable FYShuffle release.

## Pre-release Source Checks

- Confirm the working tree is clean.
- Confirm `package.json` and `package-lock.json` root versions match.
- Run `npm test`.
- Review recent source changes for accidental generated artifact churn.

## Artifact Rules

- Commit source, docs, tests, package metadata, and examples separately from generated `dist/` artifacts.
- Generate release artifacts with `npm run build:release`.
- Commit generated release artifacts separately.
- Tag the final artifact commit, not an earlier source-only commit.

## Manual Browser Verification

Open `examples/init-declarative.html`:

- Confirm `FYShuffle.init()` observes by default.
- Confirm protected content is not transformed before viewport intersection.
- Scroll and confirm observed content transforms.
- Use force apply and confirm pending entries transform.

Open `examples/observe-fallback.html`:

- Confirm missing `IntersectionObserver` does not decode protected content.
- Confirm fallback text appears.

Verify deprecated browser wrappers:

- Confirm `mailtoClass`, `unscrambleClass`, `scrambleClass`, and `mtoClass` still exist.
- Confirm each wrapper calls through successfully.
- Confirm each wrapper warning appears only once.

## Package And Publish Checks

- Run `npm pack --dry-run`.
- If the local npm cache has permissions issues, use a temporary cache:

```bash
npm --cache /private/tmp/fyshuffle-npm-cache pack --dry-run
```

- Confirm package contents include stable release artifacts, declarations, manifest, license, README, and CLI.
- Confirm release package targets do not use `-dev` artifact names.
- Confirm the release tag matches `package.json` version as `vX.Y.Z` or `X.Y.Z`.
- Confirm npm trusted publishing is configured before the first publish.
- Push the matching release tag and let GitHub Actions publish.
- Confirm the workflow rebuilds cleanly and passes `git diff --exit-code`.

## Post-publish Checks

- Install `fyshuffle-obfuscator` in a temporary project.
- Verify ESM import from `fyshuffle-obfuscator`.
- Verify CommonJS require of `fyshuffle-obfuscator`.
- Verify the `fyshuffle` CLI command.
- Verify browser artifact availability in the package.
