---
rfc: 0086
title: Resolve data-center purchase-price authority and summary binding
status: draft
author: UWMD maintainers
created: 2026-10-15
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0086: Resolve data-center purchase-price authority and summary binding

## Summary

This draft asks the owner to choose the economic scope and authority relationship
between the two existing purchase-price inputs in Issue #343 M04. It proposes
no accepted formula, field, equality rule, code or severity. Merging this design
record with status `draft` would not accept an alternative or authorize its
implementation. The [Phase 2 review](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/reviews/2026-10-15-financial-verification-phase-2.md)
records the engineering evidence separately from this semantic decision.

## Motivation

The dictionary defines `price_per_kw` from `valuation.purchase_price` and
`property.critical_it_load_kw`, while `price_per_commissioned_kw` reads
`quick_metrics.purchase_price` and `dc_capacity.critical_it_load_kw`. Format
CC-DC-08 reconciles the stated denominators exactly. Format CC-10 compares a
third source, `sources_uses.uses.purchase_price`, with valuation. Neither checks
the quick-metrics price. RFC 0039 preserved its frontmatter numerator; RFC 0080
added the builtin intensive. Format describes quick metrics as a restatement,
but gives it no cross-check of its own. Both formulas therefore compute exactly
while same-basis labels can suggest misleading comparability.

## Proposed change

Choose one alternative and complete its unresolved requirements before adding
normative language or implementation. Until then the current contract remains.

| Alternative | Required economic/selection decision | Missing or ambiguous inputs |
|---|---|---|
| Preserve independent sources, disclose lineage | Decide whether both metrics are useful distinct measures and how consumers identify their basis | Preserve current null/refusal behavior; disclosure must not certify equality |
| Unify both numerators on valuation purchase price | Identify the transaction interest, date, currency and authoritative valuation variant; frontmatter becomes a summary cache | Missing valuation cannot silently fall back; ambiguous variant remains refusal unless an approved exact selector resolves it |
| Retain formulas and require same-basis reconciliation | Define when both prices assert the same consideration; choose exact/currency-quantized relationship and severity | Missing price/basis is not a verified equality; decide whether comparison is omitted, unverifiable or required by a selected profile |
| Bind the summary explicitly to one valuation variant | Define binding identity, lifecycle/provenance and handling of multiple scenarios | Decide compatibility for existing unbound records and refusal for dangling/ambiguous bindings |

An equality alternative needs an explicit owner decision that, for example,
"when both quantities assert the same defined economic basis, their purchase
prices MUST reconcile under the approved comparison procedure." That sentence
is a candidate obligation only: this draft deliberately does not fill its basis,
precision, selection or severity with an agent-chosen financial convention.
Appraisal or underwritten value is not automatically purchase consideration.
Descriptive frontmatter `scenario` cannot select behavior (Format §2.2b).

## Compatibility analysis

Unifying formulas changes reported values, receipts/pack identity and third-party
reproduction. A new equality finding changes previously conforming verifier
behavior even if the formulas remain. A new binding/required basis affects
producers and schemas. Retaining formulas with editorial lineage alone changes
none of those contracts. Reader preservation, Verifier reproduction, optional
profile applicability and third-party module expectations must be specified for
the selected alternative; existing profiles do not already certify this relation.
No version or migration policy is selected here. Any change must state its
compatibility path and cannot be smuggled into an interim release as a fix.

## Conformance impact

No current fixture or expected value changes in this draft. After approval,
propose separate same-price/conflict/missing-price cases, exact valuation variant,
primary/default/ambiguous selection, differing transaction bases, underwritten
value changes with constant purchase price, and currency-quantum boundaries.
Keep CC-DC-08 exact physical identity separate. State Reader/Verifier/profile
ownership and whether missing basis is skipped, unverifiable or an applicability
failure. Do not regenerate old financial outputs merely to pass an alternative.

## Reference implementation

A follow-up implementation, contingent on an accepted decision, would touch the
selected subset of Format/schema declarations, `spec/metrics/builtin.json`, its
generated mirror, data-center pack/bindings, validation and conformance. Formula
unification would also update starter Excel mappings and receipt/pack identity
under the existing release process. No new API or field is specified yet. Tests
must demonstrate independently selected same-basis and different-basis cases,
missing/refused states, exact variant reads and full quantized output parity.
Release versions remain the release owner's responsibility.

