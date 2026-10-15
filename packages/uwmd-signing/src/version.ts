// The package identity. A literal, like core's `CORE_VERSION` and verify's
// `VERIFY_VERSION`, held in lockstep with package.json by `version.test.ts`.
//
// `SIGNING_VERSION` said 0.2.0 through the 0.3.0 release because it was a
// hand-kept literal with no test; 0.3.1 read the manifest through
// `createRequire` from `node:module` instead. That static `node:` import made
// the package unloadable in a browser, which the README promises and which
// nothing else here needs: every algorithm runs on Web Crypto, and the only
// other `node:` use is the guarded dynamic `node:fs` import in the file-backed
// key store. The test, not the loader, now keeps the value honest.

export const SIGNING_PACKAGE_NAME = '@uwmd/signing' as const;
export const SIGNING_VERSION = '0.6.0';
