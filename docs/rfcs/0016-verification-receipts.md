---
rfc: 0016
title: Define signed deterministic verification receipts
status: accepted
author: jaredmaxey
created: 2026-08-08
accepted: 2026-08-09
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0016: Define signed deterministic verification receipts

## Summary

Define a **verification receipt**: a small, detached JSON document that states
which underwriting record was checked, which deterministic calculation pack ran
against it, what that pack produced, and which policy set was applied — bound to
the record by a canonical digest and optionally signed. A receipt lets a party
who did not run the calculation confirm, offline and without the original tool,
that a stated set of numbers follows deterministically from a stated set of
inputs. It deliberately attests **nothing about whether those inputs are true**.
`spec/UW_LITE_SPEC_v1.md` §9 already normatively references this RFC; this
document supplies the definition that reference depends on.

## Motivation

Three concrete gaps exist today.

**1. A normative dangling reference.** `spec/UW_LITE_SPEC_v1.md` §9 says
"Receipts follow RFC 0016," and §5 says "A document with parsing errors cannot
receive a financial canonical digest or a trusted verification receipt." Until
now there was no RFC 0016. A published normative spec pointed at a document that
did not exist, so "trusted verification receipt" had no defined meaning and no
two implementers could agree on one.

**2. The digest exists but nothing consumes it.** `canonicalizeUWLiteFinancial`
(`packages/uwmd-core/src/lite.ts`) already emits an RFC 8785 canonical form, and
`conformance/lite/expected/*.digest.txt` already freezes SHA-256 digests over its
exact bytes. That machinery proves *a document's financial content is unchanged*,
but nothing binds it to *the calculation results derived from it*. A recipient
can verify the inputs are untampered, or trust the sender's numbers, but cannot
verify the numbers follow from the inputs.

**3. The assurance boundary is stated in prose, not enforced.** The repo's
central invariant is that AI never does financial math — `calc/` and `packs/` do,
deterministically, with Excel parity to six decimals. That determinism is exactly
what makes a receipt possible: the same pack over the same canonical inputs must
produce the same outputs on any conforming implementation. But without a defined
receipt, that guarantee stays internal. Adopters in lending and investment
committee workflows are being asked to trust a number because a tool produced it,
which is precisely the posture UW Markdown exists to replace.

This RFC is **not** RFC 0010. RFC 0010 (signed blocks) attests *authorship and
non-tampering of a block* — who wrote it, unchanged since. A receipt attests
*correctness of a computation over a whole record* — these outputs follow from
these inputs under this pack. The two compose but answer different questions, and
neither substitutes for the other.

## Proposed change

### The receipt object

A receipt is a standalone JSON document, **not** embedded in the underwriting
record. Detachment is deliberate: embedding would violate the Tier-2
byte-preservation invariant, would make the record's own digest depend on a value
derived from that digest, and would prevent a third party from issuing a receipt
about a record they must not modify.

```json
{
  "receipt_version": "1.0",
  "subject": {
    "representation": "uw-lite-markdown",
    "representation_version": "1.0",
    "canonicalization": "uw-lite-financial",
    "canonicalization_version": "1.0",
    "digest": "sha256:f930ebf20c9b0cc1159b65cc653f50a728fa07858080be5f6592ab307953d216"
  },
  "computation": {
    "pack": "multifamily",
    "pack_version": "1.0.0",
    "engine": "@uwmd/core",
    "engine_version": "1.1.2",
    "results": [
      { "calc_id": "dscr", "value": 1.2825, "unit": "ratio" },
      { "calc_id": "ltv", "value": 0.6, "unit": "fraction" }
    ],
    "results_digest": "sha256:..."
  },
  "policy": {
    "policy_set": "builtin",
    "policy_set_version": "1.0",
    "validation": { "errors": 0, "warnings": 2 }
  },
  "issued_at": "2026-08-08T00:00:00Z",
  "issuer": "uwmd-cli@1.1.2",
  "signature": null
}
```

`signature`, when present, uses the same wire shape RFC 0010 defines for block
signatures (`algorithm`, `key_id`, `value`) and covers the RFC 8785
canonicalization of the receipt with `signature` set to `null`. Key distribution
stays out of scope, exactly as in RFC 0010.

### Normative rules

- An issuer **MUST NOT** emit a receipt for a document whose parse produced any
  `error`-severity issue. This extends the existing Lite §5 refusal to every
  representation.
- An issuer **MUST** bind `subject.digest` to the canonical form named by
  `subject.canonicalization`, computed as SHA-256 over its exact UTF-8 bytes and
  serialized as `sha256:<lowercase hex>`.
