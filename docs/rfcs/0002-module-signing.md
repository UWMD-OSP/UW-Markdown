---
rfc: 0002
title: Module signing
status: implemented
author: jaredmaxey
created: 2026-04-26
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0002: Module signing

> **Design change, 2026-08-27 — the shipped scheme is not Sigstore.**
> Everything below the "Proposed change" heading describes a Sigstore-based
> design. It is preserved as written, because it is still the right long-term
> target and the motivation section is unchanged. What shipped is a
> `uwmd-keystore` scheme built on RFC 0010's machinery, for reasons set out
> in [Why not Sigstore, yet](#why-not-sigstore-yet). The `scheme`
> discriminator was added precisely so that adding `sigstore` later is
> additive rather than breaking.

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

## Why not Sigstore, yet

RFC 0010 shipped on 2026-08-27, three days before this one, and changed
what the cheap option is.

Sigstore verification needs a Fulcio trust root and a Rekor inclusion
proof. That means one of two things, and both are bad here:

1. **A vendored root snapshot.** Sigstore's trust root rotates. A
   snapshot in `@uwmd/core` is a standing obligation to ship a release
   on somebody else's cadence, and a stale snapshot fails *closed* —
   every signed module suddenly unverifiable, for a reason nothing in
   this repo caused.
2. **Fetching at verify time.** A protocol whose stated non-goals
   include network transport (§I.2) would acquire a network dependency
   in its module loader, and the conformance corpus — offline and
   deterministic by construction — could not express a single fixture.

Against that, `@uwmd/signing` already existed, with a key store, three
algorithms, and a canonicalization the whole project shares. Signing a
manifest with it is the same act as signing a block, over different
bytes. The result is offline, deterministic, fixture-able, and reuses a
verifier that already has conformance coverage.

What is genuinely lost is Sigstore's two real advantages: keyless
signing (no long-lived key for an author to manage or leak) and public
transparency (a log anyone can audit). Those are worth having, and
§X.1.2 reserves `scheme: "sigstore"` for them. This RFC's judgment is
that a working keystore scheme now beats a Sigstore scheme that either
never ships or ships with a trust-root maintenance burden nobody has
signed up for.

The other four alternatives below are unaffected — PGP, sidecar `.sig`
files, OCI-only signing, and JWS are all still rejected, for the reasons
given.

## Implementation notes (deviations from the proposal)

Shipped 2026-08-27, on top of RFC 0010.

1. **Scheme is `uwmd-keystore`, not `sigstore`** — see above. The
   `ModuleSignature` shape is correspondingly the §V.11 block-signature
   shape (`alg` / `kid` / `sig` / `signed_at`) plus `scheme` and an
   optional `identity`, rather than the certificate / Rekor fields
   proposed above.
2. **Error codes continue the `PROTO-MOD-NNN` sequence** —
   `PROTO-MOD-068` through `072` — rather than opening a `MOD-SIG-*`
   namespace. Every other module error in this repo is `PROTO-MOD-NNN`,
   and a second namespace for one feature would be a taxonomy split with
   nothing behind it. The *distinctions* the RFC asked for all survive,
   including the one it was most right about: `missing` is its own code,
   so a host can tell "unsigned" from "bad signature".
3. **`unknown_key` is one verdict covering two situations** — the host's
   store lacks the `kid`, *and* the host has no signature backend at
   all. Both mean "this host cannot establish anything about this
   module", and both must refuse under a checking policy. Splitting them
   would offer a distinction no host can act on differently.
4. **Host policy is a named enum on the loader**, not left entirely to
   the host: `ignore` / `verify-if-present` / `require`, with
   `loadModuleManifestAsync` and `createModuleRegistryAsync` as the
   async siblings (verification needs Web Crypto; the sync loaders are
   untouched and pay nothing). The RFC's substance is intact — the
   protocol still mandates no policy — but naming the three that exist
   in practice keeps two hosts from inventing incompatible spellings of
   the same three.
5. **`identity` is explicitly advisory**, with §X.1.5 saying so in
   normative text. The RFC deferred identity policy to a follow-up; what
   shipped is the `allowedIdentities` allow-list it sketched, plus the
   caveat that matters more than the feature: a signature proves the key
   holder *asserted* an identity, never that the assertion is true.
6. **Fixtures live in `conformance/signing/modules/`**, not
   `conformance/tier-3-calc-host/fixtures/`. Module signing is not a
   tier-3 capability — a Tier-1 reader that loads modules has the same
   problem — and the fixtures share RFC 0010's test key, because a host
   that trusts a signer trusts them for both artifact kinds. Six
   scenarios, each run under **all three policies** rather than only the
   interesting one: `04-unsigned` loading under `verify-if-present` and
   refusing under `require` is the entire policy distinction, and
   asserting one half would let the two collapse unnoticed.
7. **A malformed signature is refused under `ignore` too.** Declining to
   *verify* is not a licence to admit a malformed object into a frozen
   manifest that other code will read.

## Prior art

- **Sigstore** ([sigstore.dev](https://www.sigstore.dev)) — keyless code signing with transparency log. The model this RFC adopts.
- **npm provenance** — already integrated with Sigstore for `@uwmd/core` releases (`.github/workflows/release.yml`). This RFC extends the same model to *module manifests*.
- **PEP 740** (Python Package Index attestations) — same model adapted for PyPI.
- **OCI 1.1 signatures** (Cosign) — sibling tool from the same project; relevant if a future RFC ships modules as OCI artifacts.
- **JOSE / JWS** — the in-band-signing alternative considered above.
