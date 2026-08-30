import { describe, expect, it } from 'vitest';
import {
  MODULE_SIGNATURE_SCHEME,
  checkSignatureShape,
  moduleSigningPayload,
  verifyModuleSignature,
  type ModuleSignatureVerifier,
} from './module-signing.js';
import type { ModuleManifest, ModuleSignature } from './protocol.js';

// Core is crypto-free, so everything here is exercised against a stub verifier.
// The real algorithms have their own round-trip tests in `@uwmd/signing`; what
// this file pins is the taxonomy — which refusal a host is told about — which is
// the part the protocol actually fixes.

const MANIFEST: ModuleManifest = {
  manifest_version: '1',
  id: 'example.signing',
  name: 'Signing Example',
  version: '1.0.0',
  description: 'A minimal manifest.',
  authors: ['test-fixture'],
  license: 'MIT',
  requires_protocol: '>=1.0.0',
  requires_format: '>=1.0',
  requires_tier: 'tier-1-reader',
};

const SIGNATURE: ModuleSignature = {
  scheme: MODULE_SIGNATURE_SCHEME,
  alg: 'ed25519',
  kid: 'module-author-2026',
  sig: 'ZmFrZS1zaWduYXR1cmU',
  signed_at: '2026-08-27T00:00:00Z',
};

const signed: ModuleManifest = { ...MANIFEST, signature: SIGNATURE };

function stub(
  answer: { ok: true } | { ok: false; reason: 'unknown_kid' | 'bad_signature' | 'malformed' },
): ModuleSignatureVerifier {
  return { async verify() { return answer; } };
}

describe('moduleSigningPayload', () => {
  it('omits `signature` rather than nulling it', () => {
    expect(moduleSigningPayload(signed)).toBe(moduleSigningPayload(MANIFEST));
    expect(moduleSigningPayload(signed)).not.toContain('signature');
  });

  it('is key-order independent', () => {
    // Rebuild the same manifest with its keys inserted in reverse order; RFC
    // 8785 sorts, so the payload must be identical.
    const reordered = Object.fromEntries(
      Object.entries(MANIFEST).reverse(),
    ) as unknown as ModuleManifest;
    expect(moduleSigningPayload(reordered)).toBe(moduleSigningPayload(MANIFEST));
  });

  it('covers depends_on — redirecting a signed module must break the signature', () => {
    const redirected: ModuleManifest = {
      ...MANIFEST,
      depends_on: [{ id: 'attacker.module', version: '1.0.0' }],
    };
    expect(moduleSigningPayload(redirected)).not.toBe(moduleSigningPayload(MANIFEST));
  });
});

describe('checkSignatureShape', () => {
  it('accepts a well-formed signature', () => {
    expect(checkSignatureShape(SIGNATURE)).toBeNull();
  });

  it('accepts an optional identity claim', () => {
    expect(checkSignatureShape({ ...SIGNATURE, identity: 'modules@example.org' })).toBeNull();
  });

  const BAD: Array<[string, unknown, string]> = [
    ['a non-object', 'nope', 'PROTO-MOD-070'],
    ['an unimplemented scheme', { ...SIGNATURE, scheme: 'sigstore' }, 'PROTO-MOD-069'],
    ['an unadmitted algorithm', { ...SIGNATURE, alg: 'rs256' }, 'PROTO-MOD-070'],
    ['an empty kid', { ...SIGNATURE, kid: '' }, 'PROTO-MOD-070'],
    ['a missing signed_at', { scheme: MODULE_SIGNATURE_SCHEME, alg: 'ed25519', kid: 'k', sig: 'x' }, 'PROTO-MOD-070'],
    ['a non-string identity', { ...SIGNATURE, identity: 42 }, 'PROTO-MOD-070'],
    ['an unknown key', { ...SIGNATURE, rekor_log_id: 'x' }, 'PROTO-MOD-070'],
  ];

  it.each(BAD)('refuses %s', (_label, value, code) => {
    expect(checkSignatureShape(value)?.error.code).toBe(code);
  });
});

describe('verifyModuleSignature', () => {
  it('separates `missing` from every kind of failure', async () => {
    const result = await verifyModuleSignature(MANIFEST, { verifier: stub({ ok: true }) });
    expect(result).toMatchObject({ ok: false, reason: 'missing' });
  });

  it('reports `unknown_key` when the host has no backend, not a bare success', async () => {
    const result = await verifyModuleSignature(signed);
    expect(result).toMatchObject({ ok: false, reason: 'unknown_key' });
  });

  it('maps unknown_kid to `unknown_key` and bad_signature to `invalid`', async () => {
    await expect(
      verifyModuleSignature(signed, { verifier: stub({ ok: false, reason: 'unknown_kid' }) }),
    ).resolves.toMatchObject({ reason: 'unknown_key' });
    await expect(
      verifyModuleSignature(signed, { verifier: stub({ ok: false, reason: 'bad_signature' }) }),
    ).resolves.toMatchObject({ reason: 'invalid' });
  });

  it('refuses an unsupported scheme before consulting the verifier', async () => {
    const sigstore = {
      ...MANIFEST,
      signature: { ...SIGNATURE, scheme: 'sigstore' },
    } as unknown as ModuleManifest;
    const result = await verifyModuleSignature(sigstore, {
      verifier: stub({ ok: false, reason: 'bad_signature' }),
    });
    expect(result).toMatchObject({ ok: false, reason: 'unsupported_scheme' });
  });

  it('carries a remediation on every refusal', async () => {
    const result = await verifyModuleSignature(MANIFEST);
    expect(result.ok === false && result.error.remediation).toBeTruthy();
    expect(result.ok === false && result.error.pointer).toBe('signature');
  });

  it('enforces an identity allow-list only after the signature verifies', async () => {
    const withIdentity: ModuleManifest = {
      ...MANIFEST,
      signature: { ...SIGNATURE, identity: 'stranger@example.net' },
    };
    await expect(
      verifyModuleSignature(withIdentity, {
        verifier: stub({ ok: true }),
        allowedIdentities: ['modules@example.org'],
      }),
    ).resolves.toMatchObject({ ok: false, reason: 'invalid' });

    await expect(
      verifyModuleSignature(withIdentity, {
        verifier: stub({ ok: true }),
        allowedIdentities: ['stranger@example.net'],
      }),
    ).resolves.toMatchObject({ ok: true, identity: 'stranger@example.net' });
  });

  it('refuses a signature with no identity when an allow-list is set', async () => {
    await expect(
      verifyModuleSignature(signed, {
        verifier: stub({ ok: true }),
        allowedIdentities: ['modules@example.org'],
      }),
    ).resolves.toMatchObject({ ok: false, reason: 'invalid' });
  });
});
