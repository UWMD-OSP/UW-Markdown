---
uw_lite_version: 1.0
deal_id: uw_lite_decimal_exact
deal_name: Saguaro Terrace
created: 2026-08-25T00:00:00Z
created_by: conformance
asset_class: multifamily
---

# Acquisition

- Purchase price: $10,000,000 <!-- uw:acquisition.purchase_price -->

# Valuation

- Going-in cap rate: 5.51% <!-- uw:valuation.going_in_cap_rate scenario=base -->

# Financing

- Interest rate: 6.19% <!-- uw:debt.interest_rate -->

# Assumptions

- Rent growth: -2.47% <!-- uw:assumptions.rent_growth -->
- Year 1 vacancy: 3.07% <!-- uw:assumptions.vacancy.year_1 -->

Every percent in this fixture is a literal whose value under naive division
(`Number(p) / 100`) lands one ULP away from the double its fraction spelling
denotes — `5.51 / 100` is `0.055099999999999996`, not `0.0551`. RFC 0025
requires normalization by decimal-point shift, so the canonical form must
carry the exact fraction. The other Lite fixtures all use cleanly-dividing
percents and pass unchanged through either implementation; this one exists so
the corpus can tell them apart.
