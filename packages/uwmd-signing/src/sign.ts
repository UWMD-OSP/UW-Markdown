// Signing: produce a detached signature over a block or a receipt.

import {
  canonicalBlockSigningInput,
  computeBlockHash,
  receiptSigningPayload,
  type UWBlock,
  type UWBlockSignature,
  type UWReceipt,
  type UWReceiptSignature,
} from '@uwmd/core';
import { algorithmParams, subtle } from './algorithms.js';
import { toBase64Url, utf8 } from './base64.js';
import { SigningError } from './errors.js';
import type { SigningKey } from './keys.js';

export interface SignBlockOptions {
  /**
   * ISO 8601 instant to stamp as `signed_at`. Defaults to now.
   *
   * Injectable because a signature is only reproducible if its inputs are, and
   * `signed_at` is one of them — conformance fixtures pin it.
   */
  signedAt?: string;
  /**
   * Stamp `content_hash` from the block's current content when it is absent.
   *
   * Off by default, and deliberately so: signing a block whose hash you just
   * computed yourself is a different act from signing a hash somebody else
   * committed to, and quietly doing the former would let a caller sign content
   * that never passed `verifyChain`.
   */
  stampContentHash?: boolean;
}

/**
 * Sign a block, returning the detached {@link UWBlockSignature}.
 *
 * The block is not mutated — use {@link stampBlockSignature} to attach the
 * result. Splitting them keeps the byte-preservation invariant honest: the
 * caller decides when the document changes.
 */
export async function signBlock(
  block: UWBlock,
  key: SigningKey,
  options: SignBlockOptions = {},
): Promise<UWBlockSignature> {
  let contentHash = block.meta.content_hash;
  if (typeof contentHash !== 'string' || contentHash.length === 0) {
    if (!options.stampContentHash) {
      throw new SigningError(
        'SIG_UNSIGNABLE',
        `Block '${block.meta.section}' has no _meta.content_hash. Stamp one first (or pass stampContentHash) — a signature over an absent hash commits to nothing and validates as INT-05.`,
      );
    }
    contentHash = await computeBlockHash(block);
  }

  const signedAt = options.signedAt ?? new Date().toISOString();
  const payload = canonicalBlockSigningInput({
    content_hash: contentHash,
    section: block.meta.section,
    actor: block.meta.actor,
    timestamp: block.meta.timestamp,
    kid: key.kid,
    signed_at: signedAt,
  });

  return {
    alg: key.alg,
    kid: key.kid,
    sig: await signPayload(payload, key),
    signed_at: signedAt,
  };
}

/**
 * Return a copy of `block` carrying `signature` (and, when `signBlock` computed
 * one, the `content_hash` it committed to).
 */
export function stampBlockSignature(
  block: UWBlock,
  signature: UWBlockSignature,
  contentHash?: string,
): UWBlock {
  return {
    ...block,
    meta: {
      ...block.meta,
      ...(contentHash ? { content_hash: contentHash } : {}),
      signature,
    },
  };
}

/**
 * Sign a verification receipt (RFC 0016). The payload is the receipt with
 * `signature: null`, canonicalized — `receiptSigningPayload` in core is the
 * single definition of that, and this package never restates it.
 */
export async function signReceipt(
  receipt: UWReceipt,
  key: SigningKey,
): Promise<UWReceiptSignature> {
  return {
    algorithm: key.alg,
    key_id: key.kid,
    value: await signPayload(receiptSigningPayload(receipt), key),
  };
}

/** Attach a receipt signature, returning a new receipt. */
export function stampReceiptSignature(
  receipt: UWReceipt,
  signature: UWReceiptSignature,
): UWReceipt {
  return { ...receipt, signature };
}

/**
 * Sign arbitrary canonical bytes. Shared by blocks, receipts, and module
 * manifests — the three artifacts differ only in what they canonicalize.
 */
export async function signPayload(payload: string, key: SigningKey): Promise<string> {
  const params = algorithmParams(key.alg);
  let bytes: ArrayBuffer;
  try {
    bytes = await subtle().sign(
      params.signParams as AlgorithmIdentifier,
      key.privateKey,
      utf8(payload) as unknown as BufferSource,
    );
  } catch (error) {
    throw new SigningError(
      'SIG_BAD_KEY',
      `Signing with key '${key.kid}' (${key.alg}) failed: ${(error as Error).message}`,
    );
  }
  return toBase64Url(new Uint8Array(bytes));
}
