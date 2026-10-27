---
rfc: 0103
title: Four metric dictionary corrections — USALI F&B gross margin, data-center mark-to-market and drawn power, booked rooms revenue
status: accepted
author: UWMD maintainers
created: 2026-10-20
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0103: Four metric dictionary corrections

## Resolution

The UWMD maintainers accepted the four corrections below on 2026-10-20 to
resolve financial-audit findings M01–M04. `fb_gross_margin` uses USALI gross
margin, (revenue − cost of sales) ÷ revenue, excluding labor. `mark_to_market`
replaces `rent_index` with (market − in-place) ÷ in-place, positive for upside.
Power cost uses stated metered/measured consumption or an explicit draw factor;
an absent factor remains null, and metered tenant pass-through is net to the
landlord. Rooms revenue uses stated booked revenue, with ADR × occupancy ×
nights as a cross-check.

The rooms cross-check is `CC-HOSP-05`, with tolerance of 1% of stated revenue;
`CC-HOSP-04` is unchanged. `CC-DC-07` retains its trigger in mark-to-market
terms. A labor-inclusive margin would require a separate id. The implementation
choices below record how these accepted decisions were applied.

## Summary

Four dictionary definitions change, with their packs, Excel formulas, class
rules and fixtures:

| Metric | Before | After |
|---|---|---|
| `fb_gross_margin` (hospitality) | (F&B revenue − cost of sales − labor) ÷ revenue | (F&B revenue − cost of sales) ÷ revenue: USALI gross margin, no labor |
| `rent_index` (data center) | in-place ÷ market rent, `x` | **removed**; `mark_to_market` = (market − in-place) ÷ in-place, a fraction, positive = upside |
| `annual_facility_kwh_at_contract` (data center) | contracted IT load × design PUE × 8,760: full draw | **replaced** by `annual_facility_kwh`: metered kWh when stated, else contracted load × an explicit **draw factor** × PUE (measured when stated, else design) × 8,760; `null` without a draw factor |
| `annual_power_cost`, `power_cost_per_kw_month` (data center) | stated bill, else full-draw kWh × tariff | **zero** under `billing: metered_pass_through` (power is net to the landlord); otherwise the stated bill, else drawn kWh × tariff; `null` without either |
| `total_room_revenue`, `room_revenue_per_key` (hospitality) | ADR × occupancy × available nights | stated booked rooms revenue (`noi_model.income.rooms_revenue`), and that ÷ keys |

`CC-DC-07` tests `mark_to_market` instead of `rent_index`, with the same trigger.
A new `CC-HOSP-05` warning checks ADR × occupancy × available nights against
stated rooms revenue within 1%.

## Motivation

The 2026-10-15 audit reproduced each definition exactly and found each was
internally correct but encoded a financial choice the owner had not made:

- **M01.** The margin subtracted labor, so it was neither USALI gross margin
  (revenue less cost of sales) nor departmental profit (which subtracts all
  departmental expenses, not labor alone). A reader comparing it to an operator's
  USALI statement got a different number.
- **M02.** `rent_index` reported the subject as a share of market (0.8 = 20%
  below). Underwriters read mark-to-market as upside on in-place rent: 0.25 means
  market is 25% above in-place.
- **M03.** Power cost assumed the contracted IT load runs at 100% all year.
  Real draw is well below contract, so the figure overstated cost. Under metered
  pass-through billing the landlord does not bear the cost at all.
- **M04.** Total room revenue was rebuilt from ADR × occupancy × nights instead
  of read from the stated booked revenue. Rounded inputs drift the product away
  from the revenue the document actually states, and RevPAR and ADR already use
  the stated revenue.

## Authorities

Each definition follows a published outside authority where one exists:

- **F&B gross margin.** The *Uniform System of Accounts for the Lodging
  Industry* (USALI; HFTP, AHLA and the Global Finance Committee): the Food and
  Beverage Department schedule reports one Gross Profit, total F&B revenue less
  total cost of sales, and Departmental Profit below it after labor and other
  departmental expenses (as summarized by PKF Hospitality Research, "Major
  Changes Made in the Tenth Edition of the Uniform System", via Hospitality Net;
  unchanged in concept through the 12th Revised Edition). The HFTP *USALI
  Frequently Asked Questions*, Food and Beverage Department (pp. 23–25), defines
  the contents of cost of food sales and records complimentary breakfast in Rooms.
