// Algorithm parameters for the three algorithms protocol §V.11 admits.
//
// The shortlist is borrowed from PASETO v4 and JOSE: one EdDSA curve and two
// NIST P-curves, all three present in stable Web Crypto. Deliberately no RSA —
// a 256-byte signature inline in a `_meta` block is a size the format should
// not have to carry, and nothing in CRE needs it.
//
// ECDSA here is the JOSE convention: raw `r || s` (IEEE P1363), which is what
// Web Crypto produces and consumes. DER-wrapped ECDSA signatures are NOT
// interchangeable and will fail verification rather than silently pass.

import type { UWSignatureAlgorithm } from '@uwmd/core';
import { SigningError } from './errors.js';

export interface AlgorithmParams {
  /** Passed to `importKey` / `generateKey`. */
  readonly keyParams: EcKeyImportParams | Algorithm;
  /** Passed to `sign` / `verify`. */
  readonly signParams: EcdsaParams | Algorithm;
  /** JWK `kty` the key material must declare. */
  readonly kty: 'OKP' | 'EC';
  /** JWK `crv` the key material must declare. */
  readonly crv: string;
}

const PARAMS: Record<UWSignatureAlgorithm, AlgorithmParams> = {
  ed25519: {
    keyParams: { name: 'Ed25519' },
    signParams: { name: 'Ed25519' },
    kty: 'OKP',
    crv: 'Ed25519',
  },
  es256: {
    keyParams: { name: 'ECDSA', namedCurve: 'P-256' },
    signParams: { name: 'ECDSA', hash: 'SHA-256' },
    kty: 'EC',
    crv: 'P-256',
  },
  es384: {
    keyParams: { name: 'ECDSA', namedCurve: 'P-384' },
    signParams: { name: 'ECDSA', hash: 'SHA-384' },
    kty: 'EC',
    crv: 'P-384',
  },
};

export function algorithmParams(alg: string): AlgorithmParams {
  const params = PARAMS[alg as UWSignatureAlgorithm];
  if (!params) {
    throw new SigningError(
      'SIG_ALGORITHM_UNSUPPORTED',
      `Unknown signature algorithm '${alg}'. Protocol 1.x admits ed25519, es256, es384.`,
    );
  }
  return params;
}

export function isKnownAlgorithm(alg: string): alg is UWSignatureAlgorithm {
  return alg in PARAMS;
}

/**
 * The runtime's Web Crypto implementation.
 *
 * Node exposes it as a global from 18.0; Ed25519 specifically landed in 18.4.
 * An older runtime fails here with a code rather than a `TypeError` on
 * `undefined.subtle`.
 */
export function subtle(): SubtleCrypto {
  const provider = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (!provider) {
    throw new SigningError(
      'SIG_NO_CRYPTO',
      'No Web Crypto provider (globalThis.crypto.subtle) in this runtime; @uwmd/signing needs Node >= 18.4 or a browser.',
    );
  }
  return provider;
}
