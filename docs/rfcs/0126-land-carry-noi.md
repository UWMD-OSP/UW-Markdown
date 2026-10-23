---
rfc: 0126
title: Verify the stated land carry-NOI identity
status: accepted
author: UWMD maintainers
created: 2026-10-22
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0126: Verify the stated land carry-NOI identity

## Owner ruling — 2026-10-22 (sixth set)

Accepted as drafted by the owner, D1–D6 stand as written.
This PR records the ruling and implements the synchronized current contract.

## Summary

Define the land identity `land_carry_noi`: stated effective gross income minus
stated total operating expenses, at the same scope, period and variant. Verify
negative and zero results as well as positive ones. Add no land cap rate or DSCR.
**Accepted by the owner; implemented in this PR.** The owner's fifth-set ruling
requests this proposal. Recommendation: accept D1–D6 as written.

## Motivation

Sundance states `noi_model.income.effective_gross_income`,
`noi_model.expenses.total_operating_expenses` and `noi_model.net_operating_income`.
Current land dictionary entries check carry/size ratios but no EGI-minus-OpEx
identity. RFC 0119 checks repeated NOI figures when present elsewhere; it does
not derive the stated NOI from these operands. A changed negative NOI can thus
remain unchecked when no other copy is stated.

## Proposed change

Add one `land` calculation, label `Land carry NOI`:

```json
{
  "id": "land_carry_noi",
  "asset_classes": ["land"],
  "formula": "noi_model.income.effective_gross_income - noi_model.expenses.total_operating_expenses",
  "input_paths": ["noi_model.income.effective_gross_income", "noi_model.expenses.total_operating_expenses"],
  "section_roles": {},
  "unit": "$",
  "round_to": 2,
  "minimum_stated_decimals": 0,
  "null_semantics": "expression",
  "deterministic": true
}
```

Bind `noi_model.net_operating_income` as an explicit alias of `land_carry_noi`,
applicable only where that class carries the id. The canonical id at current
output-section roots and `quick_metrics.land_carry_noi` retains RFC 0099's usual
meaning. Do not infer new homes from NOI-like field names. Every numeric
statement is checked and counted separately; a failed alias cannot be hidden by
an agreeing quick metric.

### One stated basis, no temporal or scope conversion

Format 4.5 MUST define the EGI, total OpEx and NOI at these three addresses in one
current land `noi_model` block as amounts for **one common property scope,
reporting period and exact authored variant**. Stating these members together
asserts that shared basis. The block's declared period/scope, when supplied,
applies to all three; absence does not authorize annualization or borrowing
another block's period. No new per-operand date field or inferred calendar is
introduced. A producer with different bases must state separate variants or an
explicit conversion under a separately defined identity, rather than put
unmatched amounts in these three homes.

For an NOI statement inside a block, read both operands from that **same block**,
with the exact statement variant locked for both reads. No fallthrough to a
primary/default variant to fill a missing operand. Other bound statement homes
resolve a unique `noi_model` by Protocol VIII.2; ambiguous selection is
unverifiable. Do not combine an operating-statement T12 EGI with model-budget
OpEx, a component with whole-property totals, or distinct variants. This checks
the producer's shared-basis assertion, not the truth of its real-world scope or
whether all expenses were disclosed.

### Arithmetic and outcomes

Use only the stated totals. Do not sum expense rows, reconstruct EGI, infer zero,
read debt service, choose reserve placement or create a projection. Operating
expense classification remains the producer's stated total; this RFC does not
resolve RFC 0092's reserve/NCF convention questions.

Evaluate the subtraction unrounded in binary64. Reuse the dollar-entry comparison
contract: `round_to:2`, `minimum_stated_decimals:0`; comparison precision is
`min(max(source_decimals,0),2)`, half away from zero once, under Protocol VIII.5.1.
No new epsilon or absolute tolerance. Negative and zero finite results are
eligible for verified; a disagreement is failed. Missing/null operands, invalid
operand types, nonfinite results, missing source precision or section-resolution
refusal retain the existing unverifiable/typed-caller-error boundaries.

The arithmetic check adds no land `cap_rate`, `dscr`, debt yield or income-based
valuation. `is_carry_model` is descriptive, not a behavior selector. Separate
`annual_carry_cost`, `carry_ratio` and `carry_cost_per_acre` keep their definitions.
RFC 0119's $500 cross-copy warning remains independent, never the tolerance for
this identity. Land debt-service restatement is input to RFC 0092/#355 by owner
ruling; this RFC neither defines nor generates a loan payment stream.

## Decisions for acceptance

| # | Question | Recommendation | Precedent |
|---|---|---|---|
| D1 | Identity/class | land_carry_noi, land only; EGI minus stated total OpEx | Owner fifth set; bounded dictionary identities |
| D2 | Statement | Explicit alias noi_model.net_operating_income plus canonical homes | RFC 0099 closed registry |
| D3 | Alignment | Three fields declare one block basis; lock exact variant and same-block operands; no cross-period/scope conversions | Format 4.5 and Protocol VIII.2 selection; owner matching-basis requirement |
| D4 | Precision | Dollar round_to 2, minimum_stated_decimals 0; no tolerance | RFC 0079 non-per-area dollar convention |
| D5 | Nonpositive result | Verify normally; null is not zero | Safe-expression semantics; RFC 0119 distinguishes negative from absent |
| D6 | Coverage boundary | No cap rate/DSCR, row summation, debt schedule or reserve classification | Owner fifth set; RFC 0078 D1/D7 |

## Current contract and versions

This PR synchronizes the accepted dictionary, Format/Protocol and conformance
contract. Existing variant-locked section selection supplies same-block reads. No version allocation,
compatibility path or historical artifact work; prelaunch packages remain 4.x.

## Conformance impact

Add independently authored land cases with positive/zero/negative results and a
changed NOI (failed); missing/null EGI or OpEx (unverifiable, not zero); same-block
variant isolation; mismatched/ambiguous selection; same values in differently
scoped variants never mixed; agreeing quick metric with disagreeing alias;
whole-dollar/cent/trailing-zero and negative half-away boundaries. Prove expense
row changes alone do not alter a stated-total identity, and no land cap rate or
DSCR evidence is synthesized. Independent Python and reference results agree.

## Reference implementation

This implementation synchronizes Format 4.5 shared-basis text, Protocol metric
contract and executable mirror/descriptions, dictionary and generated copy,
land pack/Excel parity, same-block statement selection, independent Python
calculation controls (the current implementation claims Reader, not full Verifier),
conformance, wiki and changelog. No new API/dependency or invented diagnostic.
Other-class NOI identities require separate review; this proposal does not
change their dictionary applicability.

## Alternatives considered

Reuse RFC 0119's warning: compares restated inputs without deriving NOI. Sum
expense details: needs a different completeness/classification convention.
Treat negative NOI as inapplicable: leaves the central land carry figure
unchecked. Require an external operating statement: wrongly binds underwriting
to another period/basis rather than the stated model.

## Unresolved questions

D1–D6 are accepted, including the explicit same-block shared-basis
contract and existing dollar comparison precision. No new financial convention
is left for implementation to guess.

## Prior art

RFCs 0078/0079/0099 supply dictionary identity, precision and explicit homes.
RFC 0119 supplies nonpositive-NOI cross-copy checks, with a different purpose.
RFC 0092 and #355 retain their separate bounded-assurance convention work.
