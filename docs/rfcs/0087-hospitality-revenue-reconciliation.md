---
rfc: 0087
title: Define the basis for hospitality revenue reconciliation
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

# RFC 0087: Define the basis for hospitality revenue reconciliation

## Summary

This draft compares ways to assert comparability and reconcile reported versus
ADR-derived room revenue in Issue #343 M09. It does not alter canonical RevPAR,
select an external accounting convention or add any validation requirement.
Owner decisions are required before a complete normative proposal can be
accepted. Status remains `draft`; the accompanying audit tests implement none
of these alternatives.

## Motivation

Format §4.3 Hospitality Variant and RFC 0080 preserve canonical RevPAR as
`noi_model.income.rooms_revenue / rent_roll.available_room_nights`. Dictionary
`total_room_revenue` separately reconstructs stated ADR × stated occupancy ×
available nights. `room_revenue_per_key` uses the rounded derived total.
CC-HOSP-04 prohibits an inferred RevPAR fallback when canonical inputs are absent,
but establishes no revenue equality. Both paths can be arithmetic-correct while
representing conflicting same-basis assertions or legitimately different periods,
actuals/forecasts and eligible room/revenue populations.

## Proposed change

Choose a comparison contract before defining fields, codes, requiredness or
severity. The existing formulas remain authoritative during this decision.

| Alternative | Required inputs / behavior | Missing or ambiguous behavior |
|---|---|---|
| Preserve independent measures with explicit display lineage | Show reported numerator versus reconstructed model inputs; do not imply comparison is verified | Preserve null/refusal and disclose absent basis |
| Require universal reconciliation | Assert all source fields necessarily share period, actual/forecast status, eligible revenue and room-night populations | Owner must decide treatment of existing records that never state those bases; mismatched basis cannot be silently forced equal |
| Reconcile only under explicit comparability assertions | Identify source variants, period start/end, actual/forecast basis, revenue scope, eligible supply/sales and occupancy definition | Absent assertions cannot verify equality; define skipped/unverifiable/profile-refusal behavior and ambiguous selection |
| Add an authority-specific bridge | Select exact authority/edition/effective date and map revenue, free/promotional/no-show rooms, supply closures and accounting exclusions | Unsupported authority mappings remain unavailable, never implicit fallback |

If comparability is asserted, assess three distinct relationships: stated
occupancy versus occupied/available nights, stated ADR versus eligible reported
revenue/occupied nights, and reconstructed versus reported revenue. Agreement
of one product alone cannot prove compatible populations. A candidate obligation
could require reconciliation only after those assertions establish the same
basis. Its basis and numeric procedure must be owner-approved before this draft
can supply normative MUST language or implementation-ready schema text.

Rounding needs its own explicit choice. Reported revenue 1,000,000 over 6,000
occupied nights yields a displayed cent ADR of 166.67; reconstructing from that
cent value yields 1,000,020. A one-cent revenue equality rule would reject this
otherwise coherent source. The accompanying deterministic review probe computes
this example. No revenue tolerance is inferred from per-result quantization.
Owner must decide whether ADR/occupancy are full-precision authored model inputs,
rounded observations or authoritative reconstructive values. Preserve established
formula-level rounding and final Protocol §VIII.5 quantization meanwhile.

## Compatibility analysis

Universal equality can change verdicts for actual/forecast or different-period
records. Optional assertions can preserve old records but require explicit
applicability and missing-basis behavior; new required fields would burden
producers. An authority bridge needs independently verified schedules and a
version/effective-date mapping. Readers must preserve assertions they cannot
verify; Verifier/profile obligations must be explicit. Existing optional profiles
do not already certify STR, USALI or lender compliance. No module manifest,
metric meaning, version or migration policy changes in this draft.

## Conformance impact

No corpus baseline changes now. An approved implementation would add matching
and conflicting same-basis figures, different periods/actuals/forecasts, eligible
revenue and supply exclusions, missing assertions/inputs, explicit/ambiguous
variants, rounding accumulation, zero occupancy with positive supply, zero supply,
and missing/zero keys. Keep canonical RevPAR and CC-HOSP-04 positive controls.
Each fixture must identify Reader/Verifier/profile ownership. Missing inputs,
finite disagreement and unverified comparability remain distinct.

## Reference implementation

After owner choice, define the assertion representation, verification procedure
and API before changing Format/schema, class validation and conformance. Existing
`builtin-class-validation.ts`, hospitality pack and Excel/report bindings must
continue using the dictionary sources; no fallback or new revenue reconstruction
capability is implied. A follow-up PR must test source selection, basis matching,
missing/refused states, numeric precision and relevant Excel parity. No normative
implementation is included with this design record.