- `computation.results` **MUST** contain every calc the named pack declares as an
  output, and **MUST NOT** contain any value the pack did not compute. A receipt
  is not a place to carry hand-entered numbers.
- A verifier **MUST** report exactly one of three states, and **MUST NOT**
  collapse the third into either of the others:
  - `verified` — digest matches, recomputation reproduces every stated result to
    the pack's declared tolerance, and the signature (if present) validates.
  - `failed` — the digest, a result, or the signature disagrees.
  - `unverifiable` — the verifier lacks the named pack, engine version, or key
    and therefore cannot decide. Absence of evidence is not a negative result.
- A verifier **MUST** recompute rather than trust `results_digest`. That field
  exists to detect accidental corruption cheaply, not to authorize skipping the
  recomputation.

### Assurance boundary (normative)

Implementations **MUST NOT** present a `verified` receipt using language that
implies the underwriting is correct, complete, audited, or approved. A
`verified` receipt attests exactly two things:

1. the record's canonical financial content is unchanged since issuance; and
2. the stated outputs follow deterministically from that content under the named
   pack and policy set.

It attests **nothing** about whether the inputs are true, complete, sourced from
genuine documents, or reasonable. A record asserting a fabricated NOI can carry a
perfectly valid receipt. Interfaces surfacing receipt status **MUST** make that
distinction available to the reader rather than displaying an unqualified
checkmark. This mirrors the language already in `spec/UW_LITE_SPEC_v1.md` §9 and
raises it to a requirement on every consumer.

## Compatibility analysis

**Existing `.uw.md` files** — unaffected. Receipts are detached and additive; no
existing file becomes invalid, and no parser change is required to read a record
that has a receipt sitting beside it. A file that never gets a receipt is exactly
as conforming as before.

**Existing implementers, by tier:**

- **Tier-1 Reader** — unaffected. Reading a record never requires a receipt.
- **Tier-2 Editor** — unaffected in-place, but editors **SHOULD** treat any
  existing receipt as stale once a write lands, because the canonical digest
  changes. Presenting a stale receipt as current would be the main way to
  misuse this feature.
- **Tier-3 Calc Host** — this is the tier that gains work. Issuing a receipt
  requires the host to report pack identity and version alongside results.
  Existing Tier-3 implementations stay conforming; receipt issuance is optional.
- **Tier-4 Agent Host** — unaffected, and pointedly so. Agents do not issue
  receipts, because agents do not compute financials.

**Modules** — additive. A module that declares calculations **MUST** declare a
pack version for its outputs to be receiptable; modules that do not are simply
not eligible to be named in `computation.pack` until they do.

Nothing breaks, so no deprecation path is required.

## Conformance impact

**Existing fixtures needing updates:** none. Receipts are additive and detached,
so every current fixture in `conformance/tier-1-reader/`,
`conformance/tier-2-editor/`, `conformance/tier-3-calc-host/`, and
`conformance/lite/` stays valid as written.

**New fixtures**, proposed as `conformance/receipts/`, following the structure
the `lite` suite established (named suite, `--tier=receipts`):

- `issue/<scenario>/` — `deal.uw.md` (or `.uwx.md`) + `expected-receipt.json`.
  Issuance is deterministic apart from `issued_at`, which the runner stubs the
  way `stripVolatileFields` already handles timestamps in Tier 2.
- `verify/<scenario>/` — `deal.*` + `receipt.json` + `expected-verdict.json`
  asserting one of `verified` / `failed` / `unverifiable`. Must include:
  a clean verify; a record mutated after issuance (digest mismatch → `failed`);
  a receipt whose stated result disagrees with recomputation (→ `failed`); and a
  receipt naming an unknown pack (→ `unverifiable`, **not** `failed`). That last
  one is the case implementations are most likely to get wrong.
- `refuse/<scenario>/` — a document with parse errors plus an assertion that
  issuance refuses rather than emitting an unsigned or caveated receipt.

The invariant worth asserting without a baseline, in the style of the Lite
suite's §6/§7 checks: **re-issuing a receipt over an unmodified record MUST
reproduce the same `subject.digest` and the same `results`.** That binds any
implementation regardless of our frozen output.

## Reference implementation

**Files affected:**

- `packages/uwmd-core/src/receipts.ts` (new) — issuance and verification of
  unsigned receipts.
- `packages/uwmd-core/src/receipts.test.ts` (new) — sibling test, per repo
  convention.
- `packages/uwmd-core/src/index.ts` and `browser.ts` — export the new surface.
  Receipt verification is browser-safe and **SHOULD** be exported from both, so
  the web editor can verify a receipt client-side.
