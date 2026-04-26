---
rfc: 0002
title: Module signing
status: draft
author: jaredmaxey
created: 2026-04-26
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0002: Module signing

## Summary

Modules extend the standard with new sections, calculations, validations,
view models, and agent layers. A malicious or accidentally corrupted
module manifest can therefore inject calculations or validations into a
host's pipeline. This RFC proposes a Sigstore-style signature on module
manifests, verified by the host according to its policy. Signatures are
**advisory** at the protocol level — what to do with an unsigned or
invalid-signature module is a host-policy decision, not a normative
requirement.

## Motivation

Today, [`ModuleManifest`](../../packages/uwmd-core/src/protocol.ts) carries
no integrity surface. A host that loads a module manifest from disk, npm,
or a URL has no built-in way to:

1. **Verify the module is unmodified** since the author published it.
2. **Verify the publisher** is who the module claims (`authors: [...]`).
3. **Make a policy decision** about whether to load it.

For a CRE underwriting host running modules from third-party authors, this
is a real risk: a tampered module could declare a `validations` rule that
silently flips a deal from "blocking" to "warning," or inject a calculation
whose `formula` reads sensitive frontmatter and writes it into a derived
value that gets surfaced to the user.

The point of this RFC is not to *enforce* signatures — that's a host
decision — but to give hosts a standard *surface* to verify against, so
two conforming hosts agree on what "signature valid" means.

## Proposed change

### Protocol spec — Part X (Module System)

Add an optional `signature` block to `ModuleManifest`:

```ts
export interface ModuleSignature {
  /** Signing scheme. v2 ships with 'sigstore' only. */
  scheme: 'sigstore';
  /** Base64-encoded signature over the canonical manifest bytes. */
  signature: string;
  /** PEM-encoded signing certificate (Sigstore-issued, OIDC-bound). */
  certificate: string;
  /** Sigstore Rekor transparency log entry ID. */
  rekor_log_id: string;
  /** Identity claim (OIDC subject) the signer authenticated as. */
  identity: string;
  /** Issuer of the OIDC token (e.g., 'https://accounts.google.com'). */
  issuer: string;
}

export interface ModuleManifest {
  // ... existing fields
  signature?: ModuleSignature;
}
```

Canonical manifest bytes for signing = the manifest serialized with
`signature` field omitted, JSON Canonical Form (RFC 8785).

### Verification

Add `verifyModuleSignature(manifest, options)` to `@uwmd/core`:

```ts
export interface VerifyOptions {
  /** Trust roots for the Sigstore Fulcio CA. Defaults to the public Sigstore root. */
  trust_root?: TrustRoot;
  /** Maximum age of the Rekor entry. Defaults to no limit. */
  max_age_seconds?: number;
}

export interface VerifyResult {
  ok: boolean;
  /** Populated when ok=false. */
  error?: ProtocolError;
  /** Verified identity claims when ok=true. */
  identity?: { subject: string; issuer: string; rekor_log_id: string };
}

export function verifyModuleSignature(
  manifest: ModuleManifest,
  options?: VerifyOptions,
): Promise<VerifyResult>;
```

The function:
1. Strips `signature` from the manifest, computes JSON Canonical Form.
2. Verifies the signature against the certificate.
3. Verifies the certificate chains to a Sigstore Fulcio root.
4. Verifies the Rekor inclusion proof.
5. Returns `ok: true` with identity claims, or `ok: false` with a `ProtocolError` carrying one of: `MOD-SIG-INVALID`, `MOD-SIG-CHAIN`, `MOD-SIG-REKOR`, `MOD-SIG-CANON`.

### Host policy

The protocol does **not** mandate that hosts verify. It mandates:

> A host that claims to verify module signatures **MUST** invoke
> `verifyModuleSignature` (or an equivalent that produces identical
> verdicts) and **MUST NOT** load a module whose signature fails
> verification under the host's declared policy.

A host's `ImplementationManifest.capabilities` gains the optional
`module-signature-verification` capability. Hosts that declare it must
honor the verification semantics.

## Compatibility analysis

- **Existing `.uw.md` files** — no impact (modules are referenced from frontmatter; the file content does not change).
- **Existing module manifests** — backwards compatible. Manifests without a `signature` field continue to load. A host's policy decides whether unsigned modules are allowed.
- **Existing implementers** — no behavior change unless they opt into signature verification. Tier-3 calc hosts and Tier-4 agent hosts that load modules can adopt incrementally.
- **Module authors** — adding a signature is opt-in. The publishing tooling (a future `uwmd module sign` subcommand, separate RFC) handles the OIDC flow and signature attachment.

