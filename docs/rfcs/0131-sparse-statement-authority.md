---
rfc: 0131
title: Preserve authored sparse-statement aggregates
status: accepted
author: UWMD maintainers
created: 2026-11-04
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0131: Preserve authored sparse-statement aggregates

**Accepted - 2026-11-04.** The owner accepted authored aggregate authority, complete-detail recomputation and whole-dollar half-away-from-zero disagreement checks.

## Rules

A finite authored aggregate remains authoritative and is preserved exactly. Recalculation requires every finite member of the full declared detail set, in the same statement, variant, period and basis. Missing, null and numeric strings never stand for zero. Explicit zero qualifies. A known-empty set sums to zero only when its emptiness is explicitly established.

Complete detail is independently computed and compared with the authored aggregate at the existing reporting precision: whole dollars, half away from zero, without an additional tolerance. Disagreement reports the location, authored value and computed value; it never silently replaces the source. Without an authored aggregate, only complete detail supplies a subtotal. Missing prerequisites leave dependent NOI and ratios unavailable, with a reason.

## Declared reference detail sets

- `income.other_income`: `laundry`, `parking`, `pet_fees`, `late_fees`, `storage`, `utility_reimbursements`, `cable_internet`, `vending`, `lease_termination_fees`, `insurance_proceeds`, `other`.
- `expenses.utilities`: `electric`, `gas`, `water_sewer`, `trash`.
- EGI: `gross_potential_rent`, `less_vacancy_credit_loss`, `less_concessions`, `less_loss_to_lease`, and selected `other_income.total`.
- OpEx: `real_estate_taxes`, `insurance`, `management_fees`, `payroll_benefits`, `repairs_maintenance`, `contract_services`, `marketing_advertising`, `administrative`, `professional_fees`, `other_expenses`, and selected `utilities.total`.
- NOI: selected EGI and OpEx. Ratios require their finite numerator and nonzero denominator.

These are the Format operating-statement template detail sets, not an assertion that present numeric leaves form a complete statement. Unknown members do not expand a declared set. Custom class/profile sets require an explicit reviewed declaration before this procedure computes them. No new wire field or admission requirement is introduced.

## Reference implementation and evidence

`deriveOperatingStatement` retains authored precision and uses unrounded selected values in dependent arithmetic. Only derived reporting fields are quantized. Local starter evidence uses `diagnostics` entries with `path`, `reason` (`aggregate_mismatch` or `incomplete_detail`), `stated` and `computed`. `unavailable[path] = 'incomplete_detail'` explains an omitted computed field. This preserves the #645 evidence shape; it does not allocate a standard validation-code family. The editor exposes disagreements and preserves authored totals during edits and save/reload.

The former expected-failure gates are ordinary passing regressions, with independent controls for absent/null/string detail, explicit zero, signed ties and dependent unknowns. The current dictionary verifier continues to inspect explicit source statements read-only. This RFC does not introduce a generic full financial-statement verifier or an implicit completeness carrier.

## Decisions and precedent

Existing Format line sets establish the bounded completeness declaration. Protocol VIII.5 supplies half-away quantization; the accepted decision fixes comparison at whole dollars and introduces no new tolerance. RFC 0078 keeps editor calculation evidence in starter tooling. Source preservation follows the existing reader and edit contracts. No release is authorized.
