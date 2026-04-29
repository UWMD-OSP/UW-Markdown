---
rfc: 0008
title: Lease-up modeling section for value-add and ground-up deals
status: draft
author: jared
created: 2026-04-27
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0008: Lease-up modeling section for value-add and ground-up deals

## Summary

Add a `lease_up_schedule` section to the format spec that models the trajectory from current to stabilized rents over a defined window. Today the format jumps straight from `rent_roll` (a snapshot in time) to `noi_model` (a stabilized projection) with no structured representation of the path between them. This RFC defines a section that captures monthly or quarterly rent rolls during the lease-up phase, plus the assumption set that drives them.

## Motivation

Two of the most common scenarios in CRE underwriting cannot be cleanly represented today:

1. **Value-add multifamily** — the buyer's rent_roll is the current snapshot but the underwritten NOI assumes 18 months of natural turnover at higher rents. The path from one to the other (turnover rate, market rent assumption, vacancy during lease-up, capex per unit) is the entire investment thesis, but there is no section to put it in.
2. **Ground-up development / lease-up of new construction** — there is no rent_roll at acquisition (the building doesn't exist yet); just a projected month-by-month absorption curve. Today this gets stuffed into `extensions` or `_notes` with no structure.

Without a normative section, every implementer reinvents the schema. The Riverside office example (added in this same release) had to put its lease-up assumptions in `deal_context._notes` rather than a structured block.

## Proposed change

### Format spec (UW_FORMAT_SPEC_v1.md §4.X)

Add `lease_up_schedule` as a new standard section:

```json uw:section=lease_up_schedule source=user ts=... v=1
{
  "_meta": { ... },
  "model_type": "natural_turnover" | "absorption_curve",
  "stabilization_target_date": "YYYY-MM-DD",
  "assumptions": {
    "monthly_turnover_rate_pct": 0.04,
    "market_rent_psf_at_stabilization": 22.00,
    "vacancy_during_lease_up_pct": 0.18,
    "concession_months_per_lease": 1,
    "tenant_improvement_psf": 35.00,
    "leasing_commission_pct": 0.06
  },
  "schedule": [
    {
      "period": "2026-Q3",
      "occupied_sf": 31000,
      "leased_sf": 31000,
      "in_place_rent_psf": 21.50,
      "market_rent_psf": 22.00,
      "vacancy_pct": 0.27,
      "rent_revenue": 166375,
      "concessions": -5400,
      "ti_lc_capex": -42500,
      "net_cash_flow": 118475
    },
    { "period": "2026-Q4", ... }
  ],
  "stabilized_summary": {
    "occupied_sf": 40500,
    "occupancy_pct": 0.953,
    "annualized_egi": 858000,
    "annualized_noi": 478000
  }
}
```

### Protocol spec

Add a cross-section consistency check (proposed code `CC-11`):

> The final period in `lease_up_schedule.schedule` MUST agree (within 2%) with the values in `noi_model` when `noi_model._meta.scenario == "stabilized"`. If they disagree, the validator emits `CC-11` with severity `warning`.

### Calc engine

No new builtins are needed. The schedule is data, not formulas — the existing `path` traversal (`lease_up_schedule.schedule[5].rent_revenue`) and `sum()` builtin let custom calculations roll up the schedule.

## Compatibility analysis

- **Existing `.uw.md` files** — unaffected. The new section is opt-in.
- **Tier-1 Reader** — additive. Readers MUST parse `lease_up_schedule` as a generic section block; rendering is implementation-defined.
- **Tier-2 Editor** — additive. Editors that don't understand the section can still edit it as opaque JSON.
- **Tier-3 Calc Host** — additive. The new path traversal works with the existing AST.
- **Tier-4 Agent Host** — additive.
- **Modules** — modules that already define their own lease-up extension sections (e.g. a hospitality module's RevPAR ramp) keep working because extension sections coexist with standard sections.

No existing files break.

## Conformance impact

Existing fixtures: none change.

New fixtures to add:

- `conformance/tier-1-reader/fixtures/03-value-add-lease-up.uw.md` — multifamily value-add deal with a 24-month natural-turnover schedule. Validates that the section parses correctly and `CC-11` does not trip when stabilized values agree.
- `conformance/tier-1-reader/malformed/04-lease-up-stabilized-mismatch.uw.md` — schedule's final period disagrees with `noi_model` by 8%; expects `CC-11` to fire.

## Reference implementation

- **Files affected:**
  - `spec/UW_FORMAT_SPEC_v1.md` — new §4.X.
  - `packages/uwmd-core/src/types.ts` — type for the schedule entries.
  - `packages/uwmd-core/src/validator.ts` — implement `CC-11`.
  - `packages/uwmd-core/src/protocol.ts` — `BUILTIN_REMEDIATIONS` entry for `CC-11`.
  - `packages/uwmd-core/src/renderer.ts` — render the schedule as a table in the chat / summary outputs.
- **API surface:**
  - New exported type `LeaseUpSchedulePeriod`.
  - `getSection(parsed, 'lease_up_schedule')` returns the new shape.
- **Test plan:**
  - Unit test: parse + validate a valid lease_up_schedule with no issues.
  - Unit test: validate trips `CC-11` when stabilized vs noi_model diverge >2%.
  - Renderer test: chat-format render includes a period-by-period table.

## Alternatives considered

1. **Stuff lease-up into `assumptions`.** The status quo for some implementers. Worse because: assumptions are scalars + flat ratios; a period-by-period schedule is fundamentally tabular and gets crushed when forced into that shape.

2. **Use `extensions` or an `x_lease_up` section.** Worse because: every implementer reinvents the schema, defeating the format's interoperability promise. This is exactly the case the spec's "promote to standard section" path (Appendix C.7) was built for — the demand pattern is uniform across asset classes.

3. **Extend `noi_model` with a `pre_stabilization_periods` array.** Worse because: it conflates the snapshot model (stabilized year-1 NOI) with the trajectory model (path to stabilization). Two distinct concepts deserve two sections.

## Unresolved questions

- Granularity: monthly vs. quarterly periods. Suggest allowing both via a `period_granularity` field, defaulting to `quarterly`. Some lenders model monthly during lease-up; some model quarterly. Forcing one is unfriendly.
- Should the schedule support multiple scenarios (base / upside / downside)? Probably yes, via the existing multi-variant section pattern (like `operating_statement`). Defer the variant key naming to implementation.
- Interaction with `dcf` cash flows: should the lease-up schedule auto-feed `dcf.annual_cash_flows[0..N]`? Useful but adds coupling. Recommend defining the data shape now and adding a `derive_dcf_from_lease_up()` calc in a follow-up RFC.

## Prior art

- Argus's "Tenant Schedule" combined with "Vacancy Allowance" curves model the same trajectory with a tighter coupling to cash-flow generation.
- Excel-based underwriting models almost universally have a "Lease-Up" tab; this RFC just gives that tab a normative schema.
- The hospitality RFC (0006) already has a similar `revpar_ramp` concept — the two should share the period structure once both land.
