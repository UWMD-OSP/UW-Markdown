// Verification: check a detached signature against a key store.

import {
  blockSigningPayload,
  computeBlockHash,
  type BlockSigFailure,
  type BlockSignatureVerifier,
  type BlockSigVerdict,
  type ReceiptSignatureVerifier,
  type UWBlock,
  type UWBlockSignature,
  type UWReceipt,
} from '@uwmd/core';
import { algorithmParams, isKnownAlgorithm, subtle } from './algorithms.js';
import { fromBase64Url, utf8 } from './base64.js';
import type { KeyStore } from './keys.js';

/** RFC 0010's `SigVerifyError`, plus the hash check core cannot do alone. */
export type SigVerifyError = BlockSigFailure | 'content_hash_mismatch';

export type BlockVerification =
  | { ok: true; kid: string }
  | { ok: false; reason: SigVerifyError; kid?: string };

/**
 * Verify a block's signature end to end: recompute the block's `content_hash`,
 * then check the signature over the canonical signing input.
 *
 * The hash recomputation is the part that makes this meaningful. The signature
 * only commits to a hash *value*; without re-deriving that value from the block
 * in front of you, a tampered block with its original signature and original
 * stamped hash verifies happily.
 */
export async function verifyBlockSignature(
  block: UWBlock,
  store: KeyStore,
): Promise<BlockVerification> {
  const signature = block.meta.signature;
  if (!signature) return { ok: false, reason: 'malformed' };
  if (!isWellFormed(signature)) return { ok: false, reason: 'malformed', kid: signature.kid };

  const payload = blockSigningPayload(block);
  if (payload === null) return { ok: false, reason: 'malformed', kid: signature.kid };

  const recomputed = await computeBlockHash(block);
  if (recomputed !== block.meta.content_hash) {
    return { ok: false, reason: 'content_hash_mismatch', kid: signature.kid };
  }

  const verdict = await verifyDetached(payload, signature, store);
  return verdict.ok ? { ok: true, kid: signature.kid } : { ...verdict, kid: signature.kid };
}

/**
 * A {@link BlockSignatureVerifier} for `verifyChain(parsed, { signatureVerifier })`.
 *
 * Scoped narrower than {@link verifyBlockSignature} on purpose: `verifyChain`
 * already recomputes every `content_hash` and reports a mismatch as INT-04, so
 * repeating that here would report one tampered block twice under two codes.
 */
export function createBlockSignatureVerifier(store: KeyStore): BlockSignatureVerifier {
  return {
    async verify(payload: string, signature: UWBlockSignature): Promise<BlockSigVerdict> {
      if (!isWellFormed(signature)) return { ok: false, reason: 'malformed' };
      return verifyDetached(payload, signature, store);
    },
  };
}

/**
 * A {@link ReceiptSignatureVerifier} for `verifyReceipt(..., { signatureVerifier })`.
 *
 * Without one, a signed receipt verifies as `unverifiable` with RCP-08 — the
 * one advertised receipt feature that shipped unimplemented until this package
 * existed.
 */
export function createReceiptSignatureVerifier(store: KeyStore): ReceiptSignatureVerifier {
  return {
    async verify(receipt: UWReceipt, signedPayload: string): Promise<boolean> {
      const signature = receipt.signature;
      if (!signature) return false;
      const verdict = await verifyRawSignature(signedPayload, signature.algorithm, signature.key_id, signature.value, store);
      return verdict.ok;
    },
  };
}

function verifyDetached(
  payload: string,
  signature: UWBlockSignature,
  store: KeyStore,
): Promise<BlockSigVerdict> {
  return verifyRawSignature(payload, signature.alg, signature.kid, signature.sig, store);
}

/**
 * The one place a signature is actually checked. Blocks and receipts carry the
 * same three facts under different key names (`alg`/`kid`/`sig` vs
 * `algorithm`/`key_id`/`value`); flattening them here is what keeps the two
 * surfaces from growing two subtly different verifiers.
 */
export async function verifyRawSignature(
  payload: string,
  alg: string,
  kid: string,
  sig: string,
  store: KeyStore,
): Promise<BlockSigVerdict> {
  if (!isKnownAlgorithm(alg)) return { ok: false, reason: 'algorithm_mismatch' };

  const key = await store.resolve(kid);
  if (!key) return { ok: false, reason: 'unknown_kid' };
  if (key.alg !== alg) return { ok: false, reason: 'algorithm_mismatch' };

  let sigBytes: Uint8Array;
  try {
    sigBytes = fromBase64Url(sig);
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  const params = algorithmParams(alg);
  let ok: boolean;
  try {
    ok = await subtle().verify(
      params.signParams as AlgorithmIdentifier,
      key.publicKey,
      sigBytes as unknown as BufferSource,
      utf8(payload) as unknown as BufferSource,
    );
  } catch {
    // Web Crypto throws on a signature of the wrong length for the curve
    // rather than returning false. That is malformed input, not a bad key.
    return { ok: false, reason: 'malformed' };
  }
  return ok ? { ok: true } : { ok: false, reason: 'bad_signature' };
}

function isWellFormed(signature: UWBlockSignature): boolean {
  return (
    typeof signature.alg === 'string' &&
    typeof signature.kid === 'string' &&
    signature.kid.length > 0 &&
    typeof signature.sig === 'string' &&
    signature.sig.length > 0
  );
}
