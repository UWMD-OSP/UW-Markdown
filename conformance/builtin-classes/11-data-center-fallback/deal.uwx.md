---
uw_version: "1.1"
deal_id: "uw_2026_dc7q4m1"
deal_name: "Mesa Gateway Data Center — Mesa, AZ"
created: "2026-09-09T08:00:00Z"
last_modified: "2026-09-09T11:00:00Z"

property_address: "6200 S Sossaman Rd"
city: "Mesa"
state: "AZ"
zip: "85212"
asset_class: "org.uwmd.data_center"
modules:
  - id: org.uwmd.datacenters
    version: ">=0.1.0 <1.0.0"
loan_type: "permanent"
scenario: "stabilized_acquisition"

pipeline_state:
  L0_ingestion:    "complete"
  L1_screening:    "complete"
  L2_underwriting: "complete"
  L4_structuring:  "complete"
  L5_compliance:   "pending"
  L6_risk:         "pending"
  L7_assembly:     "pending"

status: "in_progress"
deal_stage: "full_underwrite"
recommendation: "pending"

quick_metrics:
  purchase_price:    160000000
  loan_amount:       96000000
  noi_underwritten:  11200000
  dscr:              1.579
  ltv:               0.6
  debt_yield:        0.1167
  cap_rate:          0.07
  irr_projected:     0.135
  equity_required:   69000000

flags:
  - "phase_2_pre_lease_rent_commencement_gap"
blocking_flags: []

tier: "analyst"
institution_config_id: null
created_by: "wizard"
source_documents:
  - "mesa_gateway_rent_roll_aug2026.xlsx"
  - "mesa_gateway_t12_2025.pdf"
  - "mesa_gateway_srp_capacity_letter_2026.pdf"
  - "mesa_gateway_appraisal_2026.pdf"
---

# Mesa Gateway Data Center — Mesa, AZ

> **Deal ID:** uw_2026_dc7q4m1 | **Scenario:** Stabilized Acquisition | **Status:** In Progress  
> **10.0 MW Commissioned / 12.5 MW Planned** | **11.0 MW Contracted** | **PUE 1.25** | **$160,000,000 Purchase** | **$16,000/kW** | **7.00% Cap Rate (in-place)**

This file is the corpus's **first custom-class example**: its `asset_class` is
`org.uwmd.data_center`, declared by the `org.uwmd.datacenters` module ([RFC
0039](../docs/rfcs/0039-data-center-module.md)) rather than by the builtin enum.
The standard sections read as ordinary industrial real estate — a building, a
lease, an NOI, a loan — which is why the module states `industrial` as its
fallback. The three `dc_*` sections carry what the standard sections cannot:
capacity in **kilowatts**, PUE, redundancy topology, power billing, and rent
per kW-month.

Like the hospitality fixture, it is deliberately **not** a clean deal: 1,000 kW
of phase 2 is pre-leased ahead of commissioning (`CC-MOD-DC-04`), and the
in-place rent runs 20% under the comp set (`CC-MOD-DC-07`). Both warnings fire
on one file; nothing else does.

---

## Deal Context {#deal_context}

Mesa Gateway is a 10 MW (critical IT) wholesale data center in the Elliot Road Technology Corridor, 100% contracted to two tenants on power-metered leases, with a permitted 2.5 MW phase 2 already pre-leased to the anchor. Thesis: acquire a modern N+1 facility with a secured 15 MW utility feed at $16,000/kW — well below the cost of new powered capacity in a market where the utility queue, not land, is the constraint.

