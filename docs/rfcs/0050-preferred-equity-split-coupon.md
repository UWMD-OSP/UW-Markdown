---
rfc: 0050
title: Preferred equity with a split coupon (current-pay and accrued on one tranche)
status: draft
author: jaredmaxey
created: 2026-09-13
affects:
  - format-spec
  - core-library
  - conformance-corpus
---

# RFC 0050: Preferred equity with a split coupon (current-pay and accrued on one tranche)

## Summary

A `capital_stack` tranche today carries one `rate` and one `accrual` mode (`cash` or
`accrued`). Institutional preferred equity is routinely written with **both**: a current-pay
coupon distributed from operating cash and a second coupon that accrues (PIK) on the
outstanding balance and is redeemed at a capital event. This RFC adds an optional
`accrual: "split"` mode with two rate fields, defines exactly how the two parts enter the
§4.24 sizing verbs (the cash-pay part enters `blended_coverage`; the accrued part does not),
and adds one conformance fixture. Documents that do not use `split` are byte-identical and
verify identically to today.

## Motivation

`UW_FORMAT_SPEC_v1.md` §4.24 ("Tranches") states: `rate` is "the coupon (debt) or preferred
return (pref), as a fraction. REQUIRED for every debt tranche and for `preferred_equity`" and
`accrual` is "`cash` (current-pay; enters cash coverage) or `accrued` (PIK; compounds on
balance and does not enter cash coverage)". One tranche, one rate, one mode.

A preferred-equity position with an 8% current coupon and a 4% accruing coupon on the same
$4,000,000 (a common term sheet) therefore has no valid encoding:

- Stating `rate: 0.12, accrual: "cash"` overstates the cash burden and misstates coverage.
- Stating `rate: 0.12, accrual: "accrued"` hides the real cash distribution.
- Splitting the principal into two tranches (`pref_cash` $4,000,000 at 8% cash and
  `pref_pik` $4,000,000 at 4% accrued) double-counts the capital in `debt_yield_through`-style
  attachment metrics and in `sources_uses` reconciliation, and violates "Positions MUST be
  unique within the stack" unless the two are given different positions, which misstates
  seniority.

The producer that hit this is the StackUW engine's preferred-equity module (app task
TASK-1215, held on 2026-09-13 precisely because the record cannot carry the layer; the
skeptic read is on that task file). The engine will not state a figure the record cannot
carry, so the protocol moves first.

## Proposed change

### §4.24 Tranches - new fields (format-spec)

Add to the tranche object:

- `accrual` gains a third value, `split`.
- `cash_rate` - fraction; REQUIRED when `accrual` is `split`, MUST NOT appear otherwise.
- `accrued_rate` - fraction; REQUIRED when `accrual` is `split`, MUST NOT appear otherwise.
- When `accrual` is `split`, `rate` MUST equal `cash_rate + accrued_rate` (the total preferred
  return, so readers that ignore this RFC still see the headline rate). Disagreement is
  rejected (`CS-02b`, new).

Normative text to add after the existing `accrual` bullet:

> - `accrual: "split"` - the tranche pays `cash_rate` currently (enters cash coverage) and
>   accrues `accrued_rate` on its outstanding balance (compounds; does not enter cash
>   coverage). Applies to `preferred_equity`; MAY apply to debt (a PIK toggle note). When
>   `split` is stated, `cash_rate` and `accrued_rate` are REQUIRED and `rate` MUST equal their
>   sum (`CS-02b`).

### §4.24 Sizing verbs (format-spec)

The table row for `blended_coverage` currently reads "NOI ÷ Σ **cash-pay** debt service at or
above the position (accrued/PIK excluded)". Amend the definition of "cash-pay debt service"
for a `split` tranche: its cash-pay service is `amount × cash_rate` (interest-only, since
preferred equity has no amortization terms), and its accrued part contributes zero -
exactly the rule the spec already states for `accrued` tranches, applied per-part.

`debt_yield_through` is unchanged: it is a debt-only attachment metric (the spec's own
worked example says so), and a `preferred_equity` tranche - `split` or not - stays out of it.
This RFC does NOT change that; the producer's request to count pref in debt yield was
withdrawn after reading the example.

