// The engine identity a verification receipt records when `@uwmd/verify` issues
// or verifies it directly (RFC 0083).
//
// Kept as a literal rather than read from package.json so the value is
// available in the browser bundle and in every module system. `version.test.ts`
// asserts it stays in lockstep with the package manifest — update both together.
//
// `@uwmd/core` re-exports the receipt API with its own identity as the default
// (`CORE_PACKAGE_NAME`/`CORE_VERSION` in core's `version.ts`), so a receipt
// issued through core still names `@uwmd/core`.

export const VERIFY_PACKAGE_NAME = '@uwmd/verify' as const;
export const VERIFY_VERSION = '0.1.0';
