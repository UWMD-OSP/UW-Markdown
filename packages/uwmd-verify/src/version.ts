// The engine identity a verification receipt records (RFC 0083): this package
// computes every receipt's results, whether a caller reaches it directly or
// through `@uwmd/core`, so `computation.engine`/`engine_version` name it.
//
// Kept as a literal rather than read from package.json so the value is
// available in the browser bundle and in every module system. `version.test.ts`
// asserts it stays in lockstep with the package manifest — update both together.
//
// `@uwmd/core`'s `issueReceipt` defaults only the `issuer` to
// `@uwmd/core@<CORE_VERSION>`; the engine stays this package.

export const VERIFY_PACKAGE_NAME = '@uwmd/verify' as const;
export const VERIFY_VERSION = '0.1.0';