- **Mark-to-market.** No published standard defines the percentage; it is the
  broker and lender convention: (market − in-place) ÷ in-place, positive meaning
  under-rented (upside at rollover). The EPRA *Best Practices Recommendations*
  (September 2024, §4.3) ask listed companies to disclose the two inputs,
  contracted rent passing and market rent (ERV), with the same orientation.
- **Drawn power and PUE.** The Green Grid, *White Paper #49: PUE — A
  Comprehensive Examination of the Metric*: PUE is total facility energy ÷ IT
  energy (Equation 1, p. 11), reported over a year of measured energy (pp. 21,
  35). Energy is power × time (p. 34), and a design, full-load PUE differs from
  annual operating PUE. Hence: metered energy first, measured PUE before design
  PUE, and an explicit draw rather than contracted kW × 8,760 h.
- **Rooms revenue.** The OCC *Comptroller's Handbook: Commercial Real Estate
  Lending* (v2.0), Hotels (p. 124): ADR is room revenue ÷ rooms occupied
  (excluding complimentary and non-revenue occupancies) and RevPAR = ADR ×
  occupancy. The identity holds only on the same paid-rooms basis and period,
  so it is a cross-check of the stated revenue, never its source. The HFTP USALI
  FAQ, Rooms Department (pp. 15–17), defines rooms revenue (rebates reduce it;
  resort fees are Miscellaneous Income).

## Proposed change

### 1. Dictionary and packs

Each formula below is normative in `spec/metrics/builtin.json` and in the class
pack (which the dictionary parity test holds equal); the Excel adapter emits the
same expression (invariant: one pack drives both).

```
fb_gross_margin =
  hotel_food_beverage.fb_revenue == null || hotel_food_beverage.fb_cogs == null ? null
  : (hotel_food_beverage.fb_revenue - hotel_food_beverage.fb_cogs) / hotel_food_beverage.fb_revenue
  # %, round_to 4

mark_to_market =
  (dc_revenue.market_rent_per_kw_month - dc_revenue.rent_per_kw_month) / dc_revenue.rent_per_kw_month
  # %, round_to 4; null when market rent is null (no comp set)

annual_facility_kwh = KWH where
  KWH = dc_power.metered_annual_kwh != null ? dc_power.metered_annual_kwh
      : dc_power.draw_factor == null ? null
      : dc_capacity.contracted_it_load_kw * dc_power.draw_factor
        * (dc_capacity.measured_pue != null ? dc_capacity.measured_pue : dc_capacity.design_pue) * 8760
  # kWh, round_to 0

annual_power_cost = COST where
  COST = dc_power.billing == 'metered_pass_through' ? 0
       : dc_power.stated_annual_power_cost != null ? dc_power.stated_annual_power_cost
       : KWH == null ? null : round(KWH, 0) * dc_power.utility_rate_per_kwh
  # $, round_to 2

power_cost_per_kw_month = COST == null ? null : round(COST, 2) / (dc_capacity.contracted_it_load_kw * 12)

total_room_revenue   = noi_model.income.rooms_revenue                        # $, round_to 2
room_revenue_per_key = noi_model.income.rooms_revenue / property.keys        # $, round_to 2
```

The dependency inlining and inner rounding follow the existing RFC 0080 rule
(an inlined dependency is rounded at its own `round_to`). `KWH` and `COST` are
written out in full in the dictionary; the names above are only for reading.

### 2. Format

- §4.30 `dc_power` gains two optional fields. `metered_annual_kwh` (number ≥ 0
  or null) is the facility's metered or measured annual consumption, in kWh.
  `draw_factor` (number in [0, 1] or null) is the average share of contracted
  IT load the tenants draw. Neither is inferred. The section text states that
  the power-cost metrics never assume full draw, and that under
  `metered_pass_through` power is net to the landlord.
- §4.34 `hotel_food_beverage`: `fb_labor` stays an optional fact; it is not part
  of the gross margin.
- §4.3 (hospitality variant) and Part V: total room revenue is the stated rooms
  revenue. `CC-HOSP-05` (warning) fires when `rent_roll.adr`, `rent_roll.occupancy`,
  `rent_roll.available_room_nights` and `noi_model.income.rooms_revenue` are all
  stated, rooms revenue is nonzero, and
  `|adr × occupancy × available_room_nights − rooms_revenue| > 0.01 × |rooms_revenue|`.
  ADR × occupancy × nights is never substituted for the stated revenue.