No deprecation path required — purely additive.

## Conformance impact

New fixtures in `conformance/tier-3-calc-host/fixtures/`:
- `module-signed-valid/` — a real Sigstore-signed manifest, expected `verifyModuleSignature` returns `ok: true`.
- `module-signed-tampered/` — same manifest with one byte flipped, expected `MOD-SIG-INVALID`.
- `module-signed-expired-cert/` — signature whose cert is past Sigstore's short-lived window, expected `MOD-SIG-CHAIN`.
- `module-unsigned/` — manifest with no `signature` field, expected `verifyModuleSignature` returns `ok: false` with code `MOD-SIG-MISSING` (so hosts can distinguish "no signature" from "bad signature").

Existing module fixtures continue to load (they're unsigned; the calc-host
tier doesn't require verification).

## Reference implementation

- **Files affected:**
  - `packages/uwmd-core/src/protocol.ts` — `ModuleSignature` type, extend `ModuleManifest`.
  - `packages/uwmd-core/src/module-signing.ts` (new) — `verifyModuleSignature`.
  - `spec/schemas/module-manifest.schema.json` — additive `signature` field.
  - `spec/schemas/module-signature.schema.json` (new) — normative shape.
  - `spec/UW_PROTOCOL_v1.md` — Part X signing subsection.
- **Dependencies:** `@sigstore/verify` and `@sigstore/protobuf-specs` (Node ESM). Browser support deferred — `verifyModuleSignature` runs server-side in v2.
- **API surface:** `verifyModuleSignature(manifest, options)`, types `ModuleSignature` / `VerifyOptions` / `VerifyResult`.
- **Test plan:** ship a fixture-signed manifest; assert verification round-trips. Negative tests for each error code. CI uses Sigstore's mock identity provider.

## Alternatives considered

1. **PGP signatures.** Rejected — PGP key management is the reason most projects are *abandoning* PGP. Sigstore's keyless flow eliminates the long-lived-key footgun.

2. **Detached signature file (`.sig`).** Rejected — couples the signature to a delivery channel (filesystem) and complicates verification when manifests travel through registries that don't ship sidecar files.

3. **Cosign-style OCI artifact signing only.** Rejected as the *only* path — works for modules distributed as container images, breaks for modules distributed as plain `.json`. Sigstore's bundle format covers both.

4. **In-band signature using JWS.** Considered. The tradeoff is JWS produces a self-contained token but loses the Rekor transparency log. Sigstore bundles include both, so we get the JWS-style self-containment plus public auditability.

5. **Make verification mandatory.** Rejected — would lock out air-gapped hosts and increase the conformance bar in a way unrelated to the rest of the protocol. Verification is a *capability*, not a tier requirement.

## Unresolved questions

- **Sigstore root rotation.** Sigstore's trust root changes over time. Should `@uwmd/core` ship a vendored root snapshot, or fetch it at verify-time? Recommend vendored snapshot with a release-cycle update cadence.
- **Identity policy.** Hosts likely want to allow only signatures from specific identities (e.g., `*@uwmd.org`). The `VerifyOptions` surface should grow an `allowed_identities: string[]` regex/glob list. Out of scope for this RFC; lands in a follow-up host-policy RFC.
- **Browser support.** Sigstore verification in the browser is feasible but heavyweight (~500 kB bundle). Recommend deferring browser-side verification until a smaller verifier is available; until then, browser hosts that need verification do it server-side and pass the verdict in.
- **Module dependency signing.** A module's `depends_on` list points at other modules. Should the host transitively verify all dependencies? Recommend yes, but the policy logic is a host decision; the protocol gives the verifier, not the policy engine.

## Prior art

- **Sigstore** ([sigstore.dev](https://www.sigstore.dev)) — keyless code signing with transparency log. The model this RFC adopts.
- **npm provenance** — already integrated with Sigstore for `@uwmd/core` releases (`.github/workflows/release.yml`). This RFC extends the same model to *module manifests*.
- **PEP 740** (Python Package Index attestations) — same model adapted for PyPI.
- **OCI 1.1 signatures** (Cosign) — sibling tool from the same project; relevant if a future RFC ships modules as OCI artifacts.
- **JOSE / JWS** — the in-band-signing alternative considered above.
