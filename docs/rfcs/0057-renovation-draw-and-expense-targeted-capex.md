---
rfc: 0057
title: 'The renovation draw, and capex that buys an expense reduction'
status: implemented
accepted: 2026-09-16
author: claude
created: 2026-09-16
depends_on:
  - 0041
  - 0053
  - 0056
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0057: The renovation draw and expense-targeted capex

## Summary

`sources_uses.uses` records a renovation as two numbers, `renovation_budget` and
`renovation_contingency`, and never learns whether either was spent. This
contract types the draw — what has been spent, how much of the contingency is
gone, and what remains — and adds the capital item the format has no home for
at all: a project bought specifically to reduce an operating expense.

It registers one validator family, `CAPX-NN`, on format §4.8.

Everything is optional and verified, never derived. No draw is projected, no
milestone is released, and **no stated saving is subtracted from anything**.

## Motivation

### The contingency nobody can see

A contingency is the single number a construction lender watches, and the
format cannot say whether it is intact. Two deals with
`renovation_contingency: 500000` are indistinguishable when one has drawn none
of it and the other has drawn $480,000 in month four. The second is in trouble
and the document reads identically to the first.

The roadmap asks for "used/unused amounts and total drawn with a trivial
verifier." The verifier is trivial. The absence is not.

### Capex bought to kill an expense

A $600,000 LED and controls retrofit that takes $95,000 a year out of the
utility line is a different thing from $600,000 of deferred maintenance, and
the format has no way to say which one it is looking at. `recent_capex_amount`
and `recent_capex_description` are historical narrative; `renovation_budget` is
an undifferentiated lump.

This is where underwriting quietly double-counts. An author states the saving,
reduces the utility line in `noi_model`, and a reader — or a second model built
off the same document — applies it again. **Nothing in the document currently
says whether the saving is already inside the NOI.** That disclosure is the most
valuable field in this contract, and `CAPX-07` requires it, exactly as
`TAX-08` requires `in_exit_noi` and `HDG-06` requires
`post_expiration_assumption`.

## Proposed change

Every member below is OPTIONAL. A document stating none of them validates
exactly as it does today. Rates are fractions, not percents.

### 1. `sources_uses.uses.renovation` — the draw

```ts
interface RenovationDraw {
  budget: number;                  // hard + soft, excluding contingency
  contingency: number;             // the reserve against overrun
  contingency_used: number;        // drawn from contingency to date
  contingency_remaining?: number;  // stated and verified, never derived silently
  drawn_to_date: number;           // total drawn, budget line plus contingency
  as_of_date: string;              // YYYY-MM-DD
  expense_targeted?: ExpenseTargetedCapex[];
}
```

| Code | Rule |
|---|---|
| `CAPX-01` | `budget`, `contingency`, `contingency_used` and `drawn_to_date` are finite and nonnegative; `as_of_date` is a real `YYYY-MM-DD` date. |
| `CAPX-02` | `contingency_used` does not exceed `contingency`. A contingency drawn past its size is an overrun, and calling it a contingency hides that. |
| `CAPX-03` | `drawn_to_date` does not exceed `budget + contingency`, and is at least `contingency_used`. |
| `CAPX-04` | `contingency_remaining`, when stated, equals `contingency − contingency_used` at the currency quantum. |
| `CAPX-05` | `budget` and `contingency` agree with the legacy `uses.renovation_budget` and `uses.renovation_contingency` at the currency quantum when both are stated. |

`contingency_remaining` is stated and verified rather than left to the reader's
subtraction, which is the posture RFC 0052 took with `net_sale_proceeds`: the
figure a lender quotes should be one the document can be checked against, not
one every consumer recomputes for itself.

### 2. `expense_targeted` — capex that buys a reduction

```ts
interface ExpenseTargetedCapex {
  label: string;                   // what the project is
  amount: number;                  // the capital spend
  targets: string;                 // the noi_model.expenses key it reduces
  annual_savings: number;          // stated. Never modeled, never applied.
  savings_begin: string;           // an RFC 0041 period selector
  in_noi_model: boolean;           // is this saving already inside noi_model?
  simple_payback_years?: number;   // stated and verified
}
```

| Code | Rule |
|---|---|
| `CAPX-06` | `label` nonempty; `amount` and `annual_savings` finite and nonnegative; `savings_begin` a valid RFC 0041 selector; `targets` names a key that exists under `noi_model.expenses` when that section is present. |
| `CAPX-07` | `in_noi_model` is stated as a boolean. |
| `CAPX-08` | `simple_payback_years`, when stated, equals `amount ÷ annual_savings` at four decimals, and is refused when `annual_savings` is zero. |

`targets` is checked against the keys actually present in `noi_model.expenses`
rather than a hardcoded list, so a module that adds a class-specific expense
line keeps working without touching this contract.

`CAPX-08` refuses a payback against zero savings rather than admitting
`Infinity`. A project with no stated saving has no payback period, and a number
there would be a fiction.

## Compatibility

Purely additive. Every member is optional, no existing field changes shape, and
no existing fixture moves. `renovation_budget` and `renovation_contingency` keep
their current meaning and gain only the `CAPX-05` agreement rule. The `CAPX-NN`
codes are new and fire only on documents that state the new members.

Format minor and Protocol minor. No package API is removed.

## Out of scope

- **Applying the saving.** Nothing subtracts `annual_savings` from an expense
  line, from EGI, or from NOI. `in_noi_model` records whether the author already
  did; the format states it and stops. Invariant 1 is not negotiable here, and
  this is the surface most likely to tempt someone into breaking it.
- **Projecting the draw.** `drawn_to_date` is a fact as of `as_of_date`. There
  is no S-curve, no forecast, and no remaining-to-spend schedule; a draw over
  time is periodic, which RFC 0054 placed behind a named consumer.
- **Milestone releases and lender draw requests.** Named by the roadmap as out
  of scope, and they want their own vocabulary — inspection, retainage,
  conditions precedent.
- **Discounted payback, IRR on the retrofit, or any measure needing a rate.**
  `simple_payback_years` is arithmetic over two stated numbers. Anything
  discounted needs a rate this contract does not pick.
- **Retainage and change orders.** Real, no stub exists, and neither is
  expressible as a single figure.
- **Redevelopment downtime.** Investigated for this RFC and **not needed**:
  §4.25 `lease_up_schedule` already expresses a period of suppressed occupancy
  with its own `ti_lc_capex` line, which is what downtime is. The roadmap's open
  question is answered; no new field is required.

## Conformance

- A renovation stating budget, contingency, draw and a verified remaining
  validates clean.
- `contingency_used` above `contingency` refuses `CAPX-02`.
- `drawn_to_date` above `budget + contingency`, and below `contingency_used`,
  each refuse `CAPX-03`.
- A `contingency_remaining` that does not equal the difference refuses
  `CAPX-04`.
- A legacy `renovation_budget` disagreeing with `budget` refuses `CAPX-05`.
- A `targets` naming no expense key, an empty `label`, a negative `amount` and
  a malformed `savings_begin` each refuse `CAPX-06`.
- A missing or non-boolean `in_noi_model` refuses `CAPX-07`.
- A `simple_payback_years` disagreeing with `amount ÷ annual_savings`, and one
  stated against zero savings, both refuse `CAPX-08`.
- A document stating none of the new members is unchanged, and the existing
  corpus passes untouched.
