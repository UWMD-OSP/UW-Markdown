// The reference key-store document: a JSON file mapping `kid` to a public key.
//
// RFC 0010 takes no position on key distribution, so this is explicitly a
// *reference* format, not a normative one — an adopter backing their store with
// an HSM implements `KeyStore` directly and never touches this file. It exists
// so that `uwmd verify --signing --keystore=<path>` has something to read and
// so the conformance fixtures have a portable way to ship a public key.

import type { UWSignatureAlgorithm } from '@uwmd/core';
import { isKnownAlgorithm } from './algorithms.js';
import { SigningError } from './errors.js';
import { InMemoryKeyStore, importPublicKey, type KeyStore, type SignerKey } from './keys.js';

/** One entry. Exactly one of `public_key_jwk` / `public_key_spki` is required. */
export interface KeyStoreEntry {
  kid: string;
  alg: UWSignatureAlgorithm;
  public_key_jwk?: JsonWebKey;
  /** PKIX SubjectPublicKeyInfo, base64 (what `openssl pkey -pubout` emits). */
  public_key_spki?: string;
  /** Free-text, for humans reading the file. Never consulted by verification. */
  description?: string;
}

export interface KeyStoreDocument {
  /** `"1"` today. A reader MUST refuse a version it does not know. */
  keystore_version: string;
  keys: KeyStoreEntry[];
}

const SUPPORTED_KEYSTORE_VERSIONS = ['1'];

/**
 * Parse and import a key-store document into an {@link InMemoryKeyStore}.
 *
 * Every key is imported eagerly. Deferring import to first use would turn a
 * typo in the store into a per-block INT-07, which reads as tampering; failing
 * once, loudly, at load time says what is actually wrong.
 */
export async function loadKeyStoreDocument(document: unknown): Promise<KeyStore> {
  const parsed = assertKeyStoreDocument(document);
  const keys: SignerKey[] = [];
  for (const entry of parsed.keys) {
    const material = entry.public_key_jwk
      ? { jwk: entry.public_key_jwk }
      : { spki: entry.public_key_spki as string };
    keys.push({
      kid: entry.kid,
      alg: entry.alg,
      publicKey: await importPublicKey(entry.alg, material),
    });
  }
  return new InMemoryKeyStore(keys);
}

/** Parse a key-store document from JSON text. */
export async function parseKeyStore(json: string): Promise<KeyStore> {
  let document: unknown;
  try {
    document = JSON.parse(json);
  } catch (error) {
    throw new SigningError('SIG_BAD_KEYSTORE', `Key store is not valid JSON: ${(error as Error).message}`);
  }
  return loadKeyStoreDocument(document);
}

/**
 * Read a key-store document from disk. Node-only by construction — the import
 * is dynamic so that bundling this module for a browser does not pull in `fs`.
 */
export async function loadKeyStoreFile(path: string): Promise<KeyStore> {
  const { readFileSync } = await import('node:fs');
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    throw new SigningError('SIG_BAD_KEYSTORE', `Could not read key store '${path}': ${(error as Error).message}`);
  }
  return parseKeyStore(text);
}

function assertKeyStoreDocument(value: unknown): KeyStoreDocument {
  const fail = (message: string): never => {
    throw new SigningError('SIG_BAD_KEYSTORE', message);
  };
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail('Key store must be a JSON object.');
  }
  const doc = value as Record<string, unknown>;
  const version = doc['keystore_version'];
  if (typeof version !== 'string') return fail('keystore_version must be a string.');
  if (!SUPPORTED_KEYSTORE_VERSIONS.includes(version)) {
    return fail(
      `Unsupported keystore_version '${version}'; this reader knows ${SUPPORTED_KEYSTORE_VERSIONS.join(', ')}.`,
    );
  }
  const keys = doc['keys'];
  if (!Array.isArray(keys)) return fail('keys must be an array.');

  const seen = new Set<string>();
  const entries: KeyStoreEntry[] = [];
  for (const [index, raw] of keys.entries()) {
    const at = `keys[${index}]`;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return fail(`${at} must be an object.`);
    }
    const entry = raw as Record<string, unknown>;
    const kid = entry['kid'];
    if (typeof kid !== 'string' || kid.length === 0) return fail(`${at}.kid must be a non-empty string.`);
    // A duplicate kid is refused rather than last-wins: the whole point of a
    // kid is that it names one key, and silently picking one of two makes
    // verification depend on file order.
    if (seen.has(kid)) return fail(`${at}.kid '${kid}' is declared more than once.`);
    seen.add(kid);

    const alg = entry['alg'];
    if (typeof alg !== 'string' || !isKnownAlgorithm(alg)) {
      return fail(`${at}.alg must be one of ed25519, es256, es384.`);
    }
    const jwk = entry['public_key_jwk'];
    const spki = entry['public_key_spki'];
    const hasJwk = jwk !== undefined;
    const hasSpki = spki !== undefined;
    if (hasJwk === hasSpki) {
      return fail(`${at} must carry exactly one of public_key_jwk or public_key_spki.`);
    }
    if (hasJwk && (typeof jwk !== 'object' || jwk === null || Array.isArray(jwk))) {
      return fail(`${at}.public_key_jwk must be an object.`);
    }
    if (hasSpki && typeof spki !== 'string') {
      return fail(`${at}.public_key_spki must be a base64 string.`);
    }
    entries.push({
      kid,
      alg,
      ...(hasJwk ? { public_key_jwk: jwk as JsonWebKey } : {}),
      ...(hasSpki ? { public_key_spki: spki as string } : {}),
      ...(typeof entry['description'] === 'string' ? { description: entry['description'] } : {}),
    });
  }
  return { keystore_version: version, keys: entries };
}
