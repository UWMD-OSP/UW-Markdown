---
uw_lite_version: 1.0
deal_id: uw_lite_decimal_exact
deal_name: Saguaro Terrace
created: 2026-08-25T00:00:00Z
created_by: conformance
asset_class: multifamily
---

## Rate assumptions

* Vacancy assumption (first year): 0.0307 <!-- uw:assumptions.vacancy.year_1 unit=fraction -->
* Annual rent trend: -0.0247 <!-- uw:assumptions.rent_growth unit=fraction -->
* Coupon: 0.0619 <!-- uw:debt.interest_rate unit=fraction -->

## Pricing

+ Basis: $10,000,000 <!-- uw:acquisition.purchase_price -->
+ Cap rate at close: 0.0551 <!-- uw:valuation.going_in_cap_rate unit=fraction scenario=base -->

The twin of `06-decimal-exact-percents`: the same five values, spelled as bare
fractions with an explicit `unit=fraction` attribute instead of percent
notation, under different labels, headings, bullets, and field order. Spec §6
excludes all of those axes from the financial canonical form, so both
fixtures must share one digest — which holds only if `5.51%` normalizes to
exactly the double `0.0551` denotes (RFC 0025).
