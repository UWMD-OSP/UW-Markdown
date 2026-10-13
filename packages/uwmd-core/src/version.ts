// The engine identity a verification receipt records when it is issued or
// verified through `@uwmd/core` (`receipt-engine.ts` supplies it as the default
// to `@uwmd/verify`'s receipt API), and the version
// `REFERENCE_IMPLEMENTATION_MANIFEST` reports.
//
// Kept as a literal rather than read from package.json so the value is
// available in the browser bundle and in every module system. `version.test.ts`
// asserts it stays in lockstep with the package manifest — update both together.

export const CORE_PACKAGE_NAME = '@uwmd/core' as const;
export const CORE_VERSION = '4.0.1';
