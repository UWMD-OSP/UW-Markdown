import { describe, expect, it } from 'vitest';
import { SigningError } from './errors.js';
import { exportPublicKeyJwk, generateSigningKeyPair, InMemoryKeyStore } from './keys.js';
import { loadKeyStoreDocument, parseKeyStore, type KeyStoreDocument } from './keystore-file.js';
import { signBlock, stampBlockSignature } from './sign.js';
import { hashedBlock } from './test-helpers.js';
import { verifyBlockSignature } from './verify.js';

async function documentWithOneKey(kid = 'sponsor-2026'): Promise<{
  document: KeyStoreDocument;
  signing: Awaited<ReturnType<typeof generateSigningKeyPair>>['signing'];
}> {
  const { signing, verifying } = await generateSigningKeyPair('ed25519', kid);
  return {
    signing,
    document: {
      keystore_version: '1',
      keys: [{ kid, alg: 'ed25519', public_key_jwk: await exportPublicKeyJwk(verifying) }],
    },
  };
}

describe('loadKeyStoreDocument', () => {
  it('round-trips a JWK key through the document and verifies a real signature', async () => {
    const { document, signing } = await documentWithOneKey();
    const store = await loadKeyStoreDocument(document);
    const block = await hashedBlock('property', { total_units: 100 });
    const signed = stampBlockSignature(block, await signBlock(block, signing));

    await expect(verifyBlockSignature(signed, store)).resolves.toEqual({
      ok: true,
      kid: 'sponsor-2026',
    });
  });

  it('accepts base64 SPKI key material', async () => {
    const { signing, verifying } = await generateSigningKeyPair('es256', 'lender');
    const spki = await crypto.subtle.exportKey('spki', verifying.publicKey);
    const base64 = Buffer.from(new Uint8Array(spki)).toString('base64');

    const store = await loadKeyStoreDocument({
      keystore_version: '1',
      keys: [{ kid: 'lender', alg: 'es256', public_key_spki: base64 }],
    });
    const block = await hashedBlock('debt_structure', { loan_amount: 1_000_000 });
    const signed = stampBlockSignature(block, await signBlock(block, signing));

    await expect(verifyBlockSignature(signed, store)).resolves.toEqual({ ok: true, kid: 'lender' });
  });

  it('resolves an absent kid to null rather than throwing', async () => {
    const { document } = await documentWithOneKey();
    const store = await loadKeyStoreDocument(document);
    await expect(store.resolve('nobody')).resolves.toBeNull();
  });

  const REFUSALS: Array<[string, unknown]> = [
    ['a non-object document', ['not', 'an', 'object']],
    ['a missing keystore_version', { keys: [] }],
    ['an unknown keystore_version', { keystore_version: '2', keys: [] }],
    ['keys that are not an array', { keystore_version: '1', keys: {} }],
    ['an entry with no kid', { keystore_version: '1', keys: [{ alg: 'ed25519' }] }],
    [
      'an unadmitted algorithm',
      { keystore_version: '1', keys: [{ kid: 'k', alg: 'rs256', public_key_spki: 'AA' }] },
    ],
    [
      'an entry with neither key form',
      { keystore_version: '1', keys: [{ kid: 'k', alg: 'ed25519' }] },
    ],
    [
      'an entry with both key forms',
      {
        keystore_version: '1',
        keys: [{ kid: 'k', alg: 'ed25519', public_key_jwk: {}, public_key_spki: 'AA' }],
      },
    ],
  ];

  it.each(REFUSALS)('refuses %s', async (_label, document) => {
    await expect(loadKeyStoreDocument(document)).rejects.toMatchObject({
      code: 'SIG_BAD_KEYSTORE',
    });
  });

  it('refuses a duplicate kid rather than letting file order decide', async () => {
    const { document } = await documentWithOneKey();
    const doubled = { ...document, keys: [...document.keys, ...document.keys] };
    await expect(loadKeyStoreDocument(doubled)).rejects.toMatchObject({
      code: 'SIG_BAD_KEYSTORE',
    });
  });

  it('refuses a JWK whose curve disagrees with the declared alg', async () => {
    const { verifying } = await generateSigningKeyPair('es256', 'k');
    const jwk = await exportPublicKeyJwk(verifying);
    await expect(
      loadKeyStoreDocument({
        keystore_version: '1',
        keys: [{ kid: 'k', alg: 'es384', public_key_jwk: jwk }],
      }),
    ).rejects.toMatchObject({ code: 'SIG_BAD_KEY' });
  });
});

describe('parseKeyStore', () => {
  it('reports invalid JSON as a keystore problem, not a crypto one', async () => {
    await expect(parseKeyStore('{ nope')).rejects.toBeInstanceOf(SigningError);
    await expect(parseKeyStore('{ nope')).rejects.toMatchObject({ code: 'SIG_BAD_KEYSTORE' });
  });

  it('parses a serialized document', async () => {
    const { document } = await documentWithOneKey('rotated-2027');
    const store = await parseKeyStore(JSON.stringify(document));
    await expect(store.resolve('rotated-2027')).resolves.toMatchObject({ alg: 'ed25519' });
  });
});

describe('InMemoryKeyStore', () => {
  it('lists the kids it holds, so key rotation is visible to an operator', async () => {
    const old = await generateSigningKeyPair('ed25519', 'sponsor-2025');
    const current = await generateSigningKeyPair('ed25519', 'sponsor-2026');
    const store = new InMemoryKeyStore([old.verifying]).add(current.verifying);
    expect(store.kids).toEqual(['sponsor-2025', 'sponsor-2026']);
  });
});
