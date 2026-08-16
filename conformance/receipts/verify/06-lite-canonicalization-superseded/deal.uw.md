---
uw_lite_version: 1.0
deal_id: uw_lite_ironwood_rev
deal_name: Ironwood Logistics (revised rate)
created: 2026-08-08T00:00:00Z
created_by: conformance
asset_class: industrial
---

# Property

- Total units: 148 <!-- uw:property.total_units -->
- Total NRA: 212,400 <!-- uw:property.total_nra_sqft -->

# Acquisition

- Purchase price: $28,750,000 <!-- uw:acquisition.purchase_price -->

# Valuation

- Going-in cap rate: 5.51% <!-- uw:valuation.going_in_cap_rate scenario=base -->

# Net operating income

- Net operating income: $1,653,125 <!-- uw:noi.net_operating_income -->

# Debt

- Loan amount: $17,250,000 <!-- uw:debt.loan_amount -->
- Interest rate: 5.51% <!-- uw:debt.interest_rate -->
- Annual debt service: $1,289,000 <!-- uw:debt.annual_debt_service -->

The rates here are deliberately `5.51%` — a percent whose display does not
divide cleanly by 100 in binary64. Under canonicalization 1.0 it normalized to
`0.055099999999999996`; under 1.1 (RFC 0025) it normalizes to `0.0551`. The
document itself is byte-identical in both eras, so the digest disagreement this
fixture produces is attributable to the rules, not to the record — the verifier
must say `unverifiable` (RCP-10), never `failed`.