## Alternatives considered

Disclosure preserves compatibility but cannot certify reconciliation. Universal
equality is simpler but risks false failures across legitimate bases. Optional
comparability assertions narrow the check but add representation and lifecycle
cost. Authority-specific bridges address adopter needs while requiring evidence
that the current public accounting schedules do not fully supply. None is
selected or represented as an owner-approved convention.

## Recommended direction for owner review — 2026-10-15

**Proposed direction, not an accepted decision:** prefer explicit comparability
assertions, with a separate observation-rounding bridge where justified. Keep
canonical RevPAR and every current metric formula unchanged. Universal revenue
equality would conflate independently meaningful actual, forecast, benchmark
and reconstructed figures; disclosure alone remains the compatible fallback
until the proposed relationship is accepted.

The proposed basis binds each assertion to exact source variants/revisions and
identifies: period start/end with endpoint convention; actual/forecast status
and as-of/cutoff; modeling scenario; currency and eligible room-revenue scope;
available and occupied/eligible sold room-night populations; occupancy definition;
and input precision/rounding authority. A single frontmatter scenario or equal
numerical product cannot establish that these dimensions match. Field names,
closed vocabularies, requiredness and new findings remain unselected.

| Figure/basis | Recommended proposed treatment |
|---|---|
| Reported actual revenue and room-night observations | Use actual eligible populations and declared input precision. Compare observed ADR with reported eligible revenue/eligible occupied nights, and observed occupancy with occupied/available nights, at the declared observation precision |
| Full-precision forecast assumptions | Where the same basis is explicitly asserted, compare the forecast chain using its authored inputs and established metric quantization. No new tolerance or hidden reconstruction is implied |
| Benchmark/comp-set observation | Preserve its own period, eligibility and authority. Do not bind it to subject NOI or infer actuals from it |
| Reconstructed revenue | Identify it as ADR × occupancy × available nights under the current dictionary, rather than silently replacing reported NOI room revenue |
| Different period/status/scope/population | No same-basis equality claim, even when the product happens to agree |
| Missing basis, source, input or unresolvable variant | Relationship not verified; no zero/default/fallback substitution. Define opt-in applicability and unsupported handling before implementation |

Comparability assertions would not reroute current metric reads or override
explicit calculation contexts and existing generic variant resolution. The
assertion's source identities/revisions must match the inputs actually read;
matching a different variant does not verify the displayed result. A mismatch
of context is a basis/applicability question, not permission to recompute
canonical RevPAR from another numerator.

For rounded actual observations, prefer verifying the reported observations back
against their declared revenue/count sources over inventing a currency tolerance
for multiplying rounded inputs. The existing deterministic example (1,000,000
reported revenue over6,000 occupied nights; cent ADR166.67 reconstructs1,000,020)
shows why product equality is insufficient. This proposed bridge requires owner
approval of rounding authority/precision; it is not a rule already supplied by
Protocol VIII.5. Full-precision modeled inputs and rounded observed inputs must
not be silently interchanged.

Zero occupancy with positive supply can produce zero reconstructed revenue only
when the other required inputs exist. Canonical RevPAR still uses reported
room revenue/supply. Zero supply retains the existing division refusal; absent
ADR remains absent rather than inferred zero. Current CC-HOSP-04 still forbids
an ADR/occupancy fallback for canonical RevPAR. No comparison may merge failed,
missing and unverifiable states.

A universal equality changes old verdicts. New comparability/basis representation
and opt-in verification need explicit capability/profile applicability, schema
compatibility and migration; they cannot be hidden in a package patch. Any
USALI/STR/program compliance bridge additionally needs the exact authority,
edition/effective date, revenue inclusions/exclusions and eligible supply/sales
schedules. Detailed current USALI accounting schedules remain unverified in
this audit; no institutional convention is invented to fill them.

## Unresolved questions

- Which comparability assertion, if any, belongs to the global format?
- Which exact period, revenue scope and room population must match?
- Does an input contain actual, forecast or modeled full-precision values?
- How does input precision affect a reconciliation procedure and tolerance?
- Is missing basis merely undisclosed or a refusal under a selected profile?
- Which authority/program claim is needed, and who supplies its current schedules?

## Prior art

[RFC 0080 Decisions](0080-official-classes-are-builtins.md#decisions) explicitly
retains canonical reported-revenue RevPAR despite inconsistent model inputs.
[RFC 0081](0081-one-format-one-protocol.md) consolidates field homes without
changing arithmetic. [Issue #343](https://github.com/UWMD-OSP/UW-Markdown/issues/343)
and its review distinguish STR room
eligibility evidence from incomplete current USALI accounting evidence.
