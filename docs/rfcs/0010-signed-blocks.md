---
rfc: 0010
title: Signed blocks
status: draft
author: jaredmaxey
created: 2026-04-27
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0010: Signed blocks

## Summary

Add an optional `_meta.integrity.signature` field carrying a detached
cryptographic signature over a block's `content_hash`. Signing keys
are issued and verified out of band; the spec defines the wire format
of the signature (algorithm, key ID, signature bytes) but takes no
position on key distribution. Implementation lives in a separate
`@uwmd/signing` package so that the core library remains
zero-cryptography-dependency for users who don't need this. **Explicit
non-goal:** signed blocks are not the open-standard everyday case;
they exist for regulated lender deployments and similar workflows
where chain-of-custody must be cryptographically auditable.

## Motivation

After RFC 0009 lands and `_meta.integrity.content_hash` is widely
deployed, three classes of adopter ask the same question for different
reasons:

1. **Regulated lender data rooms.** A bank IT shop wants
   "non-repudiation": a third party reading the file later can confirm
   that block X was written by user Y at time T, and that no character
   has changed since. Hashes alone don't provide this — they're
   tamper-evident only against an unsigned reference. A signature over
   the hash, with a public key the verifier trusts, does.
2. **Multi-party deal flow.** Sponsor signs the rent roll, lender
   signs the term sheet, third-party appraiser signs the valuation.
   Each block's authorship is independently verifiable, even if the
   file is later reassembled by an aggregator.
3. **Agent-host accountability.** When `agent/L2` writes a block, a
   signature from the host's per-agent key proves it was THIS agent
   instance, not someone forging the `actor` field. POL-01 catches
   bad-actor writes against a policy table; a signature catches them
   even if the policy table itself is wrong.

Today there is no spec-defined way to carry a signature, so adopters
who need this either ship sidecar files (which fragment) or add
proprietary `_meta` fields (which break interop).

## Proposed change

### Wire format

`_meta.integrity.signature` (in v1.x flat shape: `_meta.signature`)
is a small object:

```ts
interface BlockSignature {
  /** Algorithm identifier per RFC 8032 / 7518 / Cose. */
  alg: 'ed25519' | 'es256' | 'es384';

  /** Opaque key identifier; the verifier looks this up in their key store. */
  kid: string;

  /** Base64url-encoded signature bytes. */
  sig: string;

  /** ISO 8601 timestamp when the signature was produced.
   *  MAY differ from _meta.timestamp (e.g. block edited offline,
   *  signed when re-uploaded). */
  signed_at: string;

  /** Optional version of the signing protocol. Defaults to "1". */
  v?: string;
}
```

### What is signed

The signature input is the canonicalized JSON of:

```jsonc
{
  "content_hash":  "<sha256 hex of canonicalized block content>",
  "section":       "<_meta.section>",
  "actor":         "<_meta.actor>",
  "timestamp":     "<_meta.timestamp>",
  "kid":           "<key id>",
  "signed_at":     "<signing timestamp>"
}
```

Canonicalization uses RFC 8785 (JCS) — same rule as `content_hash`.
Importantly, the signature does NOT cover `parent_hash` or
`field_overrides`; those can change in legitimate edits without
invalidating prior signatures up the chain. This is by design:
signing is per-block, chain integrity is the separate
`content_hash` / `parent_hash` mechanism.

### Verification

A new `@uwmd/signing` package exposes:

```ts
export interface SignerKey {
  kid: string;
  alg: 'ed25519' | 'es256' | 'es384';
  /** Public key in PKIX SPKI form. */
  publicKey: CryptoKey | Uint8Array;
}

export interface KeyStore {
  resolve(kid: string): Promise<SignerKey | null>;
}

export async function signBlock(
  block: ParsedBlock,
  privateKey: { kid: string; alg: string; key: CryptoKey | Uint8Array; signed_at?: string },
): Promise<BlockSignature>;

export async function verifyBlockSignature(
  block: ParsedBlock,
  store: KeyStore,
): Promise<{ ok: true; kid: string } | { ok: false; reason: SigVerifyError; kid?: string }>;

export type SigVerifyError =
  | 'unknown_kid'
  | 'algorithm_mismatch'
  | 'bad_signature'
  | 'content_hash_mismatch'
  | 'malformed';
```

Verification is opt-in. A verifier that doesn't have the public key
for a `kid` returns `unknown_kid`; the caller decides whether to
treat that as fatal.

### Validator additions

New error codes (registered in `BUILTIN_REMEDIATIONS`):

| Code | Severity | Trigger |
|---|---|---|
| `INT-05` | error | `signature` present but `content_hash` is absent. |
| `INT-06` | error | `signature.kid` references a key not in the supplied store and verification was requested. |
| `INT-07` | error | Signature does not verify against the canonicalized signing input. |
| `INT-08` | warning | Signature `alg` is in the deprecation list (set per release). |

INT-06 / INT-07 only fire when the validator is invoked with a
configured `KeyStore`. Default validation (no store) treats signed
blocks identically to unsigned blocks — the signature is opaque
metadata.

### CLI

`uwmd verify` gains:

```
uwmd verify <file> --signing --keystore=<path>
```

Where `--keystore` points at a JSON file mapping `kid` → public key.
A reference keystore format ships with `@uwmd/signing`; adopters
substitute their own (HSM, cloud KMS, in-memory).

## Compatibility analysis

