export function parseReleaseVersionTag(tag) {
  const match = tag.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    version: `${match[1]}.${match[2]}.${match[3]}`,
  };
}

export function compareReleaseVersions(left, right) {
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) {
      return left[key] - right[key];
    }
  }

  return 0;
}

export function incrementPatch(version) {
  const parsed = parseReleaseVersionTag(version);
  if (!parsed) {
    throw new TypeError(`Invalid release version: ${version}`);
  }

  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

export function latestReleaseVersion(tags, fallbackVersion) {
  const parsedTags = tags.map(parseReleaseVersionTag).filter(Boolean);
  if (parsedTags.length === 0) {
    return fallbackVersion;
  }

  parsedTags.sort(compareReleaseVersions);
  return parsedTags[parsedTags.length - 1].version;
}

export function resolveBuildVersion({
  packageVersion,
  releaseOverride = false,
  tagsAtHead = [],
  allTags = [],
}) {
  if (releaseOverride) {
    return packageVersion;
  }

  const releaseTags = new Set([packageVersion, `v${packageVersion}`]);
  if (tagsAtHead.some((tag) => releaseTags.has(tag))) {
    return packageVersion;
  }

  return `${incrementPatch(latestReleaseVersion(allTags, packageVersion))}-dev`;
}

export function resolveStableVersion({ packageVersion, buildVersion, allTags = [] }) {
  if (buildVersion === packageVersion) {
    return packageVersion;
  }

  return latestReleaseVersion(allTags, packageVersion);
}
