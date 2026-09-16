---
rfc: 0053
title: Type the tax abatement schedule and the reassessment basis
status: implemented
accepted: 2026-09-15
author: claude
created: 2026-09-15
depends_on:
  - 0041
  - 0052
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0053: Tax abatements and reassessment basis

## Summary

`noi_model.expenses.real_estate_taxes` has carried two stubs since Format 1.0:
`sale_triggers_reassessment`, a boolean nothing reads, and `reassessment_basis`,
a prose string that in practice holds real arithmetic nobody checks.

This contract types both, adds an abatement schedule addressed by RFC 0041
period selectors, and names the three distinct property taxes a deal carries.
Every rule is a check on stated figures. Nothing is derived, no jurisdiction
rules are built in, and the terminal-value circularity is explicitly left to the
author — the engine has no iteration and this RFC does not give it any.

## Motivation

The corpus already shows the problem. In `02-full-multifamily`, the trailing
seller tax in `operating_statement` is `52000`, and the underwritten buyer tax
in `noi_model` is:

```json
"real_estate_taxes": {
  "value": 58000,
  "source": "reassessment_estimate",
  "sale_triggers_reassessment": true,
  "reassessment_basis": "70% of purchase price per Maricopa County methodology = $5,040,000 AV × 1.15% = $57,960, rounded to $58,000"
}
```

That string contains a complete, checkable calculation: an assessment ratio of
0.70, an assessed value of 5,040,000, a millage rate of 0.0115, an indicated tax
of 57,960, and a deliberate rounding to 58,000. Nothing verifies that
5,040,000 × 0.0115 is 57,960, that 5,040,000 is 70% of the purchase price, or
that 58,000 is a rounding of the result rather than a different number. A
producer cannot emit it as data and a reader cannot compare it across deals.
`sale_triggers_reassessment: true` sits beside it asserting nothing.

Reassessment is also where underwriting quietly goes wrong. Carrying a going-in
tax into terminal NOI overstates exit value, because the next buyer is
reassessed at what *they* pay. That error is invisible while the basis is prose.

Abatements have no representation at all. A PILOT or phase-in is a multi-year
schedule whose burn-off drives the expense line, and today it can only be
narrated.

## Proposed change

### 1. A typed reassessment basis

Add an optional `reassessment` object beside the existing fields:

```ts
interface Reassessment {
  trigger: 'sale' | 'construction_completion' | 'statutory_cycle' | 'none';
  jurisdiction?: string;      // free text; no rules are inferred from it
  value_basis?: number;       // the value the ratio applies to
  assessment_ratio?: number;  // a fraction, not a percent
  assessed_value: number;
  millage_rate: number;       // a fraction, not a percent
  indicated_tax: number;      // what the inputs above produce, before rounding
  round_to_decimals?: number; // §VIII.5 decimals, may be negative; default 2
}
```

Rates are fractions everywhere but display, as everywhere else in the format.

Checks, all at the §VIII.5 quantum with both sides quantized at the same
boundary, using the quantizer RFC 0052 exported rather than a second copy:

| Code | Rule |
|---|---|
| `TAX-01` | When `value_basis` and `assessment_ratio` are both stated, `assessed_value` equals their product. |
| `TAX-02` | `indicated_tax` equals `assessed_value × millage_rate`. |
| `TAX-03` | `real_estate_taxes.value` equals `indicated_tax` quantized at `round_to_decimals`. |
| `TAX-04` | `sale_triggers_reassessment` equals `trigger === 'sale'`. |

`round_to_decimals` is what makes an honest author's rounding checkable instead
of unexplained. The worked example above is `-3`: 57,960 quantized to the
nearest thousand is exactly the stated 58,000. Omitting it means the currency
quantum, so a value that is not rounded must foot exactly.

`TAX-04` finally gives the orphaned boolean a meaning, by making it agree with
the typed trigger rather than drift from it.

### 2. An abatement schedule on the tax line

Add an optional `abatement` object on the same expense line:

```ts
interface TaxAbatement {
  kind: 'exemption' | 'freeze' | 'pilot' | 'phase_in' | 'credit';
  program?: string;            // free text, e.g. "Arizona GPLET"
  stabilized_period?: string;  // which schedule period the stabilized value is
  schedule: Array<{
    period: string;            // an RFC 0041 selector: Y1+, YYYY-Qn, YYYY-MM, or a date
    full_tax: number;          // the unabated tax for that period
    abated_tax: number;        // what is actually paid
  }>;
}
```

| Code | Rule |
|---|---|
| `TAX-05` | Periods are valid RFC 0041 selectors, of one granularity, strictly increasing, without duplicates. |
| `TAX-06` | `0 ≤ abated_tax ≤ full_tax`, both finite; a `freeze` additionally holds `full_tax` nondecreasing. |
| `TAX-07` | When `stabilized_period` is stated it names a period in the schedule, and `real_estate_taxes.value` equals that period's `abated_tax` at the currency quantum. |

