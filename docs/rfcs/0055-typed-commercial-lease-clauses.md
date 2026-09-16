---
rfc: 0055
title: Type the commercial lease clauses that already have stubs
status: draft
author: claude
created: 2026-09-15
depends_on:
  - 0053
  - 0054
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0055: Typed commercial lease clauses

## Summary

RFC 0054 decided that lease clauses are attributes of a lease and belong on the
lease record rather than in a period series. This contract carries that out:
it types the stubs the commercial rent roll has carried since Format 1.0, adds
the leasing-commission balance that sits missing beside the tenant-improvement
one, and registers an `LSE-NN` validator family.

It also corrects two format passages that describe an addressability the calc
engine does not have.

Everything is optional and verified, never derived. No rent is escalated, no
break is exercised, and no balance is amortized.

## Motivation

`rent_roll`'s commercial variant already names the clauses that decide a
commercial deal, and leaves them as untyped nulls:

```json
"escalation_type": "fixed_pct | cpi | fixed_dollar | none | null",
"escalation_rate_pct": null,
"escalation_schedule": null,
"termination_option": null,
"co_tenancy_clause": false,
"co_tenancy_details": null,
"ti_allowance_original": null,
"ti_outstanding_balance": null,
"cam_cap_pct": null
```

This is the RFC 0053 situation again. A producer with a real rent roll has a
step schedule, a break date with a notice period and a penalty, and a
co-tenancy trigger with a remedy — and the only place to put any of it is a
free-text `notes` field or a `null`. Nothing can be compared across deals and
nothing can be checked.

Two of these are also where commercial underwriting goes wrong quietly. A break
option that nobody models turns a ten-year WALT into a five-year one. A
co-tenancy clause with no stated remedy hides the fact that an anchor departure
re-prices half the rent roll.

The leasing commission has no field at all. `ti_allowance_original` and
`ti_outstanding_balance` exist; `lc_*` does not, so the other half of the
capital a lease costs to sign cannot be stated beside it.

## Proposed change

Every member below is OPTIONAL on a tenant record. A document stating none of
them validates exactly as it does today. Rates are fractions, not percents.

### 1. `escalation_schedule` — the explicit steps

```ts
interface RentStep {
  effective_date: string;      // YYYY-MM-DD
  base_rent_annual: number;    // the rent from this date, not the increment
}
```

Stating the resulting rent rather than the increment is deliberate: a reader
should not have to compound a list of percentages to learn what a tenant pays in
year six, and a producer should not have to agree with us about rounding to be
verifiable.

| Code | Rule |
|---|---|
| `LSE-01` | Steps are strictly increasing by `effective_date`, each a real date, with `base_rent_annual` finite and nonnegative. |
| `LSE-02` | Every step lies within `[lease_commencement, lease_expiration]` when both are stated. |
| `LSE-03` | A schedule requires `escalation_type` to be stated and not `none`. A flat lease does not carry a step schedule. |

The schedule does not have to begin at commencement — a lease whose first bump
is in month 13 states one step, not two.

### 2. `termination_option` — the break

```ts
interface TerminationOption {
  earliest_date: string;        // YYYY-MM-DD
  notice_months: number;        // integer, >= 0
  penalty: number | null;       // stated cash, null when genuinely none
  penalty_includes?: Array<'unamortized_ti' | 'unamortized_lc' | 'free_rent' | 'fee'>;
  conditions?: string;          // author narrative; nothing is inferred from it
}
```

| Code | Rule |
|---|---|
| `LSE-04` | `earliest_date` is a real date inside the lease term, `notice_months` a nonnegative safe integer, and `penalty` finite and nonnegative when stated. |
| `LSE-05` | `penalty_includes` entries come from the closed list, without duplicates. |

`penalty_includes` records what the stated penalty is composed of. It does not
recompute it: unamortized balances are periodic, which RFC 0054 placed outside
this contract.

### 3. `co_tenancy_details` — the trigger and the remedy