## Alternatives considered

The four alternatives above remain live owner choices. Blanket equality is
simpler but may conflate two transaction/scenario bases. Formula unification
removes duplicate authority but changes results and may remove a useful authored
scenario measure. Explicit binding preserves scenarios at a higher representation
cost. Disclosure alone preserves compatibility but offers no reconciliation
guarantee. No alternative is represented as owner-approved or rejected.

## Recommended direction for owner review — 2026-10-15

**Proposed direction, not an accepted decision:** prefer an explicit binding of
the frontmatter summary to one valuation purchase-price assertion, with opt-in
same-basis reconciliation. Preserve today's formulas and unbound records until
a governed compatibility path is accepted. Disclosure of each current numerator
and denominator can proceed as starter documentation; it does not certify their
agreement. Do not introduce a universal equality or silently unify formulas.

For the proposed binding, `valuation.purchase_price` is the authority for the
specifically bound transaction consideration; the summary restates that source.
This is not authority for appraisal/underwritten value or for a different
transaction interest. Required comparison inputs would identify the exact source
section/variant and revision/snapshot, currency, acquired interest/allocation,
transaction/effective date and actual/forecast or alternative modeling case.
These are proposed semantic requirements, not new field names or required schema
members. The owner must approve their representation and requiredness.

| Case | Recommended proposed treatment |
|---|---|
| Same explicitly bound basis and values | Verify only the declared relationship, under an approved precision procedure; keep the existing metric formulas |
| Different finite prices on the bound basis | Report a relationship disagreement after code/severity approval; do not overwrite either source |
| Missing price, missing binding/basis, or unresolved variant | Cannot certify the relationship; do not infer a price, equality or fallback. Legacy conformance stays separate from the optional claim |
| Different transaction/scenario basis | Preserve both assertions with lineage; no equality finding merely because amounts differ |
| Multiple valuation variants | Use the binding's exact variant for the proposed comparison. Preserve existing calculation-context and primary/default/base/sole selection for every metric read. No first-match or descriptive frontmatter scenario routing |
| Only underwritten/appraised value changes | No purchase-price substitution; the current formulas still name purchase price |

The binding would select a reconciliation target, not reroute either existing
metric. If `price_per_kw` was computed using a different explicit valuation
context than the summary's bound source, the two displayed values have different
lineage; they cannot be certified as one comparable price assertion. Match the
actual source identity/revision used by each read before claiming reconciliation.
Changing calculation resolution to follow the binding would be an additional
normative choice, not an implication of this recommendation.

A producer could explicitly refresh a bound summary with provenance; a verifier
must not repair it silently. A binding to an old revision must not drift when a
new scenario is authored. Missing or ambiguous binding targets require their own
approved result/applicability behavior; existing calculation-resolution codes do
not automatically become relationship-validation codes.

The retained M04 oracle demonstrates10m versus12m prices over1,000kW producing
10,000 versus12,000 under the two existing formulas. Formula unification would
change one result; a reconciliation assertion would instead change what can be
claimed about those results. Both are normative changes. CC-DC-08's exact load
identity and CC-10's price tolerance do not supply a tolerance for this new
relationship. Output `round_to:2` alone does not specify source-price comparison.
The owner must choose precision, missing-basis applicability/severity and migration
before implementation. Old readers/verifiers cannot be assumed to understand a
new binding/profile; advertise its scope and define unsupported handling.

## Unresolved questions

- Are the two prices always one economic fact, or can interests/dates/scenarios differ?
- Which source and selected variant govern a comparable transaction?
- Is reconciliation universal, opt-in, or authority/profile-specific?
- What precision, missing-input state and severity apply?
- What compatibility obligations apply to existing records and implementations?

## Prior art

[RFC 0080](0080-official-classes-are-builtins.md) already distinguishes exact
physical denominator identity from financial source decisions. Protocol §VIII.2
and RFC 0066 select blocks deterministically without asserting equality between
two different paths. [The intake review](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/reviews/2026-10-15-financial-audit-343.md)
contains the retained synthetic evidence; no external valuation authority is
assumed to override UWMD.
