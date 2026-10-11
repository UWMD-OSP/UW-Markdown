// Official npm publication scope. Each generation keeps the scope it actually
// shipped with: four packages through 2.17.0, six (adding both modules) from
// 2.17.1 through 2.21.x, and nine (adding Excel, report and lake) after
// 2.21.x. These boundaries record history; they do not select a next version.
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

// Published every release after 2.21.x. Each had to exist on npm before its
// trusted publisher could be configured: Excel and report have a deprecated
// stray 0.3.0 from 2026-08-16, and lake 0.2.9 was published by hand from the
// v2.21.0 tag on 2026-10-11. They publish after core, which they pin exactly.
export const ADDED_RELEASE_PACKAGES = Object.freeze([
  { name: '@uwmd/excel', dir: 'packages/uwmd-excel', row: '@uwmd/excel' },
  { name: '@uwmd/report', dir: 'packages/uwmd-report', row: '@uwmd/report' },
  { name: '@uwmd/lake', dir: 'packages/uwmd-lake', row: '@uwmd/lake' },
]);

const SIX_PACKAGE_SCOPE = Object.freeze([...ORIGINAL_RELEASE_PACKAGES, ...OFFICIAL_MODULE_PACKAGES]);

export const RELEASE_PACKAGES = Object.freeze([...SIX_PACKAGE_SCOPE, ...ADDED_RELEASE_PACKAGES]);

export function releasePackagesForGeneration(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(version);
  if (!match) throw new Error(`Invalid release generation: ${version}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  const after = (m, n, p) => major > m || (major === m && (minor > n || (minor === n && patch > p)));
  // A 2.21.x patch keeps the six-package scope; the next minor or major is nine.
  if (major > 2 || (major === 2 && minor > 21)) return RELEASE_PACKAGES;
  return after(2, 17, 0) ? SIX_PACKAGE_SCOPE : ORIGINAL_RELEASE_PACKAGES;
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
