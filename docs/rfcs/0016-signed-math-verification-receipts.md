---
rfc: 0016
title: Signed deterministic math verification receipts
status: accepted
author: jaredmaxey
created: 2026-07-28
accepted: 2026-07-28
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0016: Signed deterministic math verification receipts

## Summary

Define a portable receipt proving that an identified verifier evaluated a
specific underwriting document with a specific deterministic calculation pack
and that the signed content has not changed. The receipt verifies:

1. signed content is unchanged; and
2. outputs are mathematically consistent with the stated inputs, pack, and
   policy.

It does **not** prove that stated inputs are true, complete, or supported by
source documents. A hash alone is insufficient because anyone can change inputs,
recalculate incorrect-but-consistent results, and create a new hash. Trust comes
from a signature over the complete verification statement and an independently
distributed public key.

Tracked by GitHub issue #8; implementation is decomposed in #13 and #15.

## Motivation

There are three separate assurance questions:

| Claim | Receipt verifies? | Mechanism |
|---|---:|---|
| Signed content has not changed | Yes | Canonical digests and signature |
| Math follows stated inputs/rules | Yes | Deterministic recomputation |
| Inputs reflect reality | No | Provenance, attestations, or audit |

Conflating the third claim with the first two would make the badge misleading.

## Proposed change

### Signed statement

The signed payload is RFC 8785 canonical JSON:

```ts
interface UWVerificationStatementV1 {
  receipt_version: "1.0";
  subject: {
    representation: "uw-lite-markdown" | "uwx-markdown" | "uw-envelope";
    representation_version: string;
    semantic_format_version: string;
  };
  canonicalization: { id: string; version: string };
  digests: {
    document: string;
    financial: string;
    inputs: string;
    model: string;
    results: string;
    validation_report: string;
  };
  calculation: {
    pack_id: string;
    pack_version: string;
    pack_digest: string;
    policy_id: string;
    policy_version: string;
  };
  checks: Array<{
    id: string;
    status: "pass" | "warning" | "fail";
    details_digest?: string;
  }>;
  result: "verified" | "verified_with_warnings" | "failed";
  verified_at: string;
  verifier: {
    id: string;
    implementation: string;
    implementation_version: string;
  };
}

interface UWSignedVerificationReceiptV1 {
  statement: UWVerificationStatementV1;
  signature: {
    version: "1.0";
    algorithm: "Ed25519";
    key_id: string;
    signed_at: string;
    value: string;
  };
}
```

Digests use `sha256:<lowercase hex>` in v1. The Ed25519 signature covers the
canonical UTF-8 bytes of `statement`; the signature object is excluded. The
signed schema is strict so display metadata cannot silently alter its meaning.

### Digest scopes

- `document` covers all meaningful recognized content, including narrative.
- `financial` covers stated inputs, units, periods, scenarios, formulas,
  compiled model, deterministic results, pack, and policy.
- `inputs`, `model`, `results`, and `validation_report` make mismatches
  explainable and prevent component substitution.

The financial digest comes from structured canonical data, never from
multiplying or concatenating digits in Markdown. Formatting does not change
identity and unrelated numbers in prose do not accidentally enter the model.

Changing inputs and recalculating can create consistent new local digests, but
cannot reproduce an approved verifier's signature.

### Verification procedure

A verifier MUST:

1. parse with the declared parser/canonicalizer;
2. compile Lite and reject unresolved financial ambiguity;
3. validate the model and inputs;
4. select the exact declared pack and policy;
5. recompute results with the deterministic engine;
6. compare every digest;
7. validate signature, key purpose, trust, validity, and revocation;
8. return a structured status without modifying the source.

An approved signing service MUST independently perform steps 1-6. It MUST NOT
sign client-supplied hashes or results without recomputation. Private approval
keys MUST NOT ship in browser, desktop, CLI, or editor bundles.

### Trust model

Version 1 uses Ed25519. A trust store maps `key_id` to public key, verifier,
purpose, validity interval, and revocation data. Trust stores are distributed
separately so an attacker cannot replace a receipt and its authority in one
file. Official tools may pin a project root; organizations may configure roots.