```json uw:section=deal_context source=manual ts=2026-09-09T08:20:00Z v=1 confidence=high
{
  "_meta": {
    "section": "deal_context",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "actor": "jared",
    "timestamp": "2026-09-09T08:20:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Utility feed is 15 MW under an executed SRP capacity agreement, which covers the 12.5 MW build-out at design PUE. Phase 2 (2.5 MW) is permitted; 1 MW of it is pre-leased to the anchor with rent commencing on delivery.",
  "deal_summary": "10 MW commissioned wholesale data center in Mesa, 100% contracted to two tenants under metered pass-through power, with a permitted 2.5 MW phase 2 of which 1 MW is pre-leased.",
  "investment_thesis": "Secured utility capacity is the scarce asset in the East Valley. Buying commissioned, contracted megawatts at $16,000/kW, with an expansion phase already permitted and partly pre-leased, captures the utility-queue premium without development risk.",
  "value_creation_strategy": "Deliver phase 2 into the pre-lease, mark the anchor's 2029 renewal to a market that is 25% above the in-place rate, and hold the interconnection and services lines as they scale with density.",
  "hold_strategy": "core_plus_hold",
  "exit_strategy_description": "Sell into the institutional bid for stabilized wholesale capacity at year 5-7, or refinance once phase 2 is delivered and the anchor renews at market.",
  "deal_goal": "13-14% levered IRR with contracted cash flow and a permitted expansion."
}
```

---

## Property {#property}

Square footage is the **building** footprint, carried so that a fallback reader labels a true number rather than a wrong one. White space (`raised_floor_sf`) lives in the capacity section, because for a data center the denominator that matters is kilowatts, not feet.

```json uw:section=property source=manual ts=2026-09-09T08:40:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "actor": "jared",
    "timestamp": "2026-09-09T08:40:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "rentable_square_feet": 180000,
  "year_built": 2021,
  "building_class": "A",
  "stories": 1,
  "site_acres": 22.4,
  "parking_spaces": 120,
  "parking_type": "surface",
  "condition": "excellent",
  "occupancy_pct": 1,
  "submarket": "Elliot Road Technology Corridor / East Valley"
}
```

---

## Rent Roll {#rent_roll}

Two in-place tenants on wholesale leases, rent quoted per kW-month and carried here as annual base rent over the white space each occupies. The 1,000 kW phase-2 pre-lease is **not** in the roll — rent commences on delivery — and appears only in `dc_capacity.contracted_it_load_kw`.

```json uw:section=rent_roll source=manual ts=2026-09-09T09:10:00Z v=1 confidence=high
{
  "_meta": {
    "section": "rent_roll",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "resolution": "user_input",
    "actor": "jared",
    "timestamp": "2026-09-09T09:10:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Both leases are metered pass-through on power. Anchor rolls 2029-12-31; in-place at $150/kW-mo vs ~$187.50 market. Phase-2 pre-lease (1,000 kW, $150/kW-mo) commences on delivery, targeted 2027-07-01.",
  "as_of_date": "2026-08-01",
  "total_rentable_sf": 60000,
  "occupied_sf": 60000,
  "vacant_sf": 0,
  "occupancy_pct": 1,
  "weighted_avg_rent_psf": 300,
  "tenants": [
    {
      "tenant_id": "T-A",
      "tenant_name": "Helios Cloud Services",
      "suite": "Hall 1-2",
      "leased_sf": 36000,
      "annual_base_rent": 10800000,
      "rent_psf": 300,
      "lease_start": "2022-01-01",
      "lease_expiration": "2029-12-31",
      "lease_type": "NNN",
      "tenant_credit": "investment_grade",
      "anchor_tenant": true
    },
    {
      "tenant_id": "T-B",
      "tenant_name": "Meridian Colo Partners",
      "suite": "Hall 3",
      "leased_sf": 24000,
      "annual_base_rent": 7200000,
      "rent_psf": 300,
      "lease_start": "2023-04-01",
      "lease_expiration": "2033-03-31",
      "lease_type": "NNN",
      "tenant_credit": "non_investment_grade",
      "anchor_tenant": false
    }
  ]
}
```

---

## NOI Model {#noi_model}

Year-1 underwritten on the 10,000 kW in place. Power is a pass-through: the $8.76M utility bill on the commissioned load at design PUE is recovered under `expense_reimbursements` and expensed under `utilities`, so it nets to zero at NOI.