```ts
interface CoTenancyDetails {
  trigger: 'named_tenant_departure' | 'occupancy_threshold' | 'both';
  named_cotenants?: string[];       // required when trigger names tenants
  occupancy_threshold?: number;     // a fraction; required when trigger is occupancy
  remedy: 'rent_reduction' | 'alternate_rent' | 'termination_right';
  remedy_value?: number;            // fraction for reduction, cash for alternate rent
  cure_period_months?: number;      // integer, >= 0
}
```

| Code | Rule |
|---|---|
| `LSE-06` | `co_tenancy_details` requires `co_tenancy_clause: true`, and `co_tenancy_clause: true` requires details. The boolean and the body agree or neither is stated. |
| `LSE-07` | The trigger carries what it needs: a nonempty `named_cotenants` when it names tenants, an `occupancy_threshold` in `(0, 1)` when it is a threshold, both when it is `both`. |
| `LSE-08` | `remedy_value` is required for `rent_reduction` and `alternate_rent` and refused for `termination_right`; a reduction is a fraction in `(0, 1]`, an alternate rent is nonnegative. |

`LSE-06` is the same move `TAX-04` made for `sale_triggers_reassessment`: a
boolean that asserts nothing until something has to agree with it.

### 4. Leasing commissions beside tenant improvements

Add `lc_original` and `lc_outstanding_balance`, mirroring the existing TI pair.

| Code | Rule |
|---|---|
| `LSE-09` | TI and LC amounts are finite and nonnegative, and an outstanding balance never exceeds its original. |

This states the balances. It does not amortize them — RFC 0054 placed the
roll-forward in the deferred period series, and straight-line amortization waits
for that contract.

### 5. Correct the addressability claim (RFC 0054)

Format §4.25 and §4.26 both claim these structures stay "addressable by ordinary
path traversal," citing `lease_up_schedule.schedule[5].rent_revenue` and
`cash_flow_series.series[3].amount`. Neither parses: calc paths are flat
identifiers and both expressions raise `CALC-PARSE-001`.

Replace the claim with what is true — the structures are read by verifiers and
by host code, not by pack formulas — so no future decision rests on an
addressability the engine does not offer.

## Compatibility

Purely additive. Every member is optional, no existing field changes shape, and
no existing fixture moves. The `LSE-NN` codes are new and fire only on documents
that state the new members. `escalation_type`, `co_tenancy_clause`,
`ti_allowance_original` and `ti_outstanding_balance` keep their current meaning
and gain only the agreement rules above.

Format minor and Protocol minor. No package API is removed.

## Out of scope

- **Amortization of TI or LC**, and the balance roll-forward. Periodic; deferred
  by RFC 0054.
- **Exercising anything.** No break is taken, no co-tenancy remedy applied, no
  step projected into NOI. These are stated terms, not a model.
- **CAM true-ups and recovery reconciliation.** Periodic.
- **Residential leases.** The multifamily variant is unit-level and
  month-to-month and shows no equivalent need.
- **`cam_cap_pct`**, which is already a typed number and needs nothing.
- **Percentage rent, sales kick-outs, and exclusive-use clauses.** Real, but no
  stub exists and no producer has asked; they want their own vocabulary.

## Conformance

- A tenant with a four-step escalation, a break option, a co-tenancy clause and
  TI/LC balances validates clean.
- Steps out of order, duplicated, or outside the lease term each refuse
  `LSE-01`/`LSE-02`.
- A schedule beside `escalation_type: "none"` refuses `LSE-03`.
- A break date after expiration, a fractional `notice_months`, and a negative
  penalty each refuse `LSE-04`; a duplicated `penalty_includes` entry refuses
  `LSE-05`.
- Details without the boolean, and the boolean without details, both refuse
  `LSE-06`.
- Each trigger missing its required companion refuses `LSE-07`.
- A `termination_right` carrying a `remedy_value`, and a `rent_reduction`
  without one, both refuse `LSE-08`.
- An outstanding balance above its original refuses `LSE-09`, for TI and for LC.
- A document stating none of the new members is unchanged, and the existing
  corpus passes untouched.
