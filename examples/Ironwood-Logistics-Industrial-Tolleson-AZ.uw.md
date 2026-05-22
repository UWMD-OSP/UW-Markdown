---
uw_version: "1.1"
deal_id: "uw_2026_i3k9m2"
deal_name: "Ironwood Logistics Center — Tolleson, AZ"
created: "2026-05-19T08:00:00Z"
last_modified: "2026-05-21T11:00:00Z"

property_address: "8400 W Buckeye Rd"
city: "Tolleson"
state: "AZ"
zip: "85353"
asset_class: "industrial"
asset_subtype: "bulk_distribution_warehouse"
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
  purchase_price:    28000000
  loan_amount:       16240000
  noi_underwritten:  1750000
  dscr:              1.458
  ltv:               0.58
  debt_yield:        0.1078
  cap_rate:          0.0625
  irr_projected:     0.128
  equity_required:   12760000

flags:
  - "tenant_a_rollover_year_3"
blocking_flags: []

tier: "analyst"
institution_config_id: null
created_by: "wizard"
source_documents:
  - "ironwood_rent_roll_may2026.xlsx"
  - "ironwood_t12_2025.pdf"
  - "ironwood_appraisal_2026.pdf"
---

# Ironwood Logistics Center — Tolleson, AZ

> **Deal ID:** uw_2026_i3k9m2 | **Scenario:** Stabilized Acquisition | **Status:** In Progress  
> **220,000 SF** | **2016 Vintage** | **32' Clear** | **$28,000,000 Purchase** | **$127.27/SF** | **6.25% Cap Rate (in-place)**

This file is a **fourth worked example** in the conformance corpus, alongside the
Parkview multifamily, Riverside office, and Cactus Crossing retail deals. It
demonstrates the `.uw.md` format for bulk-distribution industrial: a multi-tenant
NNN warehouse with low operating expenses, high expense recovery, and a
tenant-level rent roll measured in rentable building area.

---

## Deal Context {#deal_context}

Ironwood Logistics Center is a 220,000 SF Class A bulk-distribution warehouse in the Southwest Valley submarket of metro Phoenix, 96% leased to three credit-oriented logistics and fulfillment tenants on NNN leases. The seller is a merchant developer harvesting a stabilized build. Thesis: acquire modern, functional logistics product at $127/SF (below replacement cost) at a 6.25% in-place cap, hold for durable NNN cash flow on the back of structural e-commerce and nearshoring demand along the I-10 corridor.

```json uw:section=deal_context source=user ts=2026-05-19T08:20:00Z v=1 confidence=high
{
  "_meta": {
    "section": "deal_context",
    "version": 1,
    "superseded": false,
    "source": "user",
    "actor": "jared",
    "timestamp": "2026-05-19T08:20:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "32' clear height, 38 dock-high doors, ESFR sprinklers, 185' truck court. Tenant A (largest) rolls in year 3 — mark-to-market upside as in-place rents are ~10% below current asking.",
  "deal_summary": "220,000 SF Class A bulk warehouse in Tolleson (SW Valley), 96% leased NNN to three logistics tenants. Stabilized acquisition at a 6.25% in-place cap with mark-to-market upside on year-3 rollover.",
  "investment_thesis": "Modern logistics product at $127/SF, below replacement cost, in a supply-constrained big-box submarket. In-place rents trail market by ~10%; staggered rollover captures that without speculative leasing risk.",
  "value_creation_strategy": "Hold through stabilized NNN income, mark Tenant A to market at year-3 rollover, and maintain sub-5% downtime given deep tenant demand for 32' clear bulk space.",
  "hold_strategy": "core_hold",
  "exit_strategy_description": "Sell or refinance at year 5-7 into the institutional bid for stabilized Phoenix logistics, or refinance once Tenant A renews at market.",
  "deal_goal": "12-13% levered IRR with a low-volatility NNN cash-flow profile."
}
```

---

## Property {#property}

```json uw:section=property source=user ts=2026-05-19T08:40:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "user",
    "actor": "jared",
    "timestamp": "2026-05-19T08:40:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "rentable_square_feet": 220000,
  "year_built": 2016,
  "building_class": "A",
  "clear_height_ft": 32,
  "dock_high_doors": 38,
  "drive_in_doors": 4,
  "truck_court_depth_ft": 185,
  "office_finish_pct": 0.08,
  "sprinkler_system": "ESFR",
  "occupancy_pct": 0.96,
  "submarket": "Southwest Valley / I-10 Corridor"
}
```

---

## Rent Roll {#rent_roll}

Industrial tenant variant — the spec's `rent_roll` section accepts a `tenants` array (see Part IV §4) for office, retail, and industrial. Three multi-tenant NNN leases plus one vacant suite.

