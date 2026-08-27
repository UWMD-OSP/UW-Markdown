// Key import/export and the key-store contract.
//
// Key *distribution* is deliberately out of scope — RFC 0010 §Alternatives
// rejects inline public keys precisely because a key that travels with the
// document it authenticates proves nothing. What this file defines is the
// narrow thing the spec does need: how a `kid` resolves to usable key material.

import type { UWSignatureAlgorithm } from '@uwmd/core';
import { algorithmParams, isKnownAlgorithm, subtle } from './algorithms.js';
import { fromBase64Any } from './base64.js';
import { SigningError } from './errors.js';

/** A public key a verifier trusts, resolved from a `kid`. */
export interface SignerKey {
  kid: string;
  alg: UWSignatureAlgorithm;
  publicKey: CryptoKey;
}

/** A private key a signer holds. Never serialized by this package. */
export interface SigningKey {
  kid: string;
  alg: UWSignatureAlgorithm;
  privateKey: CryptoKey;
}

/**
 * Resolves a `kid` to the public key a verifier should check against.
 *
 * `null` means "I do not hold this key" and MUST NOT be conflated with "the
 * signature is bad" — they are INT-06 and INT-07 respectively, and a verifier
 * that merges them tells an operator to re-sign when the real fix is to load a
 * key.
 */
export interface KeyStore {
  resolve(kid: string): Promise<SignerKey | null>;
}

/** Key material as it appears in a key-store document. */
export type PublicKeyMaterial =
  /** JWK — the portable form; `kty`/`crv` are checked against `alg`. */
  | { jwk: JsonWebKey }
  /** PKIX SubjectPublicKeyInfo, base64 or base64url, with or without padding. */
  | { spki: string };

export async function importPublicKey(
  alg: string,
  material: PublicKeyMaterial,
): Promise<CryptoKey> {
  return importKey(alg, material, 'public');
}

export async function importPrivateKey(
  alg: string,
  material: { jwk: JsonWebKey } | { pkcs8: string },
): Promise<CryptoKey> {
  const normalized: PublicKeyMaterial =
    'jwk' in material ? { jwk: material.jwk } : { spki: material.pkcs8 };
  return importKey(alg, normalized, 'private');
}

async function importKey(
  alg: string,
  material: PublicKeyMaterial,
  kind: 'public' | 'private',
): Promise<CryptoKey> {
  if (!isKnownAlgorithm(alg)) {
    throw new SigningError(
      'SIG_ALGORITHM_UNSUPPORTED',
      `Unknown signature algorithm '${alg}'.`,
    );
  }
  const params = algorithmParams(alg);
  const usages: KeyUsage[] = kind === 'public' ? ['verify'] : ['sign'];

  try {
    if ('jwk' in material) {
      assertJwkMatchesAlgorithm(alg, material.jwk, params.kty, params.crv);
      return await subtle().importKey('jwk', material.jwk, params.keyParams, true, usages);
    }
    const bytes = fromBase64Any(material.spki);
    const format = kind === 'public' ? 'spki' : 'pkcs8';
    return await subtle().importKey(
      format,
      bytes as unknown as BufferSource,
      params.keyParams,
      true,
      usages,
    );
  } catch (error) {
    if (error instanceof SigningError) throw error;
    throw new SigningError(
      'SIG_BAD_KEY',
      `Could not import the ${kind} key for '${alg}': ${(error as Error).message}`,
    );
  }
}

/**
 * Reject a JWK whose curve disagrees with the declared `alg` *before* handing
 * it to Web Crypto.
 *
 * Without this, a P-256 key labelled `es384` imports cleanly on some runtimes
 * and then fails every verification, which reads as "the document was tampered
 * with" when the truth is "the key store is mislabelled".
 */
function assertJwkMatchesAlgorithm(
  alg: string,
  jwk: JsonWebKey,
  kty: string,
  crv: string,
): void {
  if (jwk.kty !== kty || jwk.crv !== crv) {
    throw new SigningError(
      'SIG_BAD_KEY',
      `Key declares alg '${alg}' (expects kty=${kty}, crv=${crv}) but the JWK is kty=${String(jwk.kty)}, crv=${String(jwk.crv)}.`,
    );
  }
}

/** An in-memory {@link KeyStore}. The reference verifier for tests and hosts. */
export class InMemoryKeyStore implements KeyStore {
  private readonly keys = new Map<string, SignerKey>();

  constructor(keys: Iterable<SignerKey> = []) {
    for (const key of keys) this.add(key);
  }

  add(key: SignerKey): this {
    this.keys.set(key.kid, key);
    return this;
  }

  async resolve(kid: string): Promise<SignerKey | null> {
    return this.keys.get(kid) ?? null;
  }

  /**
   * Key ids currently held. Key *rotation* is "issue under a new kid and keep
   * the old one loaded" (RFC 0010 §Unresolved questions), so a store routinely
   * holds several keys for one logical signer and this is how an operator sees
   * that it does.
   */
  get kids(): string[] {
    return [...this.keys.keys()];
  }
}

/**
 * Generate a key pair for one of the admitted algorithms.
 *
 * Present for tests, local development, and `uwmd keygen`-style tooling — not a
 * key-management system. Production keys belong in an HSM or cloud KMS behind a
 * custom {@link KeyStore}.
 */
export async function generateSigningKeyPair(
  alg: UWSignatureAlgorithm,
  kid: string,
): Promise<{ signing: SigningKey; verifying: SignerKey }> {
  const params = algorithmParams(alg);
  let pair: CryptoKeyPair;
  try {
    pair = (await subtle().generateKey(params.keyParams as AlgorithmIdentifier, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair;
  } catch (error) {
    throw new SigningError(
      'SIG_ALGORITHM_UNSUPPORTED',
      `This runtime cannot generate '${alg}' keys: ${(error as Error).message}`,
    );
  }
  return {
    signing: { kid, alg, privateKey: pair.privateKey },
    verifying: { kid, alg, publicKey: pair.publicKey },
  };
}

/** Export a public key as a JWK, for writing into a key-store document. */
export async function exportPublicKeyJwk(key: SignerKey): Promise<JsonWebKey> {
  return subtle().exportKey('jwk', key.publicKey);
}
