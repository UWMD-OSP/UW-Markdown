import { describe, expect, it } from 'vitest';
import {
  createModuleRegistryAsync,
  loadModuleManifest,
  loadModuleManifestAsync,
  moduleSigningPayload,
  verifyModuleSignature,
  type ModuleManifest,
} from '@uwmd/core';
import { generateSigningKeyPair, InMemoryKeyStore } from './keys.js';
import { createModuleSignatureVerifier, signModule, stampModuleSignature } from './modules.js';

const MANIFEST: ModuleManifest = {
  manifest_version: '1',
  id: 'example.signing',
  name: 'Signing Example',
  version: '1.0.0',
  description: 'A minimal manifest used to exercise module signatures.',
  authors: ['test-fixture'],
  license: 'MIT',
  requires_protocol: '>=1.0.0',
  requires_format: '>=1.0',
  requires_tier: 'tier-1-reader',
};

async function signedFixture(identity?: string) {
  const { signing, verifying } = await generateSigningKeyPair('ed25519', 'module-author-2026');
  const signature = await signModule(MANIFEST, signing, {
    signedAt: '2026-08-27T00:00:00Z',
    ...(identity !== undefined ? { identity } : {}),
  });
  return {
    manifest: stampModuleSignature(MANIFEST, signature),
    store: new InMemoryKeyStore([verifying]),
    signing,
  };
}

describe('moduleSigningPayload', () => {
  it('omits the signature, so signing then verifying sees identical bytes', async () => {
    const { manifest } = await signedFixture();
    expect(moduleSigningPayload(manifest)).toBe(moduleSigningPayload(MANIFEST));
  });

  it('changes when any manifest field changes', () => {
    const tampered = { ...MANIFEST, description: 'Tampered after signing.' };
    expect(moduleSigningPayload(tampered)).not.toBe(moduleSigningPayload(MANIFEST));
  });
});

describe('verifyModuleSignature', () => {
  it('verifies a signed manifest against the host key store', async () => {
    const { manifest, store } = await signedFixture();
    await expect(
      verifyModuleSignature(manifest, { verifier: createModuleSignatureVerifier(store) }),
    ).resolves.toEqual({ ok: true, kid: 'module-author-2026' });
  });

  it('returns the identity claim when one was embedded', async () => {
    const { manifest, store } = await signedFixture('modules@example.org');
    await expect(
      verifyModuleSignature(manifest, { verifier: createModuleSignatureVerifier(store) }),
    ).resolves.toEqual({ ok: true, kid: 'module-author-2026', identity: 'modules@example.org' });
  });

  it('reports `missing` for an unsigned manifest, distinct from a bad one', async () => {
    const result = await verifyModuleSignature(MANIFEST);
    expect(result).toMatchObject({ ok: false, reason: 'missing' });
    expect(result.ok === false && result.error.code).toBe('PROTO-MOD-068');
  });

  it('reports `unknown_key` when the host has no backend at all', async () => {
    const { manifest } = await signedFixture();
    const result = await verifyModuleSignature(manifest);
    expect(result).toMatchObject({ ok: false, reason: 'unknown_key' });
  });

  it('reports `unknown_key`, not `invalid`, for a kid the store lacks', async () => {
    const { manifest } = await signedFixture();
    const result = await verifyModuleSignature(manifest, {
      verifier: createModuleSignatureVerifier(new InMemoryKeyStore()),
    });
    expect(result).toMatchObject({ ok: false, reason: 'unknown_key' });
    expect(result.ok === false && result.error.code).toBe('PROTO-MOD-071');
  });

  it('reports `invalid` when the manifest changed after signing', async () => {
    const { manifest, store } = await signedFixture();
    // A validation flipped from error to warning is exactly the attack RFC 0002
    // names. Tamper with a field that stays structurally valid, so the refusal
    // can only come from the signature.
    const tampered = { ...manifest, description: 'Tampered after signing.' };
    const result = await verifyModuleSignature(tampered, {
      verifier: createModuleSignatureVerifier(store),
    });
    expect(result).toMatchObject({ ok: false, reason: 'invalid' });
    expect(result.ok === false && result.error.code).toBe('PROTO-MOD-072');
  });

  it('reports `unsupported_scheme` for a scheme this host does not implement', async () => {
    const { manifest, store } = await signedFixture();
    const sigstore = {
      ...manifest,
      signature: { ...manifest.signature, scheme: 'sigstore' },
    } as unknown as ModuleManifest;
    const result = await verifyModuleSignature(sigstore, {
      verifier: createModuleSignatureVerifier(store),
    });
    expect(result).toMatchObject({ ok: false, reason: 'unsupported_scheme' });
  });

  it('refuses a valid signature whose identity is off the allow-list', async () => {
    const { manifest, store } = await signedFixture('stranger@example.net');
    const result = await verifyModuleSignature(manifest, {
      verifier: createModuleSignatureVerifier(store),
      allowedIdentities: ['modules@example.org'],
    });
    expect(result).toMatchObject({ ok: false, reason: 'invalid' });
  });
});

