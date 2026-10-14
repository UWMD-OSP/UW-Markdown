// RFC 0084: document authentication needs no calculation pack.
import {
  documentSigningPayload, resolveDocumentSigningSubject,
  type UWDocumentSignature, type DocumentSignatureVerifier,
} from '@uwmd/verify';
import { signPayload } from './sign.js';
import { verifyRawSignature } from './verify.js';
import { importPrivateKey, type KeyStore, type SigningKey } from './keys.js';
import { isKnownAlgorithm } from './algorithms.js';
import { SigningError } from './errors.js';

export async function signDocument(
  source: string, key: SigningKey, options: { signedAt?: string } = {},
): Promise<UWDocumentSignature> {
  const signedAt = options.signedAt ?? new Date().toISOString();
  if (key.kid.length === 0 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(signedAt)
    || !Number.isFinite(Date.parse(signedAt))) throw new SigningError('SIG_UNSIGNABLE', 'A nonempty key id and ISO signing instant are required.');
  const input: Omit<UWDocumentSignature, 'sig'> = {
    kind: 'uwmd-document-signature', signature_version: '1',
    subject: await resolveDocumentSigningSubject(source), alg: key.alg,
    kid: key.kid, signed_at: signedAt,
  };
  let payload: string;
  try { payload = documentSigningPayload(input); }
  catch (error) { throw new SigningError('SIG_UNSIGNABLE', (error as Error).message); }
  return { ...input, sig: await signPayload(payload, key) };
}

export function createDocumentSignatureVerifier(store: KeyStore): DocumentSignatureVerifier {
  return { verify: (payload, signature) => verifyRawSignature(payload, signature.alg, signature.kid, signature.sig, store) };
}

/** Reference CLI key document. Private keys are supplied locally, never in the signature. */
export async function loadDocumentSigningKey(document: unknown): Promise<SigningKey> {
  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    throw new SigningError('SIG_BAD_KEY', 'Expected a document signing key object.');
  }
  const value = document as Record<string, unknown>;
  const allowed = ['kid', 'alg', 'private_key_jwk', 'private_key_pkcs8'];
  if (Object.keys(value).some(key => !allowed.includes(key)) || typeof value.kid !== 'string' || value.kid.length === 0
    || typeof value.alg !== 'string' || !isKnownAlgorithm(value.alg)
    || Number(Object.hasOwn(value, 'private_key_jwk')) + Number(Object.hasOwn(value, 'private_key_pkcs8')) !== 1) {
    throw new SigningError('SIG_BAD_KEY', 'Expected kid, alg and exactly one private_key_jwk or private_key_pkcs8.');
  }
  const material = Object.hasOwn(value, 'private_key_jwk')
    ? { jwk: value.private_key_jwk as JsonWebKey } : { pkcs8: value.private_key_pkcs8 as string };
  return { kid: value.kid, alg: value.alg, privateKey: await importPrivateKey(value.alg, material) };
}
