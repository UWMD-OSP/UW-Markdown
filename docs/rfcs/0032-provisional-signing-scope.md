---
rfc: 0032
title: State how `_meta.provisional` interacts with signing
status: implemented
author: jaredmaxey
created: 2026-09-01
affects:
  - protocol-spec
---

# RFC 0032: State how `_meta.provisional` interacts with signing

## Summary

Protocol § V.7 tells a producer it SHOULD stamp `_meta.provisional: true` on a
block resolved at or below `asset_class_default`. Because `provisional` sits
inside canonical block JSON (§ V.9 excludes only `content_hash` and
`signature`), that SHOULD moves `content_hash` — and with it any § V.11
signature. An adopter reasonably asked: does that mean two conforming producers
of "the same underwriting" can emit different signatures, and which of the two
is wrong? This RFC answers in spec text: neither. The obligation deliberately
remains a SHOULD, `provisional` is signed like every other `_meta` field, and
**cross-producer agreement of hashes or signatures over provenance metadata is
a protocol non-goal** — it was never achievable and was never what § V.11
promises. The protocol's cross-implementation agreement guarantees live at the
level of computed values (§ VIII, RFCs 0023/0024) and verification receipts
(RFC 0016), not provenance bytes.

## Motivation

Raised by the underwriter.cc app team (their tracking id UPSTREAM-002, first
raised 2026-08-30 and re-verified at protocol 1.9.0): § V.7's provisional
obligation is a SHOULD, `_meta.provisional` is inside the signed bytes, so two
producers that both conform — one stamping `provisional`, one not — produce
different signatures over the same underwriting. Their ask, verbatim in shape:
*either make it a MUST (so signatures are determined), or state that
`provisional` is excluded from the signed bytes, or state that signature
agreement across producers is not a protocol goal. Any of the three is fine;
the silence is not.*

The silence is real. § V.7 states the obligation, § V.9 defines the hash
exclusions, § V.11.2 defines the signing input, and no sentence connects them.
A reader who traces the three sections can derive the answer this RFC states —
but a spec that requires that derivation to know what a signature means is
underspecified on the one surface (cryptographic attestation) where ambiguity
is most expensive.

## Proposed change

Pick the third of the asker's three options, because the other two solve a
problem the protocol does not have:

- **Not a MUST.** The exemption clause ("unless the value originated from
  `inherited_assumption`, `investor_profile`, or fresher `market_data`") turns
  on *freshness*, a judgment the protocol deliberately leaves to the
  institution's threshold (§ III.6a `DQ-05`). A MUST whose trigger is a
  judgment is a SHOULD wearing the wrong keyword — and it would still not
  determine signatures, because the signing input names `actor`, `timestamp`,
  `signed_at`, and `kid`, which differ across producers by construction.
- **Not a hash exclusion.** `provisional` is a data-quality claim readers act
  on (§ III.6a `DQ-02` halts a stage over it). Excluding it from
  `content_hash` would let it be flipped on a signed block without detection —
  the exact tampering § V.10/§ V.11 exist to surface. The § V.9 exclusion list
  is two fields (the hash and the signature, which cannot cover themselves)
  and should stay two.

So: state the non-goal. Two spec edits, no schema change, no code change.

**1. Protocol § V.7** — after the provisional-obligation paragraph, add:

> This obligation is deliberately a SHOULD, and it is safe to leave as one:
> `_meta.provisional` sits inside canonical block JSON (§ V.9), so stamping it
> moves the block's `content_hash` and therefore any § V.11 signature — and
> the protocol accepts that two conforming producers may diverge here.
> Agreement of hashes or signatures across independently-produced blocks is
> **not a protocol goal** and is unachievable regardless of this clause, since
> canonical content includes producer-specific fields (`timestamp`, `source`)
> in every block. What the protocol does guarantee across implementations is
> agreement on *computed values* (§ VIII; RFCs 0023 and 0024) and on
> *verification verdicts* (RFC 0016 receipts). A signature attests to who
> wrote what, when — it does not attest that every conforming producer would
> have written the same bytes.

**2. Protocol § V.11.2** — after the paragraph explaining the six-field
signing input, add:

> Four of the six fields (`actor`, `content_hash`, `signed_at`, `timestamp` —
> and in practice `kid`) are specific to the producing party, so two
> conforming producers signing equivalent underwriting content produce
> different signing inputs and different signatures **by design**. A verifier
> MUST NOT treat signature disagreement between independently-produced blocks
> as evidence that either is non-conforming; conformance of *values* is the
> province of § VIII determinism and RFC 0016 receipts. This includes
> divergence introduced by optional `_meta` stamps such as `provisional`
> (§ V.7), which is covered by `content_hash` like any other `_meta` field
> outside § V.9's two exclusions.

## Compatibility analysis

Nothing changes shape and nothing changes behavior. Every existing document,
hash, signature, fixture, and implementation is untouched; the format version
and protocol version do not move (this is a clarification of what the protocol
already implied, in the tradition of the § V.9 wording fix — recorded in the
changelog, no version bump). A producer that had read the SHOULD as
signature-breaking and suppressed `provisional` to chase byte agreement can
stop; one that stamped it was already right.

## Conformance impact

None mechanically checkable: the added text states a non-goal and a verifier
prohibition on an inference ("MUST NOT treat disagreement as
non-conformance") that no scenario can force an implementation to make. No
corpus change. The existing `conformance/signing/` suite already exercises
`provisional`-bearing `_meta` through `content_hash` recomputation.

## Reference implementation

No code. `@uwmd/signing` and the § V.9 canonicalizer already behave exactly as
the added text describes — this RFC makes the spec say so. The two spec
paragraphs land in the same commit as this document.

## Alternatives considered

- **Make the obligation a MUST** — rejected above: the freshness exemption
  makes the trigger a judgment, and it would not deliver determinate
  signatures anyway.
- **Exclude `provisional` from the signed bytes** — rejected above: it makes a
  reader-actionable data-quality claim silently tamperable on signed blocks.
- **Say nothing** (status quo) — the answer is derivable but not stated, and
  the question was asked by the standard's first serious adopter. A derivable
  answer to a signing question is not good enough.

## Unresolved questions

None for this clause. The broader `_meta` v2 reorganization (RFC 0009, draft)
may someday give quality flags their own sub-object; if it does, the § V.9
exclusion list is the thing to re-examine, and this RFC's statement — signed
like everything else, cross-producer agreement a non-goal — is the default it
should inherit.

## Prior art

- JWS/JOSE (RFC 7515): a signature binds a specific serialization by a
  specific signer; the standard makes no claim that two signers of equivalent
  claims produce equal signatures.
- W3C Verifiable Credentials: proofs are per-issuer attestations over
  issuer-stamped metadata (issuance date, issuer id) — cross-issuer byte
  agreement is likewise not a goal there.
- This project's own RFC 0016: cross-engine agreement is expressed as a
  *receipt* comparing computed results, exactly because provenance bytes were
  never comparable.
