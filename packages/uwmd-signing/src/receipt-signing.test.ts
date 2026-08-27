import { describe, expect, it } from 'vitest';
import { receiptSigningPayload, type UWReceipt } from '@uwmd/core';
import { generateSigningKeyPair, InMemoryKeyStore } from './keys.js';
import { signReceipt, stampReceiptSignature } from './sign.js';
import { createReceiptSignatureVerifier } from './verify.js';
import { fromBase64Url, toBase64Url } from './base64.js';

const RECEIPT: UWReceipt = {
  receipt_version: '1.1',
  subject: {
    representation: 'uwx-markdown',
    representation_version: '1.1',
    canonicalization: 'uw-envelope-semantic',
    canonicalization_version: '1.0',
    digest: `sha256:${'a'.repeat(64)}`,
  },
  computation: {
    pack: 'multifamily',
    pack_version: '1.0.0',
    engine: '@uwmd/core',
    engine_version: '1.7.0',
    results: [],
    results_digest: `sha256:${'b'.repeat(64)}`,
  },
  policy: {
    policy_set: 'builtin',
    policy_set_version: '1.0.0',
    validation: { errors: 0, warnings: 0 },
  },
  issued_at: '2026-08-27T00:00:00Z',
  issuer: 'uwmd.org/reference',
  signature: null,
};

describe('signReceipt', () => {
  it('signs the receipt-with-null-signature payload and verifies against it', async () => {
    const { signing, verifying } = await generateSigningKeyPair('ed25519', 'issuer-2026');
    const signed = stampReceiptSignature(RECEIPT, await signReceipt(RECEIPT, signing));

    expect(signed.signature).toMatchObject({ algorithm: 'ed25519', key_id: 'issuer-2026' });

    const verifier = createReceiptSignatureVerifier(new InMemoryKeyStore([verifying]));
    await expect(verifier.verify(signed, receiptSigningPayload(signed))).resolves.toBe(true);
  });

  it('rejects the signature once any receipt field changes', async () => {
    const { signing, verifying } = await generateSigningKeyPair('ed25519', 'issuer-2026');
    const signed = stampReceiptSignature(RECEIPT, await signReceipt(RECEIPT, signing));
    const tampered = { ...signed, issuer: 'someone-else' };

    const verifier = createReceiptSignatureVerifier(new InMemoryKeyStore([verifying]));
    await expect(verifier.verify(tampered, receiptSigningPayload(tampered))).resolves.toBe(false);
  });

  it('rejects a receipt signed by a key the store does not hold', async () => {
    const { signing } = await generateSigningKeyPair('ed25519', 'issuer-2026');
    const signed = stampReceiptSignature(RECEIPT, await signReceipt(RECEIPT, signing));

    const verifier = createReceiptSignatureVerifier(new InMemoryKeyStore());
    await expect(verifier.verify(signed, receiptSigningPayload(signed))).resolves.toBe(false);
  });

  it('returns false for an unsigned receipt rather than vacuously true', async () => {
    const { verifying } = await generateSigningKeyPair('ed25519', 'issuer-2026');
    const verifier = createReceiptSignatureVerifier(new InMemoryKeyStore([verifying]));
    await expect(verifier.verify(RECEIPT, receiptSigningPayload(RECEIPT))).resolves.toBe(false);
  });

  it('signing does not mutate the receipt', async () => {
    const { signing } = await generateSigningKeyPair('ed25519', 'issuer-2026');
    await signReceipt(RECEIPT, signing);
    expect(RECEIPT.signature).toBeNull();
  });
});

describe('base64url', () => {
  it('round-trips arbitrary bytes without padding', () => {
    for (let length = 0; length < 8; length++) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 37 + 11) & 0xff);
      const encoded = toBase64Url(bytes);
      expect(encoded).not.toContain('=');
      expect([...fromBase64Url(encoded)]).toEqual([...bytes]);
    }
  });

  it('uses the URL-safe alphabet, so a signature never needs escaping', () => {
    // 0xFB 0xFF encodes to '+/' in standard base64 and '-_' in base64url.
    expect(toBase64Url(Uint8Array.from([0xfb, 0xff, 0xbf]))).toBe('-_-_');
  });
});