- **Existing `.uw.md` files** — fully compatible. No file currently
  has `_meta.signature`. Validator default behavior treats it as
  opaque. Tier-1 readers do not parse the signature value.
- **Tier-1/2/3/4 implementations** — all unaffected by default. An
  implementation that wants to claim "signing-aware" support adds
  `signing` to its `ImplementationManifest.capabilities`.
- **`@uwmd/core`** — gains optional re-export of the
  `BlockSignature` type. Crypto code stays in `@uwmd/signing`.
- **Modules** — module manifests do not embed signatures; no
  breakage.

No deprecation path. Additive.

## Conformance impact

New optional Tier-2/Tier-1 fixtures (under
`conformance/tier-1-reader/signing-fixtures/`):

- `01-signed-valid/` — block carries valid `ed25519` signature; supply
  the corresponding public key in the fixture's `keystore.json`.
  Expected: `verifyBlockSignature` returns `{ ok: true }`.
- `02-signed-tampered/` — block content modified after signing.
  Expected: `INT-07`.
- `03-signed-unknown-kid/` — `kid` not in keystore. Expected:
  `INT-06`.
- `04-signed-but-no-hash/` — block has signature but no
  `content_hash`. Expected: `INT-05`.

These fixtures gate "signing-aware" capability claims; non-signing
implementations skip them.

## Reference implementation

- **Files affected:**
  - `packages/uwmd-signing/` (new package)
    - `src/sign.ts`, `src/verify.ts`, `src/canonicalize.ts` (re-export
      from `@uwmd/core/integrity-canonical`).
    - `src/keystore-file.ts` (file-based reference KeyStore).
  - `packages/uwmd-core/src/integrity.ts` — extend `IntegrityResult`
    with optional signature verification report.
  - `packages/uwmd-core/src/protocol.ts` — `BlockSignature` type, new
    INT-05..08 codes.
  - `packages/uwmd-core/src/cli.ts` — `verify --signing`.
  - `spec/UW_PROTOCOL_v1.md` — new §IX.6 "Block signatures."
- **API surface:** new package `@uwmd/signing` with `signBlock`,
  `verifyBlockSignature`, reference `KeyStore`. Core library exports
  the type only.
- **Test plan:** test vectors for ed25519 (RFC 8032 worked example)
  and ES256 (RFC 6979 deterministic-k vector). Property test: signing
  then verifying any random block returns `ok: true`. Round-trip:
  verify → mutate → re-verify → expected `INT-07`.

## Alternatives considered

1. **Sign the entire file, not per block.** A leading
   `_file_signature` block. Rejected — destroys per-block
   accountability. A multi-author file needs per-block signatures so
   that "sponsor signed rent roll" and "lender signed term sheet" are
   independently verifiable.

2. **Use COSE_Sign1 (RFC 9052) for the signature envelope.** More
   formal, fewer choices, more interop with IETF tooling. Rejected
   for now — adds a binary CBOR dependency for a feature most
   adopters won't use. The plain-JSON envelope above is simpler and
   the `alg` values are still RFC-aligned. Revisit if any adopter
   wants COSE.

3. **Inline public keys in the file.** Each block carries its own
   public key inline. Rejected — defeats key distribution; anyone can
   write a "signed" block with a key they own. Trust requires
   out-of-band key distribution.

4. **Sign `parent_hash` along with `content_hash`.** Stronger chain
   guarantee. Rejected — couples block-level and chain-level
   integrity in ways that break legitimate edit operations
   (re-rooting a chain after a merge would invalidate every prior
   signature). Keep them orthogonal.

5. **Use JSON Web Signatures (JWS) with detached payload.** Rejected
   — JWS overhead (header + base64 envelope) is large relative to
   the small object above, and we don't gain interop with anything
   in the CRE ecosystem by adopting it.

## Unresolved questions

- **Key rotation.** A `kid` MUST be globally unique within a
  keystore, but can the same logical signer rotate keys? Yes — emit
  new blocks with the new `kid`. Old blocks remain verifiable against
  the old `kid` so long as the keystore retains both. Spec wording
  needs to make this explicit.
- **Time-stamping authority.** `signed_at` is self-asserted by the
  signer. For audit-grade non-repudiation, a TSA countersignature is
  needed. Defer to a follow-up RFC; today's `signed_at` is best-effort.
- **Selective disclosure.** Can a signer sign a redacted block (for
  instance, signing the rent roll with one tenant's row redacted to
  the verifier)? The current design does not support this. Adding
  Merkle commitments to fields would. Defer to a future RFC if
  demand emerges.
- **Web Crypto vs. Node `crypto` parity.** Both must produce
  byte-identical signatures for the same key + payload. ed25519 is
  in both stable APIs as of 2025; ES256 likewise. No issue expected,
  but the test suite gates parity explicitly.

## Prior art

- **Sigstore** ([sigstore.dev](https://www.sigstore.dev)) — keyless
  signing flow over short-lived certs. Out of scope for this RFC but
  natural follow-on for non-enterprise adopters who don't want to
  manage their own keystore.
- **CycloneDX SBOM signing** — uses JSF (JSON Signature Format) with a
  similar shape. We diverge by canonicalizing via JCS rather than JSF
  for consistency with our existing `content_hash` rule.
- **PASETO v4** — paseto.io. Strong opinionated choices on algorithm
  selection; we steal the `alg` = `ed25519 | es256` shortlist.
- **OpenPGP / S/MIME** — the historical precedents. Too heavy and
  too email-shaped for our use case.
