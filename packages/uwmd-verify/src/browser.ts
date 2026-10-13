// @uwmd/verify/browser — the browser entry (RFC 0083 §1).
//
// The same surface as the main entry. No module in this package imports a
// `node:` builtin statically; integrity's SHA-256 loads `node:crypto` through a
// dynamic import guarded by a runtime check for Node and uses Web Crypto
// everywhere else, so a browser never evaluates it. `standard-closure.test.ts`
// holds the package to that, and `entries.test.ts` asserts the two entries
// export the same names. A separate entry keeps the import path parallel to
// `@uwmd/core/browser` and leaves room for a Node-only export later without
// breaking browser consumers.

export * from './index.js';
