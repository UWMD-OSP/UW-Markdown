// Official npm publication scope. Each generation keeps the scope it actually
// shipped with: four packages through 2.17.0, six (adding both modules) from
// 2.17.1 through 2.21.x, nine (adding Excel, report and lake) from 2.22.0
// through 3.x, and seven from 4.0.0, when RFC 0081 deleted both module
// packages. These boundaries record history; they do not select a next version.
// The one exception is the eight-package scope, which RFC 0083 fixes ahead of
// time: `@uwmd/verify` first publishes with core/CLI 4.1.0 (RFC 0083 Decisions).
export const ORIGINAL_RELEASE_PACKAGES = Object.freeze([
  { name: '@uwmd/core', dir: 'packages/uwmd-core', row: '@uwmd/core' },
  { name: '@uwmd/cli', dir: 'packages/uwmd-cli', row: '@uwmd/cli (CLI)' },
  { name: '@uwmd/signing', dir: 'packages/uwmd-signing', row: '@uwmd/signing' },
  { name: '@uwmd/batch', dir: 'packages/uwmd-batch', row: '@uwmd/batch' },
]);

// The two official module packages, published 2.17.1 through 3.x. Their
// sources were deleted by RFC 0081 (D6); they are named here only so the
// generations that shipped them keep their recorded scope.
export const RETIRED_MODULE_PACKAGES = Object.freeze([
  { name: '@uwmd/module-hospitality', row: '@uwmd/module-hospitality' },
  { name: '@uwmd/module-data-center', row: '@uwmd/module-data-center' },
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

// The reference implementation of the standard (RFC 0083), split out of core.
// It pins no @uwmd/* package and core pins it exactly, so it publishes first.
// A new package name needs a trusted publisher on npmjs.com before the first
// tag that publishes it; that is an owner step (wiki 11).
export const VERIFY_RELEASE_PACKAGE = Object.freeze(
  { name: '@uwmd/verify', dir: 'packages/uwmd-verify', row: '@uwmd/verify' },
);

/** The seven packages 4.0.x publishes (RFC 0081: from 4.0.0). */
const SEVEN_PACKAGE_SCOPE = Object.freeze([...ORIGINAL_RELEASE_PACKAGES, ...ADDED_RELEASE_PACKAGES]);

/** The eight packages this tree publishes, in publication order (RFC 0083: from 4.1.0). */
export const RELEASE_PACKAGES = Object.freeze([VERIFY_RELEASE_PACKAGE, ...SEVEN_PACKAGE_SCOPE]);

const SIX_PACKAGE_SCOPE = Object.freeze([...ORIGINAL_RELEASE_PACKAGES, ...RETIRED_MODULE_PACKAGES]);
const NINE_PACKAGE_SCOPE = Object.freeze([...SIX_PACKAGE_SCOPE, ...ADDED_RELEASE_PACKAGES]);

export function releasePackagesForGeneration(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(version);
  if (!match) throw new Error(`Invalid release generation: ${version}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  const after = (m, n, p) => major > m || (major === m && (minor > n || (minor === n && patch > p)));
  if (major > 4 || (major === 4 && minor >= 1)) return RELEASE_PACKAGES;
  if (major === 4) return SEVEN_PACKAGE_SCOPE;
  // A 2.21.x patch keeps the six-package scope; 2.22.0 through 3.x is nine.
  if (major === 3 || (major === 2 && minor > 21)) return NINE_PACKAGE_SCOPE;
  return after(2, 17, 0) ? SIX_PACKAGE_SCOPE : ORIGINAL_RELEASE_PACKAGES;
}