```json uw:section=noi_model source=system/calculations.ts ts=2026-09-09T10:30:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "system/calculations.ts",
    "actor": "system",
    "timestamp": "2026-09-09T10:30:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Base rent = 10,000 kW x $150 x 12. Reimbursements = 10,000 kW x 1.25 PUE x 8,760 h x $0.08/kWh, matched by utilities expense. Other income = interconnection ($660,000) + remote hands and services ($264,000).",
  "income": {
    "base_rent": 18000000,
    "vacancy_credit_loss": 0,
    "expense_reimbursements": 8760000,
    "other_income": 924000,
    "effective_gross_income": 27684000
  },
  "expenses": {
    "property_taxes": 2400000,
    "insurance": 520000,
    "cam": 2023480,
    "utilities": 8760000,
    "repairs_maintenance": 1650000,
    "management_fee": 830520,
    "general_admin": 300000,
    "total_operating_expenses": 16484000
  },
  "net_operating_income": 11200000,
  "noi_per_sf": 62.22
}
```

---

## Debt Structure {#debt_structure}

```json uw:section=debt_structure source=manual ts=2026-09-09T10:45:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "actor": "jared",
    "timestamp": "2026-09-09T10:45:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Fixed-rate permanent debt at 60% LTV, sized inside a 1.58x DSCR / 11.7% debt yield. Lender underwrote the in-place 10 MW only; phase 2 is unencumbered upside.",
  "loan_type": "permanent",
  "lender_type": "life_co",
  "loan_amount": 96000000,
  "ltv": 0.6,
  "ltc": 0.58,
  "interest_rate_type": "fixed",
  "all_in_rate_at_close": 0.0625,
  "term_months": 120,
  "amortization_months": 360,
  "amortization": "30yr_amortizing",
  "io_months": 0,
  "annual_debt_service": 7093500,
  "underwritten_noi": 11200000,
  "dscr": 1.579,
  "debt_yield": 0.1167,
  "recourse": "non_recourse_with_carve_outs",
  "prepayment": "yield_maintenance"
}
```

---

## Sources & Uses {#sources_uses}

```json uw:section=sources_uses source=system/calculations.ts ts=2026-09-09T10:50:00Z v=1 confidence=high
{
  "_meta": {
    "section": "sources_uses",
    "version": 1,
    "superseded": false,
    "source": "system/calculations.ts",
    "actor": "system",
    "timestamp": "2026-09-09T10:50:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "sources": {
    "loan_amount": 96000000,
    "sponsor_equity": 69000000,
    "total": 165000000
  },
  "uses": {
    "purchase_price": 160000000,
    "closing_costs": 3200000,
    "ti_lc_reserve": 1800000,
    "total": 165000000
  },
  "total_sources": 165000000,
  "total_uses": 165000000
}
```

---

## Valuation {#valuation}

`price_per_sf` is on the building footprint and is carried for the fallback reader only. The denominator this deal is priced on is `price_per_commissioned_kw`, a module calculation.

```json uw:section=valuation source=manual ts=2026-09-09T11:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "resolution": "user_input",
    "actor": "jared",
    "timestamp": "2026-09-09T11:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "purchase_price": 160000000,
  "appraised_value": 162500000,
  "underwritten_value": 160000000,
  "going_in_cap_rate": 0.07,
  "exit_cap_rate_assumption": 0.0725,
  "valuation_method": "income_capitalization",
  "price_per_sf": 888.89,
  "stabilized_value_estimate": 172000000
}
```

## Preliminary Sizing

Loan sizing against the three standard constraints. The governing test is LTV; the proposed loan of $96,000,000 fits inside it.

```json uw:section=preliminary_sizing source=manual ts=2026-09-09T10:40:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "preliminary_sizing",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "jared",
    "timestamp": "2026-09-09T10:40:00Z",
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "sizing_basis": {
    "noi_underwritten": 11200000,
    "value_basis": 160000000,
    "annual_debt_constant": 0.0739
  },
  "constraints": [
    {
      "test": "max_ltv",
      "limit": 0.75,
      "max_loan": 120000000
    },
    {
      "test": "min_dscr",
      "limit": 1.25,
      "max_loan": 121244925
    },
    {
      "test": "min_debt_yield",
      "limit": 0.09,
      "max_loan": 124444444
    }
  ],
  "max_supportable_loan": 120000000,
  "governing_constraint": "ltv",
  "proposed_loan": 96000000,
  "proposed_within_constraints": true,
  "cushion": 24000000
}
```

