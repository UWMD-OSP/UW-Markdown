import { describe, expect, it } from 'vitest';
import type { UWSignatureAlgorithm } from '@uwmd/verify';
import { generateSigningKeyPair, InMemoryKeyStore } from './keys.js';
import { signBlock, signPayload, stampBlockSignature } from './sign.js';
import { hashedBlock, makeFile } from './test-helpers.js';
import { verifyChain } from '@uwmd/verify';
import { createBlockSignatureVerifier, verifyBlockSignature, verifyRawSignature } from './verify.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const ALGORITHMS: UWSignatureAlgorithm[] = ['ed25519', 'es256', 'es384'];

describe.each(ALGORITHMS)('signature encoding - %s', (alg) => {
  it('accepts canonical bytes and refuses padding, partial sextets and unused bits', async () => {
    const { signing, verifying } = await generateSigningKeyPair(alg, 'encoding-key');
    const store = new InMemoryKeyStore([verifying]);
    const sig = await signPayload('canonical payload', signing);
    await expect(verifyRawSignature('canonical payload', alg, signing.kid, sig, store)).resolves.toEqual({ ok: true });
    const alternatives = [`${sig}=`, `${sig}==`, `${sig}A`, `${sig}\n`];
    if (sig.length % 4 === 2) {
      const last = ALPHABET.indexOf(sig.slice(-1));
      for (let unused = 1; unused < 16; unused++) {
        alternatives.push(sig.slice(0, -1) + ALPHABET[last + unused]);
      }
    }
    for (const alternate of alternatives) {
      await expect(verifyRawSignature('canonical payload', alg, signing.kid, alternate, store))
        .resolves.toEqual({ ok: false, reason: 'malformed' });
    }
  });

  it('reports malformed blocks as INT-07 through the chain verifier', async () => {
    const { signing, verifying } = await generateSigningKeyPair(alg, 'encoding-key');
    const store = new InMemoryKeyStore([verifying]);
    const block = await hashedBlock('property', { total_units: 100 });
    const signature = await signBlock(block, signing);
    const signed = stampBlockSignature(block, { ...signature, sig: `${signature.sig}=` });
    await expect(verifyBlockSignature(signed, store)).resolves.toMatchObject({ ok: false, reason: 'malformed' });
    const result = await verifyChain(makeFile({ property: signed }), {
      signatureVerifier: createBlockSignatureVerifier(store),
    });
    expect(result.ok).toBe(false);
    expect(result.signatures_verified).toBe(0);
    expect(result.issues.map(issue => issue.code)).toEqual(['INT-07']);
  });
});
