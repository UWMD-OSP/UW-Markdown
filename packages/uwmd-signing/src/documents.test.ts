import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifyDocumentSignature, documentSigningPayload, type UWSignatureAlgorithm } from '@uwmd/verify';
import { generateSigningKeyPair, InMemoryKeyStore } from './keys.js';
import { signDocument, createDocumentSignatureVerifier, loadDocumentSigningKey } from './documents.js';
import { subtle } from './algorithms.js';

const SOURCE = readFileSync(resolve(__dirname, '../../../conformance/signing/blocks/01-signed-valid/deal.uwx.md'), 'utf8');
describe.each(['ed25519', 'es256', 'es384'] as UWSignatureAlgorithm[])('document signatures: %s', alg => {
  it('authenticates source and detects tampering of document and signer metadata', async () => {
    const { signing, verifying } = await generateSigningKeyPair(alg, 'document-key');
    const signature = await signDocument(SOURCE, signing, { signedAt: '2026-10-14T00:00:00Z' });
    const alias = { ...verifying, kid: 'same-key-alias' };
    const store = new InMemoryKeyStore([verifying, alias]);
    const options = { signatureVerifier: createDocumentSignatureVerifier(store) };
    expect(await verifyDocumentSignature(SOURCE, signature, options)).toMatchObject({ state: 'verified' });
    expect(await verifyDocumentSignature(SOURCE.replaceAll('\n', '\r\n'), signature, options)).toMatchObject({ state: 'verified' });
    expect(await verifyDocumentSignature(SOURCE.replace('"year_built": 1995', '"year_built": 1996'), signature, options))
      .toMatchObject({ state: 'failed', reason: 'subject_mismatch' });
    for (const edit of [{ kid: alias.kid }, { signed_at: '2026-10-15T00:00:00Z' }]) {
      expect(await verifyDocumentSignature(SOURCE, { ...signature, ...edit }, options)).toMatchObject({ state: 'failed', reason: 'bad_signature' });
    }
    expect(await verifyDocumentSignature(SOURCE, { ...signature, sig: `${signature.sig}=` }, options)).toMatchObject({ state: 'failed', reason: 'malformed' });
    expect(await verifyDocumentSignature(SOURCE, signature, { signatureVerifier: createDocumentSignatureVerifier(new InMemoryKeyStore()) }))
      .toMatchObject({ state: 'unverifiable', reason: 'unknown_kid' });
    const other = await generateSigningKeyPair(alg === 'es384' ? 'es256' : 'es384', signing.kid);
    expect(await verifyDocumentSignature(SOURCE, signature, { signatureVerifier: createDocumentSignatureVerifier(new InMemoryKeyStore([other.verifying])) }))
      .toMatchObject({ state: 'failed', reason: 'algorithm_mismatch' });
  });
});
describe('document signing production inputs', () => {
  it('reproduces pinned Ed25519 artifacts and binds the domain discriminator', async () => {
    const { signing } = await generateSigningKeyPair('ed25519', 'k');
    const first = await signDocument(SOURCE, signing, { signedAt: '2026-10-14T00:00:00Z' });
    expect(await signDocument(SOURCE, signing, { signedAt: first.signed_at })).toEqual(first);
    expect(documentSigningPayload(first)).toContain('"kind":"uwmd-document-signature"');
    expect(documentSigningPayload(first)).not.toContain(first.sig);
    expect((await signDocument(SOURCE, signing)).signed_at).toMatch(/^\d{4}-/);
    await expect(signDocument(SOURCE, signing, { signedAt: 'not an instant' })).rejects.toMatchObject({ code: 'SIG_UNSIGNABLE' });
    await expect(signDocument(SOURCE, { ...signing, kid: '' })).rejects.toMatchObject({ code: 'SIG_UNSIGNABLE' });
  });
  it('imports CLI signing keys in JWK and PKCS8 forms without exposing private material', async () => {
    const { signing, verifying } = await generateSigningKeyPair('ed25519', 'cli-key');
    const jwk = await subtle().exportKey('jwk', signing.privateKey);
    const imported = await loadDocumentSigningKey({ kid: signing.kid, alg: signing.alg, private_key_jwk: jwk });
    const signature = await signDocument(SOURCE, imported);
    expect(await verifyDocumentSignature(SOURCE, signature, { signatureVerifier: createDocumentSignatureVerifier(new InMemoryKeyStore([verifying])) })).toMatchObject({ state: 'verified' });
    expect(JSON.stringify(signature)).not.toContain(jwk.d);
  });
  it.each([null, [], {}, { kid: 'k', alg: 'unknown', private_key_pkcs8: 'bad' },
    { kid: 'k', alg: 'ed25519', extra: true, private_key_pkcs8: 'bad' },
    { kid: '', alg: 'ed25519', private_key_pkcs8: 'bad' },
    { kid: 'k', alg: 'ed25519', private_key_jwk: {}, private_key_pkcs8: 'bad' },
    { kid: 'k', alg: 'ed25519', private_key_pkcs8: 'bad' },
  ])('refuses malformed local key documents (%#)', async value => {
    await expect(loadDocumentSigningKey(value)).rejects.toMatchObject({ code: 'SIG_BAD_KEY' });
  });
});