Local/self-signed receipts can be cryptographically valid but remain untrusted
until their keys are explicitly trusted. Rotation creates a new key ID.
Revocation policy determines treatment of historical signatures.

### Receipt placement

Lite embeds a receipt in a reserved HTML-comment block. UWX uses a reserved
envelope extension. Detached `.uw.verify.json` receipts are also supported.
The active receipt is excluded from document/financial canonicalization to avoid
self-reference. Superseded receipts remain append-only history or detached.

RFC 0010 signed blocks remain separate: they concern individual UWX blocks,
whereas this receipt signs a whole verification statement and does not assert
authorship of every input.

### Status and display

Verification returns `verified`, `verified_with_warnings`, `modified`,
`math_mismatch`, `untrusted_verifier`, `revoked_key`, `unsupported`,
`unverified`, or `invalid`.

A positive trusted badge is forbidden for `untrusted_verifier`. Consistent
unsigned math may say `math passes locally ? not signed`. Recommended positive
copy is:

> Math verified against stated inputs; signed content unchanged. Inputs are
> user-supplied and not independently validated.

If narrative changes while financial identity remains equal, tools may say
`financial verification valid; document text changed` only when both scopes
were signed and the distinction is prominent.

### Threat matrix

| Change or attack | Required outcome |
|---|---|
| Change a displayed result | `modified` or `math_mismatch` |
| Change an input only | `modified`; recomputation differs |
| Change input and correctly recalculate | Signature fails |
| Recompute all hashes locally | Signature fails or verifier untrusted |
| Substitute pack or policy | Digest/signature/support failure |
| Replace receipt and embedded public key | `untrusted_verifier` |
| Use revoked/expired key | Policy-specific revoked/invalid result |
| Supported presentation-only reformat | Financial scope remains equal |
| Change narrative only | Document changes; financial may remain equal |

The scheme cannot stop an approved verifier from signing bad but internally
consistent inputs. Authorization, audit logs, provenance, and review address
that separate risk.

### Input-truth extensions

Future evidence can bind source-document digests per input, human/organization
attestations, dual-control approval, extraction reports, or data-provider
signatures. These are additive and must not overload `verified` to mean audited
or true.

## Compatibility analysis

- Receipts are optional and do not change calculations.
- Older readers preserve or ignore the reserved receipt container.
- Meaningful edits make a receipt stale; editors preserve it as history or
  replace it only after new approved verification.
- Offline verification works when trust store, canonicalizer, pack, and policy
  are installed.
- Hosted signing adds availability/governance dependencies but protects keys.
- Unsigned deterministic math checking remains available and clearly labeled.

## Conformance impact

Fixtures cover canonical bytes, component digests, signatures, embedded and
detached receipts, formatting versus semantic edits, every status and threat
row, key rotation/revocation, unsupported pack/policy/canonicalizer, validation
warnings/defaults/ambiguity, prose-only changes, and rejection of forged
client-supplied digests. Cross-runtime implementations reproduce the same bytes,
digests, and signature results.

## Reference implementation

Core adds browser-safe canonicalization and verification, typed errors, strict
schemas, and trust stores. Node may add signing primitives, but production
approval signing is a separate protected service.

```text
uwmd verify <file> [--trust-store <file>] [--json]
uwmd math-check <file> [--json]
uwmd receipt attach <file> <receipt> [--out <file>]
```

The viewer/editor shows scope, verifier, time, pack, policy, warnings, and the
input-truth disclaimer; never an unqualified checkmark.

## Alternatives considered

A raw Markdown hash treats formatting as semantic and is freely recomputable.
Combining every number ignores field meaning, units, omissions, and policy.
Signing only the final result permits component substitution. Shipping an
approval secret lets anyone mint stamps. Claiming verified inputs confuses
mathematical consistency with evidence. The accepted statement and signature
bind all relevant components while keeping input truth separate.

## Decisions recorded

On 2026-07-28, the owner accepted receipts that attest to integrity and
deterministic mathematical consistency, with an explicit input-truth boundary.
The approved-editor flow uses independent recomputation and public-key
signatures rather than a self-generated hash stamp.
