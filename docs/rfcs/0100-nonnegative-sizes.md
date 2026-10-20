---
rfc: 0100
title: Refuse negative sizes, counts, areas and rents
status: draft
author: claude-code
created: 2026-10-20
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0100: Refuse negative sizes, counts, areas and rents

> **Draft for owner acceptance.** Jared ruled on issue
> [#415](https://github.com/UWMD-OSP/UW-Markdown/issues/415) on 2026-10-19:
> "draft an RFC forbidding negative sizes." It adds a validation rule that
> existing documents could fail, so it opens as a draft. Implementation follows
> acceptance.

## Summary

A closed list of size, count, area and rent fields gains a fixed contract. Each
stated value MUST be a finite number ≥ 0, and a count MUST also be an integer. A
stated value that breaks the contract is `CLS-04`, the existing "stated official
field violates its fixed field contract" error. The list is every registered
primary and secondary size (Protocol §XIII.1 / `size_intensives`) and the §4.3
rent-roll counts, areas and rents that #415 found unpoliced. The metric
dictionary's per-size metrics also become `unverifiable` when their size
denominator is ≤ 0, so no Verifier divides by an impossible size. Signed amounts
keep their meaning: concessions, credits, losses and cash-flow lines are
untouched.

## Motivation

Bug bash pass 2b (#415) set every size-like leaf in `property`, `rent_roll` and
the class sections of the 13 class examples negative, one at a time. 85 of 98
mutants produced no new finding, and `uwmd verify` reported `OK`. Only the
class-specific blocks police their counts: `mhc_sites` (`CLS-04`,
`CC-MH-01…03`), `dc_capacity` (`CLS-04`, `CC-DC-*`), student-housing beds
(`BED-01/02`) and hospitality `keys`. The generic sizes in §4.1 and the §4.3
rent-roll figures are listed without bounds. The dictionary divides by them, as
in `price_per_unit = valuation.purchase_price / property.total_units`, so a
record with `total_units: -180` "verifies" a price per unit of −266,666.67.

The same quantity is also policed in one home and not in its twin:
`mhc_sites.total_sites` is checked and `rent_roll.total_sites` is not.

## Proposed change

### 1. The contract

Format §4.1 and §4.3 gain one normative rule each, and Format §5 gains the
table below:

> A stated value of a field in the **size contract table** MUST be a finite JSON
> number ≥ 0; a field marked *count* MUST also be an integer (a JSON number with
> no fractional part; `1.0` and `1e0` are integer 1, as RFC 0094 reads
> revisions). A stated value that breaks this is `CLS-04` (error) at that field.
> `null` and absence keep their existing meaning: absence is not a finding, and
> stage readiness owns missing facts (§5.1).

| Field | Kind |
|---|---|
| `property.total_units`, `property.keys`, `property.total_beds`, `property.total_sites`, `property.rentable_units`, `property.entitled_units` | count |
| `property.total_nra_sqft`, `property.rentable_square_feet`, `property.gross_leasable_area`, `property.net_rentable_square_feet`, `property.critical_it_load_kw`, `property.gross_acres`, `property.usable_acres` | area / capacity |
| `property.parking_spaces` | count |
| `property.land_area_sqft`, `property.land_area_acres`, `property.site_acres` | area |
| `rent_roll.total_units`, `occupied_units`, `vacant_units`, `notice_units`, `model_units`, `down_units`, `month_to_month_units` | count |
| `rent_roll.total_sites`, `occupied_sites`, `vacant_sites`, `park_owned_homes` | count |
| `rent_roll.total_beds` and `rent_roll.unit_mix[].units`, `.beds`, `.occupied_beds` (student housing) | count |
| `rent_roll.total_rentable_sf`, `occupied_sf`, `vacant_sf`, `tenants[].leased_sf`, `units[].sqft`, `unit_mix_summary[].avg_sqft` | area |
| `rent_roll.unit_mix_summary[].count`, `lease_expiration_schedule[].expiring_count` | count |
| `rent_roll.weighted_avg_rent_psf`, `tenants[].rent_psf`, `units[].monthly_rent`, `units[].market_rent` | rent |

The table is **closed**, and each field keeps its existing path and meaning. A
class's own contract (`mhc_sites`, `dc_capacity`, `BED-*`, `keys`) is unchanged
and keeps its own code. Where a class rule already reports the same field, both
findings stand, because they are different rules.

### 2. Dictionary denominators

Every dictionary metric whose formula divides by a registered size (primary or
secondary) resolves to `null` (`unverifiable`) when that size is ≤ 0. Zero
already yields a nonfinite result and is unverifiable; this rule makes the
negative case the same, so a Verifier never confirms a figure against an
impossible size. It is expressed through the existing `null_semantics` member,
which gains one closed value, `positive_size_denominator`.

### 3. Protocol

§XI's `CLS-NN` row notes the size contract. The validation-code registry
description of `CLS-04` gains "or a stated size/count/area/rent in the Format §5
size contract table is negative or, for a count, not an integer".

## Compatibility analysis

- **Documents.** A record stating a negative listed field, or a fractional
  count, now fails validation. That is the defect being fixed. None of the 13
  class examples states one (the #415 pass at `main` `902695e0`). The
  implementation PR measures the conformance corpus the same way and lists any
  fixture it must change. No compatibility path is added
  (PROCESS principle 5).
- **Signed amounts** are out of scope by construction: concessions
  (`concessions_monthly`, the lease-up `concessions: -5400` example), credits,
  loss-to-lease and every cash-flow line keep their signs.
- **Implementers.** Validators add one closed table check. The Python
  implementation (#354) adopts it in the synchronized implementation.
- **Versions.** None allocated (RFC 0091 D6).

## Conformance impact

New cases under `conformance/documents/malformed/`, synthetic: one negative
value per kind (count, area, capacity, rent), a fractional count, and a negative
twin (`rent_roll.total_sites` against a valid `mhc_sites.total_sites`). Each
owes `CLS-04` at the field. One clean control states zero for a secondary size
(`property.entitled_units: 0`), which is valid. A dictionary case shows
`price_per_unit` as `unverifiable` with `total_units: -1`.

## Reference implementation

- `validator.ts` / `builtin-class-validation.ts`: one table-driven pass over the
  current `property` and `rent_roll` blocks, emitting `CLS-04` per failing field.
- `metric-dictionary` / `calc`: honor `positive_size_denominator`.
- Python: the same table and denominator rule.
- Tests: one per row kind, the twin case and the zero control.

## Alternatives considered

- **A new code family** (`SIZE-01`). Clearer in a code list, but `CLS-04`
  already means "a stated official field violates its fixed field contract", and
  the class contracts use it for exactly this kind of bound. A new family would
  split one idea across two codes. Recorded as D2 so the owner can choose it.
- **Bound every numeric field ≥ 0.** Wrong: concessions, credits, losses and net
  cash flows are signed by design.
- **Forbid zero for primary sizes.** A land or pre-development deal can state
  zero units or entitled units legitimately. Zero is already unverifiable as a
  denominator, so forbidding it adds a refusal without protecting any figure.
- **Infer bounds from field names** (`*_sf`, `*_units`). Rejected: a closed
  vocabulary is the house pattern, and names like `concessions_units` would be
  wrong guesses.

## Unresolved questions

- **Upper and relational bounds** (`occupied_units ≤ total_units`, occupancy in
  [0, 1]) are a separate consistency family. Some exist for classes
  (`CC-MH-02`, `BED-*`). Generalizing them is a follow-up.
- **Section fields not in the table** that later prove to be sizes join it by a
  table change under this RFC's rules.

## Decisions proposed for owner review

| # | Question | Proposal | Why (precedent) |
|---|---|---|---|
| D1 | Scope | Closed table: registered primary/secondary sizes, plus §4.3 rent-roll counts, areas and rents | #415 evidence; closed vocabularies |
| D2 | Code | `CLS-04` (error) | Existing "fixed field contract" code; alternative `SIZE-01` |
| D3 | Zero | Admissible | Legitimate for land/pre-development; already unverifiable as a denominator |
| D4 | Counts | Integer (JSON number with no fractional part) | RFC 0094's integer reading for revisions |
| D5 | Denominators | `null`/`unverifiable` when the size is ≤ 0 (`positive_size_denominator`) | No Verifier confirms a figure against an impossible size |
| D6 | Signed amounts | Out of scope | Concessions/credits/losses are negative by design |
| D7 | Versions | None allocated; prelaunch 4.x | RFC 0091 D6 |

## Prior art

- JSON Schema `minimum` / `type: integer` express exactly this contract, and the
  class section schemas (`section-mhc-sites`, `section-dc-capacity`) already
  carry it. This RFC extends the same contract to the generic sections.
- RFC 0094 of this project: present-invalid values are refused, with no coercion.