- Part V `CC-DC-07` becomes
  `dc_revenue.market_rent_per_kw_month == null || mark_to_market <= round(1 / 0.85 - 1, 4)`
  (in-place more than 15% below market, as before). The threshold is rounded
  at `mark_to_market`'s own 4-dp precision, so in-place at exactly 85% of
  market stays silent, as it did under `rent_index >= 0.85`.

### 3. Protocol

No Protocol text changes. The class rules (`CC-DC-*`, `CC-HOSP-*`) are
registered in the Format's Part V table, which gains `CC-HOSP-05` and the
restated `CC-DC-07`.

## Compatibility analysis

No compatibility path (the prelaunch rule; prelaunch 4.x, RFC 0091 D6). A
document stating `rent_index` or `annual_facility_kwh_at_contract` in a bound
home loses that statement (the ids no longer exist). Fixtures that pinned the
old values are re-derived by the new formulas and listed in the implementation
PR. The Mesa Gateway example (synthetic) and its fixture copies now state a 65%
draw, so their energy computes at the stated measured PUE; they bill by metered
pass-through, so their landlord power cost is zero. A document that states
neither metered kWh nor a draw gets `null` (the owner's "null when absent, never
invented").

## Implementation choices (for owner review)

| # | Choice | Why |
|---|---|---|
| C1 | Field names `dc_power.metered_annual_kwh` and `dc_power.draw_factor` | The ruling names the facts, not the fields; both sit with the existing tariff and bill |
| C2 | "Measured" PUE = the existing `dc_capacity.measured_pue`, preferred to `design_pue` when stated | "use metered or measured figures when stated" |
| C3 | Under `metered_pass_through`, landlord `annual_power_cost` and `power_cost_per_kw_month` are exactly 0, even when a bill is stated | "net to the landlord": the tenant reimburses the metered cost |
| C4 | A stated bill (`stated_annual_power_cost`) still takes precedence over computed kWh × tariff outside pass-through | A bill is a metered figure |
| C5 | `annual_facility_kwh_at_contract` is replaced by `annual_facility_kwh`, not kept | The old id names the full-draw assumption the ruling removes |
| C6 | `mark_to_market` is `%` with `round_to` 4 and comparison minimum 2 | Same convention as the class's other fractions (`utilization`) |
| C7 | `CC-HOSP-05` is a warning, skipped when any of its four inputs is absent or revenue is zero | Matches the other class cross-checks; a missing input is stage readiness, not a mismatch |
| C8 | `draw_factor` is bounded to [0, 1] (`CLS-04` outside it) | The class contract checker supports inclusive bounds; a stated zero draw is a fact, not an error |
| C9 | The Excel adapter gains a `text` named input (`dc_power.billing`), written and imported as a string | The power formulas compare `billing`; one pack still drives both engines |
| C10 | Python's reviewed rule evaluator admits `abs` (null-propagating, Protocol §VIII.3) | `CC-HOSP-05` needs it; the same rule text runs in both implementations |
| C11 | The calc-engine case `calc/fixtures/data-center-module-dependency-rounding` keeps its own declared formula | It tests dependency rounding of a declared calculation, not the dictionary |

## Conformance impact

- Hospitality fixture: `fb_gross_margin` re-derived without labor;
  `total_room_revenue` / `room_revenue_per_key` from stated rooms revenue. New
  `CC-HOSP-05` cases: inside 1% (silent), outside 1% (warning), an input absent
  (silent).
- Data-center fixtures: `rent_index` replaced by `mark_to_market`; power metrics
  re-derived from a stated draw. Fixture 61 bills all-in with a fractional draw,
  so dependency rounding is still exercised through drawn kWh and cost. Workbook
  parity cases cover metered kWh, an explicit draw factor, measured PUE, a stated
  bill, metered pass-through (zero) and no draw (`null`).
- `CC-DC-07` boundary: in-place exactly 85% of market is silent; 84.9% warns.
- Occupancy stored as a percent (fixture 03) now also draws `CC-HOSP-05`, since
  ADR × 72 × nights is 100x the stated revenue.

## Unresolved questions

- **Departmental profit.** USALI's F&B departmental profit (revenue less all
  departmental expenses) is a different metric; adding it is a separate change.
  So is a labor-inclusive "prime cost" ratio, which would get its own id.
- **Paid rooms basis.** ADR, occupancy and the `CC-HOSP-05` identity assume
  `occupied_room_nights` counts paid rooms sold (OCC; USALI). Defining that field
  precisely is a separate change.
