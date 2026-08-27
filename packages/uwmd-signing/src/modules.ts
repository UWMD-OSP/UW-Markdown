// Module manifest signing and verification (RFC 0002, protocol §X.1).
//
// Deliberately thin. A module signature is the same act as a block signature
// over different bytes, so this file is mostly a change of payload — the key
// handling, the algorithm table, and the actual `subtle.verify` call are the
// ones `sign.ts` / `verify.ts` already use. Two verifiers would mean two
// chances to disagree about what a valid signature is.

import {
  MODULE_SIGNATURE_SCHEME,
  moduleSigningPayload,
  type ModuleManifest,
  type ModuleSignature,
  type ModuleSignatureVerifier,
} from '@uwmd/core';
import { verifyRawSignature } from './verify.js';
import { signPayload } from './sign.js';
import type { KeyStore, SigningKey } from './keys.js';

export interface SignModuleOptions {
  /** ISO 8601 instant to stamp as `signed_at`. Defaults to now. */
  signedAt?: string;
  /**
   * Identity claim to embed. Advisory: a signature proves the key holder
   * asserted this, never that the assertion is true.
   */
  identity?: string;
}

/**
 * Sign a module manifest, returning the detached signature.
 *
 * Does not mutate the manifest — use {@link stampModuleSignature}. A manifest
 * that already carries a `signature` can be re-signed: the payload omits the
 * field, so the old signature does not perturb the new one.
 */
export async function signModule(
  manifest: ModuleManifest,
  key: SigningKey,
  options: SignModuleOptions = {},
): Promise<ModuleSignature> {
  const signedAt = options.signedAt ?? new Date().toISOString();
  return {
    scheme: MODULE_SIGNATURE_SCHEME,
    alg: key.alg,
    kid: key.kid,
    sig: await signPayload(moduleSigningPayload(manifest), key),
    signed_at: signedAt,
    ...(options.identity !== undefined ? { identity: options.identity } : {}),
  };
}

/** Return a copy of `manifest` carrying `signature`. */
export function stampModuleSignature(
  manifest: ModuleManifest,
  signature: ModuleSignature,
): ModuleManifest {
  return { ...manifest, signature };
}

/**
 * A {@link ModuleSignatureVerifier} for `verifyModuleSignature` and the async
 * module loaders.
 *
 * Scheme and shape are core's job — it has already run `checkSignatureShape`
 * before reaching here — so this checks the cryptography and nothing else.
 */
export function createModuleSignatureVerifier(store: KeyStore): ModuleSignatureVerifier {
  return {
    async verify(payload: string, signature: ModuleSignature) {
      const verdict = await verifyRawSignature(
        payload,
        signature.alg,
        signature.kid,
        signature.sig,
        store,
      );
      if (verdict.ok) return { ok: true };
      // `algorithm_mismatch` folds into `bad_signature` at this seam: core's
      // ModuleSignatureVerifier contract has three outcomes, and a key whose
      // curve disagrees with the manifest's claim is a signature that does not
      // verify, not a shape problem core could have caught.
      return {
        ok: false,
        reason: verdict.reason === 'unknown_kid' ? 'unknown_kid' : verdict.reason === 'malformed' ? 'malformed' : 'bad_signature',
      };
    },
  };
}
