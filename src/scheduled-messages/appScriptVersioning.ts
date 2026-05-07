export interface ParsedAppScriptVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

const APP_SCRIPT_SEMVER_PATTERN =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function parseAppScriptVersion(version: string): ParsedAppScriptVersion | null {
  const match = version.trim().match(APP_SCRIPT_SEMVER_PATTERN);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
  };
}

function isNumericIdentifier(identifier: string): boolean {
  return /^(0|[1-9]\d*)$/.test(identifier);
}

function comparePrereleaseIdentifiers(left: string, right: string): number {
  const leftIsNumeric = isNumericIdentifier(left);
  const rightIsNumeric = isNumericIdentifier(right);

  if (leftIsNumeric && rightIsNumeric) {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (leftNumber < rightNumber) return -1;
    if (leftNumber > rightNumber) return 1;
    return 0;
  }

  if (leftIsNumeric) return -1;
  if (rightIsNumeric) return 1;
  return left.localeCompare(right, 'en-US');
}

function compareParsedAppScriptVersions(
  left: ParsedAppScriptVersion,
  right: ParsedAppScriptVersion,
): number {
  if (left.major < right.major) return -1;
  if (left.major > right.major) return 1;
  if (left.minor < right.minor) return -1;
  if (left.minor > right.minor) return 1;
  if (left.patch < right.patch) return -1;
  if (left.patch > right.patch) return 1;

  const leftHasPrerelease = left.prerelease.length > 0;
  const rightHasPrerelease = right.prerelease.length > 0;
  if (!leftHasPrerelease && !rightHasPrerelease) return 0;
  if (!leftHasPrerelease) return 1;
  if (!rightHasPrerelease) return -1;

  const maxLength = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftIdentifier = left.prerelease[index];
    const rightIdentifier = right.prerelease[index];
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;

    const comparison = comparePrereleaseIdentifiers(leftIdentifier, rightIdentifier);
    if (comparison !== 0) {
      return comparison;
    }
  }

  return 0;
}

/**
 * Compares App Script template versions using SemVer precedence.
 *
 * A deployed version that cannot be parsed is treated as older than a valid
 * bundled template version so stale or malformed legacy endpoints do not block
 * recovery updates. Build metadata is ignored, as required by SemVer.
 */
export function compareAppScriptVersions(deployedVersion: string, bundledVersion: string): number {
  const deployed = parseAppScriptVersion(deployedVersion);
  const bundled = parseAppScriptVersion(bundledVersion);

  if (deployed && bundled) {
    return compareParsedAppScriptVersions(deployed, bundled);
  }

  if (!deployed && bundled) {
    return -1;
  }

  if (deployed && !bundled) {
    return 1;
  }

  return deployedVersion.trim().localeCompare(bundledVersion.trim(), 'en-US');
}

export function isAppScriptVersionOlder(deployedVersion: string, bundledVersion: string): boolean {
  return compareAppScriptVersions(deployedVersion, bundledVersion) < 0;
}