## Market Analysis

East Valley wholesale fundamentals as of 2026-08. Rent is quoted per kW-month; the comp set is carried in `dc_revenue.market_rent_per_kw_month`.

```json uw:section=market_analysis source=manual ts=2026-09-09T09:30:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "market_analysis",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "jared",
    "timestamp": "2026-09-09T09:30:00Z",
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": "Broker survey and published capacity reports; refresh before credit committee."
  },
  "market": "Phoenix Metro",
  "submarket": "Mesa / East Valley",
  "data_as_of": "2026-08-01",
  "vacancy": {
    "current_rate": 0.03,
    "trend": "stable"
  },
  "rents": {
    "yoy_growth_pct": 0.08,
    "trend": "rising"
  },
  "cap_rates": {
    "range_low": 0.065,
    "range_high": 0.0725,
    "subject_going_in": 0.07
  },
  "supply": {
    "note": "Announced capacity is large but utility-gated; delivered megawatts remain scarce through 2028."
  }
}
```

---

## Capacity & Topology {#dc_capacity}

Every figure is in **kW** — capacity is quoted in MW and rent in $/kW-month, and one unit throughout is what prevents a x1000 error. Contracted load (11,000 kW) exceeds commissioned load (10,000 kW) because 1,000 kW of phase 2 is pre-leased; that is `CC-MOD-DC-04`, a schedule question and not a defect.

```json uw:section=dc_capacity source=manual ts=2026-09-09T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "dc_capacity",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "actor": "jared",
    "timestamp": "2026-09-09T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Commissioned 10 MW in three halls; permitted phase 2 adds 2.5 MW. Utility feed 15 MW per the SRP capacity agreement — covers full build-out at design PUE (12,500 kW x 1.25 = 15,625 kW is the future check, not today's). Measured PUE 1.32 on the T-12, within 15% of the 1.25 design.",
  "critical_it_load_kw": 10000,
  "planned_it_load_kw": 12500,
  "contracted_it_load_kw": 11000,
  "utility_feed_kw": 15000,
  "design_pue": 1.25,
  "measured_pue": 1.32,
  "redundancy": "n_plus_1",
  "raised_floor_sf": 60000,
  "design_density_kw_per_rack": 12.5
}
```

## Power Economics {#dc_power}

Metered pass-through: tenants pay their own metered power at cost, so the landlord earns no power margin and `power_margin` is null. No stated bill is carried; the annual power cost is computed from the contracted load at design PUE and the blended rate.

```json uw:section=dc_power source=manual ts=2026-09-09T09:05:00Z v=1 confidence=high
{
  "_meta": {
    "section": "dc_power",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "actor": "jared",
    "timestamp": "2026-09-09T09:05:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "utility_rate_per_kwh": 0.08,
  "billing": "metered_pass_through",
  "power_margin": null,
  "stated_annual_power_cost": null
}
```

## Revenue {#dc_revenue}

Weighted-average contracted rent of $150/kW-month on the 11,000 kW contracted, against a $187.50 comp set — a 0.80 rent index, which is what fires `CC-MOD-DC-07` and is also the mark-to-market case at the anchor's 2029 roll.

```json uw:section=dc_revenue source=manual ts=2026-09-09T09:15:00Z v=1 confidence=high
{
  "_meta": {
    "section": "dc_revenue",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "actor": "jared",
    "timestamp": "2026-09-09T09:15:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "lease_type": "wholesale_turnkey",
  "rent_per_kw_month": 150,
  "interconnection_revenue_annual": 660000,
  "services_revenue_annual": 264000,
  "market_rent_per_kw_month": 187.5
}
```
