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

## Local Release Rehearsal

Before pushing a release tag, rehearse the release locally with the same tag-based build path used
by GitHub Actions.

Starting point:

- Confirm the working tree is clean.
- Confirm `master` is up to date with `origin/master`.
- Apply or otherwise prepare the intended release metadata.
- Confirm `package.json` and `package-lock.json` root versions match.

Create the release commits and local tag:

```bash
npm test
git diff --check
npm run build:release
git add package.json dist
git commit -m "Regenerate X.Y.Z release artifacts"
git tag vX.Y.Z
```

Run the automated local release check:

```bash
npm run release:dry-run
```

This verifies:

- The local tag at `HEAD` matches `package.json` version.
- `npm test` passes.
- Tag-driven `npm run build` reproduces checked-in artifacts.
- `git diff --exit-code` passes.
- `npm pack --dry-run` succeeds, with the temporary npm cache fallback if needed.
- Packed contents include stable release artifacts and exclude `-dev` targets.

### Optional Rehearsal Rollback

If this was only a throwaway rehearsal and the release should not remain committed locally:

```bash
git tag -d vX.Y.Z
git reset --hard origin/master
```

Confirm rollback:

```bash
git status --short --branch
git tag --list vX.Y.Z
```

Expected result:

- Working tree is clean.
- No local release tag remains.
- `master` matches `origin/master`.

Skip this rollback when the release commits are the real release commits you intend to push.

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

- Confirm `npm run release:dry-run` passed for the final artifact commit.
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
