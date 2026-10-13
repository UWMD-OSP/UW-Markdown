// The identity of this package: the `issuer` a receipt issued through
// `@uwmd/core` records (`receipt-engine.ts`; the receipt's engine is
// `@uwmd/verify`, the code that computes), and the version
// `REFERENCE_IMPLEMENTATION_MANIFEST` reports.
//
// Kept as a literal rather than read from package.json so the value is
// available in the browser bundle and in every module system. `version.test.ts`
// asserts it stays in lockstep with the package manifest — update both together.

export const CORE_PACKAGE_NAME = '@uwmd/core' as const;
export const CORE_VERSION = '4.1.0';
