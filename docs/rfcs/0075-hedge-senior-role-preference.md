---
rfc: 0075
title: Read a rate hedge from the senior loan when debt_structure is a role map
status: accepted
author: claude-code (agent proposal)
created: 2026-10-06
depends_on:
  - 0040
  - 0056
  - 0070
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0075: Read a rate hedge from the senior loan when debt_structure is a role map

**Accepted by merge.** A coding agent wrote this RFC from issue #266
(StackUW UPSTREAM-024) and implemented it in the same pull request. It
reaches `main` only when the owner merges that pull request. The merge
records the acceptance. The RFC stays `accepted` until a release ships it and
publication is verified. If the pull request closes unmerged, the RFC was
never accepted.

## Summary

The rate-hedge and escrow rules (`HDG-01`–`HDG-10`, `ESC-04`) and the RFC 0070
binding verifier read one `debt_structure` block. Today they select it with no
role preference. A document whose `debt_structure` holds one `senior` and one
`junior` block, neither keyed `default` or `base`, therefore has no hedge loan:
the hedge is refused or silently not checked. If the junior is keyed `base`,
the hedge rules read the junior instead. CC-02/03/05/09 select the senior on
the same document.

This RFC registers `senior` on `debt_structure` for the hedge and escrow rules
in `CROSS_CHECK_ROLE_PREFERENCE`. That is the preference RFC 0040 already
registers for the lender-side cross-checks. Nothing else about selection
changes.

## Motivation

Format §5.3 lists the per-check role preferences for property-level reads:
"CC-02/03/05/09 prefer `senior` on debt_structure". Protocol §V.12.1 step 1
has the RFC 0070 hedge read use "existing RFC 0040 selection". The hedge and
escrow rules register no role, so they fall through to `primary`, `default`,
`base` and the sole variant.

The outcome depends only on variant names. Issue #266 reports seven documents,
each one of upstream's own `conformance/hedge/0070-*` cases with only roles,
keys and one hedge edited. Every row reproduces against `main` at `b042af2`:

| Document | HDG/ESC findings | `verifyReplacementFundingBindings` |
|---|---|---|
| hedged `senior` `alpha`, unhedged `junior` `beta` (outright) | HDG-08 | `unverifiable/unresolvable_source` |
| the same, without the junior | none | `verified` |
| the first, with the senior keyed `base` | none | `verified` |
| the first, senior keyed `bridge`, junior keyed `base` | none | `not_checked/not_applicable` |
| escrow case, senior `bridge`, junior `mezz` | HDG-08, ESC-04 | `unverifiable/unresolvable_source` |
| the same, with `rate_hedge` a string | ESC-04 only | `unverifiable/invalid_structure` |
| the senior alone, with that string hedge | HDG-01, ESC-04 | `unverifiable/invalid_structure` |

Row four is the worst case. The hedge read selects the junior, which states
no hedge, so the senior's outright replacement funding passes with no finding.
The verifier then reports the binding as not applicable rather than checking
it. Row six is the second defect the issue names: beside a junior, a malformed
hedge loses its HDG-01.

## Proposed change

### Decisions

The adopter's proposal leaves these points open. Each is answered here from
existing contracts.

