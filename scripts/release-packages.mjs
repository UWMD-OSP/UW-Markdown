// Official npm publication scope. Versions through 2.17.0 keep their historical
// four-package scope; the next ordinary generation includes both modules.
export const ORIGINAL_RELEASE_PACKAGES = Object.freeze([
  { name: '@uwmd/core', dir: 'packages/uwmd-core', row: '@uwmd/core' },
  { name: '@uwmd/cli', dir: 'packages/uwmd-cli', row: '@uwmd/cli (CLI)' },
  { name: '@uwmd/signing', dir: 'packages/uwmd-signing', row: '@uwmd/signing' },
  { name: '@uwmd/batch', dir: 'packages/uwmd-batch', row: '@uwmd/batch' },
]);

export const OFFICIAL_MODULE_PACKAGES = Object.freeze([
  { name: '@uwmd/module-hospitality', dir: 'packages/uwmd-module-hospitality', row: '@uwmd/module-hospitality', manifestExport: 'HOSPITALITY_MODULE', constantPrefix: 'HOSPITALITY_MODULE' },
  { name: '@uwmd/module-data-center', dir: 'packages/uwmd-module-data-center', row: '@uwmd/module-data-center', manifestExport: 'DATA_CENTER_MODULE', constantPrefix: 'DATA_CENTER_MODULE' },
]);

export const RELEASE_PACKAGES = Object.freeze([...ORIGINAL_RELEASE_PACKAGES, ...OFFICIAL_MODULE_PACKAGES]);

export function releasePackagesForGeneration(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(version);
  if (!match) throw new Error(`Invalid release generation: ${version}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  const expanded = major > 2 || (major === 2 && (minor > 17 || (minor === 17 && patch > 0)));
  return expanded ? RELEASE_PACKAGES : ORIGINAL_RELEASE_PACKAGES;
}

// Read the existing typed manifest's literal metadata without a build/install.
// verify-packages separately compares the built object and emitted JSON.
export function moduleMetadataFromSource(source, constantPrefix) {
  const literal = (pattern, field) => {
    const value = source.match(pattern)?.[1];
    if (value === undefined) throw new Error(`Cannot read module ${field} from typed source`);
    return value;
  };
  return {
    id: literal(new RegExp(`export const ${constantPrefix}_ID = '([^']+)'`), 'id'),
    version: literal(new RegExp(`export const ${constantPrefix}_VERSION = '([^']+)'`), 'version'),
    manifest_version: literal(/manifest_version: '([^']+)'/, 'manifest_version'),
    requires_protocol: literal(/requires_protocol: '([^']+)'/, 'requires_protocol'),
    requires_format: literal(/requires_format: '([^']+)'/, 'requires_format'),
    requires_tier: literal(/requires_tier: '([^']+)'/, 'requires_tier'),
  };
}