describe('load policies', () => {
  it('`ignore` loads a signed module without looking at the signature', async () => {
    const { manifest } = await signedFixture();
    const result = await loadModuleManifestAsync(manifest, {});
    expect(result.ok).toBe(true);
  });

  it('`verify-if-present` loads an unsigned module but refuses a broken signature', async () => {
    const { manifest, store } = await signedFixture();
    const verifier = createModuleSignatureVerifier(store);

    await expect(
      loadModuleManifestAsync(MANIFEST, { signaturePolicy: 'verify-if-present', signatureVerifier: verifier }),
    ).resolves.toMatchObject({ ok: true });

    const tampered = { ...manifest, description: 'Tampered after signing.' };
    const refused = await loadModuleManifestAsync(tampered, {
      signaturePolicy: 'verify-if-present',
      signatureVerifier: verifier,
    });
    expect(refused.ok).toBe(false);
    expect(refused.errors[0]?.code).toBe('PROTO-MOD-072');
  });

  it('`require` refuses an unsigned module', async () => {
    const { store } = await signedFixture();
    const result = await loadModuleManifestAsync(MANIFEST, {
      signaturePolicy: 'require',
      signatureVerifier: createModuleSignatureVerifier(store),
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('PROTO-MOD-068');
  });

  it('a checking policy with no verifier refuses every signed module', async () => {
    const { manifest } = await signedFixture();
    const result = await loadModuleManifestAsync(manifest, { signaturePolicy: 'require' });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('PROTO-MOD-071');
  });

  it('structural problems are reported as themselves, not as signature problems', async () => {
    const broken = { ...MANIFEST, version: 'not-semver' };
    const result = await loadModuleManifestAsync(broken, { signaturePolicy: 'require' });
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.code)).toContain('PROTO-MOD-004');
  });

  it('a malformed signature is refused even under `ignore`', () => {
    const broken = { ...MANIFEST, signature: { scheme: 'uwmd-keystore', alg: 'ed25519' } };
    const result = loadModuleManifest(broken);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe('PROTO-MOD-070');
  });

  it('createModuleRegistryAsync refuses the whole registry when one module fails policy', async () => {
    const { manifest, store } = await signedFixture();
    const tampered = {
      ...manifest,
      id: 'example.signing.tampered',
      description: 'Tampered after signing.',
    };
    await expect(
      createModuleRegistryAsync({
        modules: [manifest, tampered],
        signaturePolicy: 'require',
        signatureVerifier: createModuleSignatureVerifier(store),
      }),
    ).rejects.toThrow(/PROTO-MOD-072/);
  });

  it('createModuleRegistryAsync builds a registry when every module passes', async () => {
    const { manifest, store } = await signedFixture();
    const registry = await createModuleRegistryAsync({
      modules: [manifest],
      signaturePolicy: 'require',
      signatureVerifier: createModuleSignatureVerifier(store),
    });
    expect(registry.byId.get('example.signing')?.version).toBe('1.0.0');
  });
});