| # | Question | Answer | Why |
|---|---|---|---|
| D1 | Which block do the hedge and escrow rules read on a role-bearing `debt_structure`? | The unique `senior`. `HDG-01`–`HDG-10` and `ESC-04` each register `{ debt_structure: "senior" }`. | RFC 0040 registers `senior` for the lender-side cross-checks, because "two debt blocks" means a capital stack. RFC 0066 D2 gave the lender-side metrics the same preference. A rate cap is a requirement of the floating senior loan. HDG-05 already ties the hedge premium to `sources_uses.uses.rate_cap_cost`, a property-level use. |
| D2 | One preference for the family, or per rule? | Per rule, with identical entries. All of them share one selection. | `CROSS_CHECK_ROLE_PREFERENCE` is keyed per rule (RFC 0040; RFC 0066's "precedent is keyed per rule"). Identical entries keep HDG-05 and ESC-04, which tie the hedge to `sources_uses`, from ever reading two different loans. |
| D3 | What happens to a hedge stated only on a non-selected block, such as a junior? | It is not read. That is the same as every other field of a non-selected block. | RFC 0040 reads one block per section and never sums or merges tranches. RFC 0070 §V.12.1 step 1 "does not … introduce tranche-specific hedges". Nothing claims the unread binding: the verifier reports `not_checked/not_applicable`, never `verified`. |
| D4 | What stays unchanged? | `sources_uses` selection, refusal on two `senior` blocks, component exclusion, the exact-variant `cash_flow_series` reference with no fallback, and every role-free document. | The issue's own list. None of these is in question, and each has a conformance case. |

### Format §5.3

Before:

> CC-01 prefers `detail` on rent_roll; CC-02/03/05/09 prefer `senior`
> on debt_structure (`CROSS_CHECK_ROLE_PREFERENCE`).

After:

> CC-01 prefers `detail` on rent_roll; CC-02/03/05/09 prefer `senior`
> on debt_structure. The rate-hedge and escrow rules `HDG-01`–`HDG-10` and
> `ESC-04` (§4.7/§4.8) also prefer `senior` on debt_structure, as one shared
> selection, so a hedge is read from the senior loan (RFC 0075). All of these
> are registered in `CROSS_CHECK_ROLE_PREFERENCE`.

### Format §4.7 (Rate hedges)

Add after the opening sentence:

> When `debt_structure` is a variant map, the hedge rules read the one block
> §5.3 selects for them, preferring `senior` (RFC 0075). A hedge on any other
> block is not read.

### Protocol §V.12.1 step 1

Before:

> Resolve the current property-level `debt_structure` and `sources_uses`
> under existing RFC 0040 selection.

After:

> Resolve the current property-level `debt_structure` and `sources_uses`
> under existing RFC 0040 selection, with the hedge rules' registered `senior`
> preference on `debt_structure` (format §5.3, RFC 0075).

The rest of step 1 is unchanged, including "refuse; never treat it as absence
or choose by fence order". Its next sentence, "This RFC does not extend hedge
checks to component financing…", now names RFC 0070, so it cannot be read
as referring to RFC 0075.

### Library

- `CROSS_CHECK_ROLE_PREFERENCE` (exported from both entries) gains eleven
  frozen entries, `HDG-01`–`HDG-10` and `ESC-04`, each
  `{ debt_structure: "senior" }`. This is additive. The type is unchanged.
- The validator's hedge and escrow pass, and `checkReplacementFundingStructure`,
  which the async verifier also uses, pass a hedge rule code to the existing
  resolver. No new export, type or parameter.

## Compatibility analysis

- **Documents refused today** are a unique `senior` beside other debt blocks,
  with the senior not keyed `default` or `base` and no unique `primary`. They
  now resolve to the senior, and the real hedge and escrow checks run. Their
  findings change, from HDG-08 or silence to the senior hedge's own result.
- **Documents whose hedge read selects a non-senior block today** do so
  through `primary`, `default` or `base` while a unique `senior` exists. They
  now read the senior. Their findings can change, which is the correction.
- **A hedge stated only on a junior beside a senior (D3)** was refused with
  HDG-08 when it stated replacement funding, and otherwise not checked. It is
  now not read, the same as before for every other junior field.
- **No change:** documents with one `debt_structure` block; documents with no
  role-bearing debt blocks; documents whose senior was already selected.
- **Tier-1 readers** are unaffected. **Tier-2 editors** preserve bytes as
  before. **Tier-3 calculations** never inherit a check's preference (RFC
  0041), so no calculation changes. **Tier-4 hosts** read the same findings
  vocabulary; no code is added or removed.
- **Modules:** no manifest, section or grammar change.

No deprecation path is needed. No document is newly refused, except where it
was already refused under another key order or now fails a real hedge rule
on its senior loan.

## Conformance impact

No existing fixture changes. `conformance/hedge/0070-ambiguous-debt` still
pins the refusal of two `primary` blocks.

Six new cases in `conformance/hedge/`, each derived from `0070-ambiguous-debt`
or `0070-explicit-escrow` by editing only roles, keys and (in one case) the
hedge:

