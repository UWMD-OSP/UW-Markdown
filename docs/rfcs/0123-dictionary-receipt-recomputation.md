---
rfc: 0123
title: Recompute dictionary-defined receipt results without a starter pack
status: accepted
author: UWMD maintainers
created: 2026-10-22
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0123: Recompute dictionary-defined receipt results without a starter pack

## Resolution

Implement RFC 0115 D4 literally: lack of a starter pack must not prevent a
Verifier from recomputing dictionary-defined results. Retain honest inability
to verify pack-only outputs and pack-output coverage. Accepted as drafted by the UWMD maintainers on 2026-10-22 (fourth set); this PR implements
the receipt-spec follow-up.

## Contract

For the record's selected rule set and asset class, a receipt result whose
`calc_id` matches an applicable builtin dictionary entry asserts that entry's
normative definition, including selectors, prerequisites, dependencies and
reported-output quantization. A producer using a different definition MUST use
a different calc_id; a starter pack cannot redefine a standard metric under its
builtin id. This is an explicit identity rule, not a guess from a display label.

A Verifier MUST recompute every such stated dictionary result using the selected
rule set, even when the named starter pack is unavailable or its version differs.
Use the dictionary dependency closure internally, but expose only recomputed
receipt result ids; do not append unstated intermediates or synthesize missing
record inputs. Compare value, computed status and unit under the existing exact
reported-output contract. No additional tolerance is introduced.

Keep subject digest, held-input integrity and rule-set preflights first. A signed
receipt must still authenticate before any financial recomputation or refusal;
no backend means RCP-08 and no recomputed financial values. A known invalid
signature remains RCP-01. Preserve the existing refusal and engine-identity
carve-out: deterministic recomputation refusal is RCP-03; finite disagreement
uses RCP-03 for the same engine or RCP-07 when engine identity differs.

Defer pack-availability RCP-05/06 until these independently decidable dictionary
checks have run. A demonstrable same-engine dictionary disagreement must not be
masked by an unavailable pack. Recompute results_digest over the complete stated
result list under the existing digest contract, independently of pack presence.

For an unavailable pack, return the actual dictionary subset in `recomputed`.
Any pack-only result or unprovable pack-output coverage keeps the overall verdict
`unverifiable` with RCP-05/06 when no earlier decisive failure applies. Do not
claim a complete named-pack receipt verified merely because its visible metric
subset agrees. Known-pack verification retains exact declared-output coverage
RCP-02 and evaluates the remaining pack-only outputs as today.

## Decisions

| Question | Recommendation | Precedent |
|---|---|---|
| How to bind a result to standard meaning? | Applicable builtin calc_id is the dictionary assertion; alternate formulas use another id | Dictionary metric identities and RFC 0078's standard/starter boundary |
| Unknown pack blocks all math? | No; authenticate first, then recompute independently defined dictionary claims | Accepted resolution and RFC 0115 D4 |
| All visible dictionary values agree but pack coverage is unknown? | Still unverifiable overall, with the recomputed subset exposed | Receipt 3.2 promises complete named-pack outputs; agreement does not prove omitted outputs |
| New wire field or tolerance? | Neither; existing calc_id, recomputed and RCP codes suffice | Existing receipt result/verification structure |

## Implementation and conformance

Update Receipt 3.2/5.1/5.4, Protocol II.2/II.6a, executable mirrors and affected
schema descriptions together. Add portable cases for a pack-less verifier with
correct/wrong dictionary values, unavailable dependencies, pack-only outputs,
unknown coverage, altered results digest, same/different engines and signed
backend/malformed/invalid-signature precedence. Keep pack-only exact coverage in
starter checks. No starter pack becomes a Verifier dependency.