Per-period savings (`full_tax − abated_tax`) and the total over the schedule are
reported as derived evidence. The engine never writes them into the document.

The schedule documents and verifies the stated tax line. It does **not** project
it: nothing here generates per-period expense rows, and RFC 0045 continues to
take operating expenses as explicitly stated cash. `stabilized_period` is the
whole of the connection between the snapshot and the schedule, and stating it is
optional — an author modelling a stabilized year outside the abatement window
simply omits it.

### 3. Three taxes, named

The format now distinguishes what deals have always conflated:

| Tax | Where | Whose |
|---|---|---|
| Trailing | `operating_statement.expenses.real_estate_taxes` | The seller's actual. |
| Going-in underwritten | `noi_model.expenses.real_estate_taxes` | The buyer's, after their purchase triggers reassessment. |
| Terminal | `dcf.exit_analysis.terminal_tax` | The **next** buyer's, after this sale reassesses at the exit price. |

`terminal_tax` is a `Reassessment` with one added member:

```ts
interface TerminalTax extends Reassessment {
  in_exit_noi: boolean;              // is this tax already inside the stated exit_noi?
  value_basis_differs_because?: string;
}
```

| Code | Rule |
|---|---|
| `TAX-08` | When `trigger` is `sale`, `value_basis` equals `exit_analysis.exit_value_gross`, unless `value_basis_differs_because` gives a nonempty reason. |

`TAX-08` is the check that catches a going-in tax carried into terminal NOI: the
basis has to be the exit value, or the author has to say why it is not.

**The engine does not solve the circularity.** Exit value depends on the
reassessed tax, which depends on exit value. The calc engine has no iteration
and this RFC adds none. An author who wants the converged figure runs that
solve in their own model and states the result; this contract checks that what
they stated is internally consistent.

`in_exit_noi` records whether the terminal tax is already inside `exit_noi`, so
a reader is never left guessing. No arithmetic is asserted over `exit_noi`
itself: `deriveDCF` deliberately leaves `exit_value_gross` an input because it
capitalizes a *forward* year N+1 NOI the block never stores, and this RFC does
not reopen that boundary.

## Compatibility

Purely additive and opt-in. Every new member is optional; a document stating
none of them validates exactly as it does today, and no existing fixture
changes. The prose `reassessment_basis` is **retained**, not replaced —
provenance is append-only and Tier-2 edits preserve bytes. When the typed
`reassessment` is present it governs and the prose is narrative; when it is
absent, behavior is unchanged. `sale_triggers_reassessment` keeps its shape and
gains only the `TAX-04` agreement rule, which is inert without `reassessment`.

New validator codes do not change existing ones. This is a Format minor and a
Protocol minor; no package API is removed.

## Out of scope

- **Solving the exit-value/terminal-tax circularity.** Stated and verified only.
- **Jurisdiction rule libraries.** No Prop 13, no GPLET, no 421-a semantics are
  built in. `jurisdiction` is a label, and nothing is inferred from it.
- **Projecting the abatement** into per-period expense rows or an RFC 0045
  assembly. That needs a real deal first.
- **Tax appeals, contingent refunds and escrowed disputes.**
- **Income tax, capital-gains and depreciation recapture** — the assembly is
  pre-tax by contract. **Transfer tax at closing** is already RFC 0052's
  `transfer_tax` sale deduction and is not duplicated here.
- **Special assessments** (CFD, Mello-Roos, BID levies). Reserve the name
  `special_assessment` so a later RFC can define it without colliding.
- **Personal-property and business-license taxes.**

## Conformance

- The `02-full-multifamily` basis, typed: `TAX-01` through `TAX-04` all pass,
  including the `round_to_decimals: -3` rounding to 58,000.
- An assessed value that is not the ratio times the basis refuses `TAX-01`.
- An indicated tax off by one cent refuses `TAX-02`.
- A stated value that is not the declared rounding of the indicated tax refuses
  `TAX-03`; the same value with `round_to_decimals` omitted also refuses.
- `sale_triggers_reassessment: false` beside `trigger: "sale"` refuses `TAX-04`.
- A schedule with mixed granularity, a duplicate period, or a period out of
  order refuses `TAX-05`.
- `abated_tax` above `full_tax` refuses `TAX-06`; a `freeze` whose `full_tax`
  decreases refuses the same code.
- A `stabilized_period` naming an absent period refuses `TAX-07`, as does a
  stabilized value disagreeing with that period's abated tax.
- A terminal tax whose `value_basis` is the going-in purchase price refuses
  `TAX-08`; the same document passes once `value_basis_differs_because` is
  stated.
- A document stating none of the new members is unchanged, and the existing
  corpus passes untouched.