- `scripts/run-conformance.mjs` — add a `receipts` suite alongside `lite`.
- `spec/UW_RECEIPT_v1.md` (new) — the normative receipt schema, plus
  `spec/schemas/uw-receipt.schema.json` for `npm run validate-schemas`.

**API surface (additive):**

```ts
export interface UWReceipt { /* shape above */ }
export type UWReceiptVerdict = 'verified' | 'failed' | 'unverifiable';
export interface UWReceiptVerification {
  verdict: UWReceiptVerdict;
  issues: UWReceiptIssue[];   // typed codes, e.g. RCP-01 digest mismatch
}
export function issueReceipt(subject, computation, options): UWReceipt;
export function verifyReceipt(receipt, document, packs): Promise<UWReceiptVerification>;
```

Errors use a typed `ReceiptError`, consistent with `ProtocolError` / `CalcError` /
`ExcelEmitError`.

**Crypto layering.** Core already computes SHA-256 via `sha256TextHex`
(`integrity.ts`) using Node crypto or Web Crypto with no external dependency, so
**unsigned** issuance and verification live in core without touching the
dependency invariant. **Signature** creation and validation live in the separate
`@uwmd/signing` package RFC 0010 proposes, so core stays
zero-cryptography-dependency. A verifier without `@uwmd/signing` returns
`unverifiable` for a signed receipt rather than silently ignoring the signature —
which is the whole reason `unverifiable` is a distinct state.

**Test plan:** unit tests per the fixture matrix above, plus a property test in
the style of `calc/calc.property.test.ts` asserting issuance totality (any input
either issues a receipt or throws a typed `ReceiptError`) and re-issuance
stability.

## Alternatives considered

**Embed the receipt in the record as a `_meta` field or extension block.**
Rejected on three counts: it breaks the Tier-2 byte-preservation invariant, it
creates a circular dependency (the digest would cover the field containing the
digest, requiring an exclusion rule that every implementer would get subtly
wrong), and it makes third-party issuance impossible — an auditor must be able to
attest to a record without modifying it.

**Reuse RFC 0010 signed blocks and call it done.** Rejected because a block
signature answers "who wrote this and has it changed," not "do these numbers
follow from these inputs." A fully signed record can still carry arithmetic that
no pack would produce. The two mechanisms are complementary; conflating them
would leave the actual computation unattested while appearing to cover it.

**Sign the raw `.uw.md` bytes instead of a canonical form.** Rejected because it
makes receipts break on cosmetically irrelevant edits — reflowing a label,
changing comma grouping, normalizing line endings. `UW_LITE_SPEC_v1` §6 already
defines exactly which axes are semantically meaningful; binding to the canonical
form means a receipt survives reformatting and fails only on financial change,
which is the behavior users expect.

**Two verdict states instead of three.** Rejected. Collapsing `unverifiable`
into `failed` cries wolf whenever a verifier lacks a pack, training users to
ignore failures. Collapsing it into `verified` is straightforwardly dangerous.
The three-state result is the single most important design decision here.

## Unresolved questions

- **Pack version pinning across engine upgrades.** If `multifamily@1.0.0`
  produces a different sixth decimal under a newer engine, is the old receipt
  `failed` or `unverifiable`? Leaning `unverifiable` with an explicit
  engine-mismatch issue code, but this needs a decision before implementation.
- **Receipt transport.** Sidecar file (`deal.uw.md` + `deal.receipt.json`),
  HTTP header, or MCP resource? Deferred to the binding specs; the object itself
  is transport-neutral by design.
- **Revocation.** If a key is compromised, is there a revocation story, or is
  that entirely out-of-band as with RFC 0010 key distribution? Proposed: out of
  band for 1.0, revisit if adopters ask.
- **Multi-pack records.** A record spanning several packs currently needs one
  receipt per pack. Whether to allow an array of computations in a single receipt
  is deferred until a real multi-pack case exists.

## Prior art

- **Sigstore / in-toto attestations** — the subject-plus-predicate shape, where a
  statement binds a digest of an artifact to claims about how it was produced, is
  taken almost directly from the in-toto attestation model.
- **SLSA provenance** — the distinction between "this artifact is unchanged" and
  "this artifact was built this way" is the same split this RFC draws between
  RFC 0010 and receipts.
- **RFC 8785 (JSON Canonicalization Scheme)** — already the canonicalization
  basis in `integrity-canonical.ts`; receipts reuse it rather than inventing a
  second canonical form.
- **Certificate Transparency** — the three-state verifier posture (good / bad /
  cannot tell) rather than a binary is borrowed from CT log verification, where
  conflating "no proof available" with "proof failed" was a known early mistake.
