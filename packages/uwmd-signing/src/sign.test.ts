import { describe, expect, it } from 'vitest';
import { computeBlockHash, verifyChain, type UWSignatureAlgorithm } from '@uwmd/core';
import { SigningError } from './errors.js';
import { InMemoryKeyStore, generateSigningKeyPair } from './keys.js';
import { signBlock, stampBlockSignature } from './sign.js';
import { hashedBlock, makeBlock, makeFile } from './test-helpers.js';
import { createBlockSignatureVerifier, verifyBlockSignature } from './verify.js';

const ALGORITHMS: UWSignatureAlgorithm[] = ['ed25519', 'es256', 'es384'];

describe.each(ALGORITHMS)('round trip - %s', (alg) => {
  it('signs a block and verifies it against the signer key', async () => {
    const { signing, verifying } = await generateSigningKeyPair(alg, `k-${alg}`);
    const block = await hashedBlock('property', { total_units: 100 });
    const signed = stampBlockSignature(block, await signBlock(block, signing));

    expect(signed.meta.signature?.alg).toBe(alg);
    expect(signed.meta.signature?.kid).toBe(`k-${alg}`);
    expect(signed.meta.signature?.sig).toMatch(/^[A-Za-z0-9_-]+$/);

    const store = new InMemoryKeyStore([verifying]);
    await expect(verifyBlockSignature(signed, store)).resolves.toEqual({ ok: true, kid: `k-${alg}` });
  });

  it('rejects the signature once the block content changes', async () => {
    const { signing, verifying } = await generateSigningKeyPair(alg, 'k');
    const block = await hashedBlock('property', { total_units: 100 });
    const signed = stampBlockSignature(block, await signBlock(block, signing));
    const tampered = { ...signed, content: { total_units: 120 } };

    const result = await verifyBlockSignature(tampered, new InMemoryKeyStore([verifying]));
    expect(result).toEqual({ ok: false, reason: 'content_hash_mismatch', kid: 'k' });
  });
});

describe('signBlock', () => {
  it('refuses a block with no content_hash', async () => {
    const { signing } = await generateSigningKeyPair('ed25519', 'k');
    const block = makeBlock('property', { total_units: 100 });
    await expect(signBlock(block, signing)).rejects.toBeInstanceOf(SigningError);
    await expect(signBlock(block, signing)).rejects.toMatchObject({ code: 'SIG_UNSIGNABLE' });
  });

  it('stamps a content_hash on request, and the stamped hash is the one signed', async () => {
    const { signing, verifying } = await generateSigningKeyPair('ed25519', 'k');
    const block = makeBlock('property', { total_units: 100 });
    const signature = await signBlock(block, signing, { stampContentHash: true });
    const signed = stampBlockSignature(block, signature, await computeBlockHash(block));

    await expect(verifyBlockSignature(signed, new InMemoryKeyStore([verifying]))).resolves.toEqual({
      ok: true,
      kid: 'k',
    });
  });

  it('is reproducible when signed_at is pinned (ed25519 is deterministic)', async () => {
    const { signing } = await generateSigningKeyPair('ed25519', 'k');
    const block = await hashedBlock('property', { total_units: 100 });
    const a = await signBlock(block, signing, { signedAt: '2026-08-27T00:00:00Z' });
    const b = await signBlock(block, signing, { signedAt: '2026-08-27T00:00:00Z' });
    expect(a).toEqual(b);
  });

  it('produces a different signature when signed_at changes', async () => {
    const { signing } = await generateSigningKeyPair('ed25519', 'k');
    const block = await hashedBlock('property', { total_units: 100 });
    const a = await signBlock(block, signing, { signedAt: '2026-08-27T00:00:00Z' });
    const b = await signBlock(block, signing, { signedAt: '2026-08-28T00:00:00Z' });
    expect(a.sig).not.toBe(b.sig);
  });

  it('does not mutate the block it signs', async () => {
    const { signing } = await generateSigningKeyPair('ed25519', 'k');
    const block = await hashedBlock('property', { total_units: 100 });
    await signBlock(block, signing);
    expect(block.meta.signature).toBeUndefined();
  });

  // RFC 0010 asserts that excluding `parent_hash` from the signing input means
  // re-rooting a chain leaves prior signatures intact. That reasoning does not
  // survive contact with this repo's §V.9: `content_hash` is computed over
  // content *and* `_meta`, and `parent_hash` lives in `_meta`. So the signature
  // covers it transitively, via the hash, and re-rooting requires re-signing.
  // See the erratum in RFC 0010 and protocol §V.11.
  it('does not survive a parent_hash change, because content_hash covers it', async () => {
    const { signing, verifying } = await generateSigningKeyPair('ed25519', 'k');
    const block = await hashedBlock('property', { total_units: 100 });
    const signed = stampBlockSignature(block, await signBlock(block, signing));
    const reRooted = { ...signed, meta: { ...signed.meta, parent_hash: 'b'.repeat(64) } };

    await expect(verifyBlockSignature(reRooted, new InMemoryKeyStore([verifying]))).resolves.toEqual({
      ok: false,
      reason: 'content_hash_mismatch',
      kid: 'k',
    });
    // Re-stamping the hash and re-signing is the supported path.
    const rehashed = {
      ...reRooted,
      meta: { ...reRooted.meta, content_hash: await computeBlockHash(reRooted) },
    };
    const resigned = stampBlockSignature(rehashed, await signBlock(rehashed, signing));
    await expect(verifyBlockSignature(resigned, new InMemoryKeyStore([verifying]))).resolves.toEqual({
      ok: true,
      kid: 'k',
    });
  });
});

