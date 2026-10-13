import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeBlockHash, parseUWFile, verifyChain, type UWBlock, type UWSignatureAlgorithm } from '@uwmd/verify';
import { importPrivateKey } from './keys.js';
import { loadKeyStoreFile } from './keystore-file.js';
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

    expect(signed.meta.integrity?.signature?.alg).toBe(alg);
    expect(signed.meta.integrity?.signature?.kid).toBe(`k-${alg}`);
    expect(signed.meta.integrity?.signature?.sig).toMatch(/^[A-Za-z0-9_-]+$/);

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
    expect(block.meta.integrity?.signature).toBeUndefined();
  });

  // RFC 0010 §4: excluding `parent_hash` from the signing input means re-rooting
  // a chain leaves prior signatures intact. `content_hash` covers the block
  // minus `_meta` (Protocol §V.9, RFC 0081 §3), so that now holds end to end.
  it('survives a parent_hash change, because content_hash covers only the payload', async () => {
    const { signing, verifying } = await generateSigningKeyPair('ed25519', 'k');
    const block = await hashedBlock('property', { total_units: 100 });
    const signed = stampBlockSignature(block, await signBlock(block, signing));
    const reRooted = { ...signed, meta: { ...signed.meta, integrity: { ...signed.meta.integrity, parent_hash: 'b'.repeat(64) } } };

    await expect(verifyBlockSignature(reRooted, new InMemoryKeyStore([verifying]))).resolves.toEqual({
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
    const signature = signed.meta.integrity?.signature as NonNullable<NonNullable<typeof signed.meta.integrity>["signature"]>;

    const verifier = createBlockSignatureVerifier(new InMemoryKeyStore([other.verifying]));
    await expect(verifier.verify('irrelevant', signature)).resolves.toEqual({
      ok: false,
      reason: 'algorithm_mismatch',
    });
  });
});

describe('RFC 0040 signed block roles', () => {
  it('rejects a role-only mutation after signing', async () => {
    const { signing, verifying } = await generateSigningKeyPair('ed25519', 'role-key');
    const block = await hashedBlock('debt_structure', { _role: 'senior', loan_amount: 100 });
    const signed = stampBlockSignature(block, await signBlock(block, signing));
    const store = new InMemoryKeyStore([verifying]);
    expect(await verifyBlockSignature(signed, store)).toMatchObject({ ok: true });
    expect(await verifyBlockSignature({ ...signed, content: { ...signed.content, _role: 'junior' } }, store))
      .toMatchObject({ ok: false, reason: 'content_hash_mismatch' });
  });
});

describe('a signed Format 3.0 document', () => {
  const SIGNING = resolve(__dirname, '../../../conformance/signing');
  const parsed = parseUWFile(readFileSync(resolve(SIGNING, 'blocks/01-signed-valid/deal.uwx.md'), 'utf8'));
  const property = parsed.sections['property'] as UWBlock;

  it('detects role tampering in a signed chain', async () => {
    const { signing, verifying } = await generateSigningKeyPair('ed25519', 'role-key');
    const block = makeBlock('property', { _role: 'primary', total_units: 100 }, { parent_hash: null });
    const hashed = { ...block, meta: { ...block.meta, integrity: { ...block.meta.integrity, content_hash: await computeBlockHash(block) } } };
    const signed = stampBlockSignature(hashed, await signBlock(hashed, signing));
    const file = makeFile({ property: signed });
    const options = { signatureVerifier: createBlockSignatureVerifier(new InMemoryKeyStore([verifying])) };
    expect((await verifyChain(file, options)).issues).toEqual([]);
    signed.content['_role'] = 'component';
    expect((await verifyChain(file, options)).issues.map(issue => issue.code)).toContain('INT-04');
  });

  it('verifies the conformance 01-signed-valid block', async () => {
    expect(parsed.frontmatter.uw_version).toBe('3.0');
    const store = await loadKeyStoreFile(resolve(SIGNING, 'keys/keystore.json'));
    await expect(verifyBlockSignature(property, store)).resolves.toEqual({
      ok: true,
      kid: 'uwmd-conformance-ed25519',
    });
  });

  it('signBlock with stampContentHash yields a block verifyChain accepts', async () => {
    const jwk = JSON.parse(readFileSync(resolve(SIGNING, 'keys/signer-private.jwk.json'), 'utf8'));
    const key = {
      kid: 'uwmd-conformance-ed25519',
      alg: 'ed25519' as const,
      privateKey: await importPrivateKey('ed25519', { jwk }),
    };
    const { content_hash: _hash, signature: _sig, ...integrity } = property.meta.integrity ?? {};
    const unsigned: UWBlock = { ...property, meta: { ...property.meta, integrity } };

    const signature = await signBlock(unsigned, key, { stampContentHash: true, signedAt: '2026-08-27T00:00:00Z' });
    const contentHash = await computeBlockHash(unsigned);
    expect(contentHash).toBe(property.meta.integrity?.content_hash);
    const signed = stampBlockSignature(unsigned, signature, contentHash);

    const store = await loadKeyStoreFile(resolve(SIGNING, 'keys/keystore.json'));
    const result = await verifyChain(
      { ...parsed, sections: { ...parsed.sections, property: signed } },
      { signatureVerifier: createBlockSignatureVerifier(store) },
    );
    expect(result.issues).toEqual([]);
    expect(result.signatures_verified).toBe(1);
    await expect(verifyBlockSignature(signed, store)).resolves.toMatchObject({ ok: true });
  });

  it('keeps the signature across a _meta-only (parent_hash) change', async () => {
    const store = await loadKeyStoreFile(resolve(SIGNING, 'keys/keystore.json'));
    const reRooted = { ...property, meta: { ...property.meta, integrity: { ...property.meta.integrity, parent_hash: 'b'.repeat(64) } } };
    await expect(verifyBlockSignature(reRooted, store)).resolves.toMatchObject({ ok: true });
  });
});