```json uw:section=rent_roll source=user:upload ts=2026-05-19T09:10:00Z v=1 confidence=high
{
  "_meta": {
    "section": "rent_roll",
    "version": 1,
    "superseded": false,
    "source": "user:upload",
    "actor": "jared",
    "timestamp": "2026-05-19T09:10:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "One vacant 8,800 SF suite (former cross-dock user). Tenant A rolls 2029; in-place at $9.50 vs ~$10.50 market.",
  "as_of_date": "2026-05-01",
  "total_rentable_sf": 220000,
  "occupied_sf": 211200,
  "vacant_sf": 8800,
  "occupancy_pct": 0.96,
  "weighted_avg_rent_psf": 9.99,
  "tenants": [
    {
      "tenant_id": "T-A",
      "tenant_name": "Sunbelt 3PL Logistics",
      "suite": "100",
      "leased_sf": 110000,
      "annual_base_rent": 1045000,
      "rent_psf": 9.50,
      "lease_start": "2022-01-01",
      "lease_expiration": "2029-12-31",
      "lease_type": "NNN",
      "tenant_credit": "national_credit",
      "anchor_tenant": true
    },
    {
      "tenant_id": "T-B",
      "tenant_name": "Mercado Fulfillment Co",
      "suite": "200",
      "leased_sf": 65000,
      "annual_base_rent": 666250,
      "rent_psf": 10.25,
      "lease_start": "2023-06-01",
      "lease_expiration": "2031-05-31",
      "lease_type": "NNN",
      "tenant_credit": "non_investment_grade",
      "anchor_tenant": false
    },
    {
      "tenant_id": "T-C",
      "tenant_name": "Desert Components Manufacturing",
      "suite": "300",
      "leased_sf": 36200,
      "annual_base_rent": 398200,
      "rent_psf": 11.00,
      "lease_start": "2024-03-01",
      "lease_expiration": "2032-02-29",
      "lease_type": "NNN",
      "tenant_credit": "private",
      "anchor_tenant": false
    },
    {
      "tenant_id": "T-VAC-400",
      "tenant_name": null,
      "suite": "400",
      "leased_sf": 0,
      "vacant_sf": 8800,
      "annual_base_rent": 0,
      "rent_psf": 0,
      "lease_expiration": null,
      "tenant_credit": null,
      "anchor_tenant": false
    }
  ]
}
```

---

## NOI Model {#noi_model}

```json uw:section=noi_model source=engine:calculations.ts ts=2026-05-19T11:30:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "engine:calculations.ts",
    "actor": "system",
    "timestamp": "2026-05-19T11:30:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Year-1 underwritten. NNN structure — recoverable expenses (taxes, insurance, CAM) are largely passed through to tenants via expense_reimbursements.",
  "income": {
    "base_rent": 2109450,
    "vacancy_credit_loss": 63450,
    "expense_reimbursements": 295000,
    "other_income": 9000,
    "effective_gross_income": 2350000
  },
  "expenses": {
    "property_taxes": 210000,
    "insurance": 48000,
    "cam": 165000,
    "utilities": 38000,
    "repairs_maintenance": 55000,
    "management_fee": 70500,
    "general_admin": 13500,
    "total_operating_expenses": 600000
  },
  "net_operating_income": 1750000,
  "noi_per_sf": 7.95
}
```

---

## Debt Structure {#debt_structure}

```json uw:section=debt_structure source=user ts=2026-05-19T13:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "user",
    "actor": "jared",
    "timestamp": "2026-05-19T13:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Fixed-rate permanent debt sized to a 1.46x DSCR / 10.8% debt yield at a conservative 58% LTV — typical for stabilized single-asset logistics.",
  "loan_type": "permanent",
  "lender_type": "life_co",
  "loan_amount": 16240000,
  "ltv": 0.58,
  "ltc": 0.56,
  "interest_rate_type": "fixed",
  "all_in_rate_at_close": 0.0625,
  "term_months": 120,
  "amortization_months": 360,
  "amortization": "30yr_amortizing",
  "io_months": 0,
  "annual_debt_service": 1199906,
  "underwritten_noi": 1750000,
  "dscr": 1.458,
  "debt_yield": 0.1078,
  "recourse": "non_recourse_with_carve_outs",
  "prepayment": "yield_maintenance"
}
```

---

## Sources & Uses {#sources_uses}

```json uw:section=sources_uses source=engine:calculations.ts ts=2026-05-19T13:05:00Z v=1 confidence=high
{
  "_meta": {
    "section": "sources_uses",
    "version": 1,
    "superseded": false,
    "source": "engine:calculations.ts",
    "actor": "system",
    "timestamp": "2026-05-19T13:05:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "sources": {
    "loan_amount": 16240000,
    "sponsor_equity": 12760000,
    "total": 29000000
  },
  "uses": {
    "purchase_price": 28000000,
    "closing_costs": 700000,
    "ti_lc_reserve": 300000,
    "total": 29000000
  },
  "total_sources": 29000000,
  "total_uses": 29000000
}
```

---

## Valuation {#valuation}

```json uw:section=valuation source=user:appraisal ts=2026-05-19T14:30:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "user:appraisal",
    "actor": "jared",
    "timestamp": "2026-05-19T14:30:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "purchase_price": 28000000,
  "appraised_value": 28200000,
  "underwritten_value": 28000000,
  "going_in_cap_rate": 0.0625,
  "exit_cap_rate_assumption": 0.065,
  "valuation_method": "income_capitalization",
  "price_per_sf": 127.27,
  "stabilized_value_estimate": 30500000
}
```