describe('verifyChain with a real verifier', () => {
  it('verifies a signed file end to end', async () => {
    const { signing, verifying } = await generateSigningKeyPair('ed25519', 'sponsor-2026');
    const block = await hashedBlock('rent_roll', { units: [{ unit: '1A', rent: 1800 }] });
    const signed = stampBlockSignature(block, await signBlock(block, signing));

    const result = await verifyChain(makeFile({ rent_roll: signed }), {
      signatureVerifier: createBlockSignatureVerifier(new InMemoryKeyStore([verifying])),
    });
    expect(result.ok).toBe(true);
    expect(result.signatures_present).toBe(1);
    expect(result.signatures_verified).toBe(1);
  });

  it('reports INT-06 for a key the store does not hold', async () => {
    const { signing } = await generateSigningKeyPair('ed25519', 'sponsor-2026');
    const block = await hashedBlock('rent_roll', { units: [] });
    const signed = stampBlockSignature(block, await signBlock(block, signing));

    const result = await verifyChain(makeFile({ rent_roll: signed }), {
      signatureVerifier: createBlockSignatureVerifier(new InMemoryKeyStore()),
    });
    expect(result.issues.map((i) => i.code)).toContain('INT-06');
    expect(result.ok).toBe(false);
  });

  it('reports INT-07 when a signature is swapped between blocks', async () => {
    const { signing, verifying } = await generateSigningKeyPair('ed25519', 'k');
    const rentRoll = await hashedBlock('rent_roll', { units: [] });
    const property = await hashedBlock('property', { total_units: 100 });
    // A valid signature over `property`, moved onto `rent_roll`. Both stamped
    // hashes still recompute, so only the signature can catch this.
    const stolen = stampBlockSignature(rentRoll, await signBlock(property, signing));

    const result = await verifyChain(makeFile({ rent_roll: stolen }), {
      signatureVerifier: createBlockSignatureVerifier(new InMemoryKeyStore([verifying])),
    });
    expect(result.issues.filter((i) => i.code === 'INT-07')).toHaveLength(1);
    expect(result.issues.some((i) => i.code === 'INT-04')).toBe(false);
  });

  it('reports INT-07 when the signing key is not the key that signed', async () => {
    const { signing } = await generateSigningKeyPair('ed25519', 'k');
    const impostor = await generateSigningKeyPair('ed25519', 'k');
    const block = await hashedBlock('property', { total_units: 100 });
    const signed = stampBlockSignature(block, await signBlock(block, signing));

    const result = await verifyChain(makeFile({ property: signed }), {
      signatureVerifier: createBlockSignatureVerifier(new InMemoryKeyStore([impostor.verifying])),
    });
    expect(result.issues.map((i) => i.code)).toContain('INT-07');
  });

  it('reports algorithm_mismatch when the store holds a different curve under the kid', async () => {
    const { signing } = await generateSigningKeyPair('es256', 'k');
    const other = await generateSigningKeyPair('es384', 'k');
    const block = await hashedBlock('property', { total_units: 100 });
    const signed = stampBlockSignature(block, await signBlock(block, signing));
    const signature = signed.meta.signature as NonNullable<typeof signed.meta.signature>;

    const verifier = createBlockSignatureVerifier(new InMemoryKeyStore([other.verifying]));
    await expect(verifier.verify('irrelevant', signature)).resolves.toEqual({
      ok: false,
      reason: 'algorithm_mismatch',
    });
  });
});