### `@uwmd/core` (core-library)

- `capitalStackTrancheSchema`: `accrual` enum gains `"split"`; `cash_rate` / `accrued_rate`
  optional numbers with the conditional-requirement refinement; `CS-02b` validator.
- `verifyCapitalStack` / the reference recompute for `blended_coverage`: cash-pay service
  of a `split` tranche = `amount × cash_rate`.
- No change to `debt_yield_through`, `ltc_through`, `ltv_through`, `weighted_cost` except that
  `weighted_cost` uses the full `rate` (total preferred return) for a `split` tranche - the
  cost of the capital is the whole coupon, however it is paid. State this explicitly in the
  `weighted_cost` row.
- Additive. No existing document changes meaning.

## Compatibility analysis

- **Existing `.uw.md` / `.uwx.md` files** - none become invalid: `split` is new and the two
  rate fields are forbidden unless it is stated. Every existing capital-stack document
  verifies to the same result (the recompute paths for `cash` and `accrued` are untouched).
- **Existing implementers** - Tier-1 readers see `rate` as before (it remains the total).
  Tier-2 editors that round-trip unknown fields keep `cash_rate`/`accrued_rate`. Tier-3
  verifiers must implement `CS-02b` and the per-part cash-pay rule to claim conformance at
  the next protocol minor.
- **Modules** - no manifest schema change.

## Conformance impact

One new tier-3 fixture: a multifamily deal with senior debt, a `$0` mezz sleeve and a funded
`preferred_equity` tranche `accrual: "split"` (`cash_rate: 0.08`, `accrued_rate: 0.04`,
`rate: 0.12`), stating `combined_dscr` (`blended_coverage`, through the pref position) and
`weighted_cost`. Negative controls: (a) `split` without `accrued_rate` → `CS-02b`; (b)
`rate` ≠ sum → `CS-02b`; (c) `combined_dscr` stated as if the full 12% were cash-pay →
`CS-SIZING-DISAGREES`.

## Reference implementation

- **Files affected:** `spec/UW_FORMAT_SPEC_v1.md` (§4.24 tranches, sizing table, worked
  example note), `spec/schemas/section-capital-stack.schema.json`, `packages/core/src/`
  capital-stack schema and verifier, one conformance fixture + expected results, CHANGELOG.
- **API surface:** no new exports; the tranche type gains three optional fields.
- **Test plan:** schema round-trip for `split`; `CS-02b` both directions; the fixture's
  `combined_dscr` recompute equals the stated value; the three negative controls fail with
  the named codes; the full existing corpus is byte-identical in results.

## Alternatives considered

- **Two tranches sharing one position** (`pref_cash` + `pref_pik`): violates position
  uniqueness or misstates seniority, and double-counts capital in attachment metrics and
  `sources_uses`. Worse on every axis.
- **`accrual: "accrued"` with a `cash_rate` side-field only**: fewer fields, but `rate` would
  then mean "accrued part" for some tranches and "total" for others - readers could not tell
  without this RFC. Keeping `rate` as the total is the compatibility property worth paying
  two fields for.
- **Encode the pref in the waterfall section instead**: `x_partnership_waterfall` is where
  LP/GP distribution lives, but the capital stack is where coverage and attachment are stated
  and verified; a pref that pays cash affects coverage and must sit in §4.24.

## Unresolved questions

- Should `split` be permitted on debt tranches with amortization terms (a PIK toggle on an
  amortizing note), or restricted to `io_months == term_months`? Proposed: permitted only
  when the tranche is interest-only for its term; otherwise `CS-02b`. Reviewers decide.
- Compounding frequency of the accrued part is not stated in §4.24 today for `accrued`
  tranches either; this RFC inherits that gap rather than fixing it, and notes it for a
  follow-up.

## Prior art

- RFC 0033 (capital stack is one point in time) - the section this extends.
- The spec's own worked example (§4.24, "the pref tranche is `accrued`, so it is excluded
  from `combined_dscr`") - the per-part rule here is that sentence applied to half a tranche.
- ARGUS Enterprise and most institutional models carry "current pay" and "accrued" as two
  rates on one preferred-equity line; this RFC matches that convention so producers do not
  have to split principal to describe a common instrument.
