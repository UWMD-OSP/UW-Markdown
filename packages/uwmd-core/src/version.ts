// The engine identity a verification receipt records.
//
// Kept as a literal rather than read from package.json so the value is
// available in the browser bundle and in every module system. `version.test.ts`
// asserts it stays in lockstep with the package manifest — update both together.

export const CORE_PACKAGE_NAME = '@uwmd/core' as const;
export const CORE_VERSION = '1.6.0';