| Case | Expected codes | Verification |
|---|---|---|
| `0075-senior-junior-outright` | none | `verified` |
| `0075-senior-junior-escrow` | none | `not_checked/not_applicable` |
| `0075-junior-keyed-base` | none | `verified` |
| `0075-two-seniors` | HDG-08 | `unverifiable/unresolvable_source` |
| `0075-malformed-hedge-beside-junior` | ESC-04, HDG-01 | `unverifiable/invalid_structure` |
| `0075-junior-only-hedge` (D3) | none | `not_checked/not_applicable` |

Each case also runs through the v2 driver as `replacement-funding/0075-*`.
Against the implementation before this RFC, every case fails except
`0075-two-seniors`, which pins behavior this RFC keeps.

## Reference implementation

- **Files affected:** `packages/uwmd-core/src/protocol.ts`, `validator.ts`,
  `replacement-funding-structure.ts`; `scripts/gen-conformance-cases.mjs`.
- **API surface:** the eleven table entries above. Nothing else.
- **Test plan:** a surface test pins the whole `CROSS_CHECK_ROLE_PREFERENCE`
  table to §5.3. Validator tests show the senior read beside a junior, under a
  junior keyed `base`, over a `primary`, and the D3 non-read. A structure test
  covers each new fixture. The undecided case below is pinned in a unit test
  labelled undecided and kept out of conformance.

## Alternatives considered

| Alternative | Reason not selected |
|---|---|
| Keep the literal reading (issue reading 1): a senior/junior document must key its senior `default` or `base` | The result depends only on a variant name. It contradicts CC-02/03/05/09 on the same document, and a junior keyed `base` lets the senior's outright funding pass unchecked. |
| One family key, such as `HDG-*`, instead of per-rule entries | The table is keyed per rule (RFC 0040, RFC 0066). A wildcard key would be the first, and every consumer that looks up a code would need to learn it. |
| Refuse when a non-selected block states a `rate_hedge` (instead of D3) | A new MUST with no precedent. RFC 0040 never inspects non-selected blocks, and RFC 0070 explicitly defers tranche-specific hedges. A refusal here would be a first step towards them without their contract. |
| Read every block's hedge (per-tranche hedges) | RFC 0070 defers multiple-tranche ownership to a separate adopter-backed contract. ESC-04 and HDG-05 tie one hedge to one property-level `sources_uses`; several hedges would need their own rules. |
| Prefer `senior`, then fall back to the junior's hedge when the senior states none | A role-dependent fallback across blocks, which RFC 0040 forbids ("never … guess"). |

## Unresolved questions

1. **What the synchronous hedge checks report when the debt selection still
   refuses** (for example, two `senior` blocks). Today the hedge pass reads
   no hedge at all:
   - if any block states `replacement_funding`, HDG-08 is reported;
   - otherwise HDG-01–HDG-06 report nothing, and CC-16 names only the
     cross-checks;
   - ESC-04 sees no hedge, so a `rate_cap_replacement` escrow is reported as
     an escrow without `replace` (`found undefined`), even when the stated
     hedge says `replace`.

   The last item is misleading, but it is a consequence of the refusal, not
   of the missing preference, and the spec does not say what should happen
   instead. The options are to join CC-16's skip record, to report HDG-08
   for any stated hedge, or to stay silent. Each is a new MUST. This RFC does
   not decide it. `validator.hedge.test.ts` pins today's outcome in tests
   labelled undecided, outside conformance. A follow-up RFC can choose.
   Draft [RFC 0076](0076-hedge-checks-under-refused-selection.md) proposes
   an answer. It also covers the same defect when `sources_uses` refuses.

## Prior art

- [RFC 0040](0040-variant-role-resolution.md): per-rule role preferences, and
  refusal on a consulted role collision.
- [RFC 0066](0066-calc-identifier-variant-resolution.md) D2: lender-side
  metrics declare `senior`, keyed per calculation.
- Lender practice: an interest-rate cap is a condition of the floating-rate
  senior loan, and the cap's notional and strike are sized to that loan.
