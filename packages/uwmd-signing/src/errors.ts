// Typed errors for the signing package.
//
// Mirrors the repo convention (`ProtocolError`, `CalcError`, `ExcelEmitError`):
// a bare `Error` from a crypto path is unactionable, because the four things
// that go wrong here — no provider, unusable key material, an unsignable block,
// an unreadable key store — call for four different fixes.

export type SigningErrorCode =
  /** No Web Crypto provider (`crypto.subtle`) in this runtime. */
  | 'SIG_NO_CRYPTO'
  /** The runtime rejected the algorithm — e.g. Ed25519 on a pre-18.4 Node. */
  | 'SIG_ALGORITHM_UNSUPPORTED'
  /** Key material could not be imported (wrong format, wrong curve, corrupt). */
  | 'SIG_BAD_KEY'
  /** The block cannot produce a signing input — almost always a missing hash. */
  | 'SIG_UNSIGNABLE'
  /** A key-store document is malformed. */
  | 'SIG_BAD_KEYSTORE';

export class SigningError extends Error {
  readonly code: SigningErrorCode;

  constructor(code: SigningErrorCode, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'SigningError';
    this.code = code;
  }
}
