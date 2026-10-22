---
rfc: 0117
title: Extend the size contract to mixed-use component sizes and guard the per-size component metrics
status: accepted
author: UWMD maintainers
created: 2026-10-22
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0117: Extend the size contract to mixed-use component sizes and guard the per-size component metrics

> **Accepted by the owner, 2026-10-22 (second set), as drafted.** Origin: owner ruling of 2026-10-22 (5), taking
> option 1 on bug bash finding #490 (a residual of #415 / RFC 0100). It extends
> a closed table and changes when dictionary metrics are verifiable, so it is
> normative.

## Summary

RFC 0100 made every field in the Format §5.5 size contract table refuse a
negative or non-finite value (`SIZE-01`). It also made the per-size dictionary
metrics `unverifiable` when the size they divide by is stated below zero
(`positive_size_denominator`). The table covers `property` and `rent_roll`. It
leaves out the mixed-use `components` slots, which carry their own sizes.

So `components.retail.nra_sqft: -18000` validates clean, and the engine
computes `retail_price_psf = -333.33`. This RFC adds the component size fields
to the table and marks the eight component per-size metrics
`positive_size_denominator`.

## Change

1. **Format §5.5 table gains one row** for the `components` section, on every
   component slot (`components.<class>.` for each admissible class key):

   | Field | Kind |
   |---|---|
   | `total_units`, `total_beds`, `total_sites` | count |
   | `nra_sqft`, `critical_it_load_kw` | area / capacity |

   Each field keeps its existing meaning in `section-components.schema.json`.
2. **Dictionary.** These eight mixed-use per-size entries take
   `null_semantics: positive_size_denominator`. Their formulas and `round_to`
   are unchanged:
   - `multifamily_price_per_unit`
   - `retail_price_psf`, `office_price_psf`, `industrial_price_psf`,
     `self_storage_price_psf`
   - `student_housing_price_per_bed`
   - `data_center_price_per_kw`
   - `manufactured_housing_price_per_site`

   Each divides by a component size that row 1 registers.
3. **No other field joins the table (D2).** The pass found these silent
   fields, which no Format section defines:
   - senior housing `assisted_living_units`, `memory_care_units`,
     `licensed_beds`;
   - manufactured-housing `rent_roll.site_mix_summary[].count`;
   - `rent_roll.rentable_units`, `rent_roll.unit_mix[].occupied_units` and
     `.nrsf`;
   - `property.occupied_units`;
   - `parking_ratio_per_1000_sf`, `meeting_space_sqft`.

   They are a producer's own fields. The closed table lists Format fields only,
   so a producer that wants them checked proposes them as Format fields first.

## Validation impact

A record with a negative
component size gains `SIZE-01`, and its component per-size metrics become
`unverifiable` instead of computing a negative price. No record with lawful
sizes changes outcome.

## Conformance impact

New cases:
- a negative `components.retail.nra_sqft` (`SIZE-01`; `retail_price_psf`
  unverifiable);
- a fractional `components.multifamily.total_units` (`SIZE-01`);
- a zero component size, which is admissible but leaves the per-size metric
  unverifiable through the existing divide-by-zero rule.

No expected value of an existing case changes. The mixed-use fixtures state
positive sizes.

## Reference implementation

The Format table; `spec/metrics/builtin.json` and its generated mirror (eight
`null_semantics` values); `size-contract.ts` and the Python
`uwmd_size_contract.py` (the new rows, with the `components.<class>` path
expansion); the metric verifier's denominator registry; the cases.

## Alternatives considered

- **Add the undefined fields too.** The table would then name fields no Format
  section defines, which would make them Format fields by the back door.
  Rejected; see item 3.
- **Refuse negative sizes only through the component schema's `minimum`.** That
  is a schema-only rule with no validation code, and it breaks the single
  `SIZE-01` story. Rejected.

## Decisions

| # | Question | Proposal | Why / alternative |
|---|---|---|---|
| D1 | Which component fields | `total_units`, `total_beds`, `total_sites` (count); `nra_sqft`, `critical_it_load_kw` (area/capacity) | Every size field the component schema defines |
| D2 | Fields no Format section defines | Out of scope; listed | The table is closed over Format fields (RFC 0100) |
| D3 | Metrics guarded | The eight mixed-use per-size ids | Each divides by a newly registered size |
| D4 | Versions | None allocated; prelaunch 4.x | RFC 0091 D6 |

## Prior art

- RFC 0100 (size contract, `SIZE-01`, `positive_size_denominator`); RFC 0019
  (`components`); issues #415 and #490.
