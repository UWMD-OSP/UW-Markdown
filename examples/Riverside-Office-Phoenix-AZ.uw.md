---
uw_version: "1.1"
deal_id: "uw_2026_b8c2d4"
deal_name: "Riverside Office Center — Phoenix, AZ"
created: "2026-04-25T08:30:00Z"
last_modified: "2026-04-25T16:00:00Z"

property_address: "5500 N Riverside Dr"
city: "Phoenix"
state: "AZ"
zip: "85021"
asset_class: "office"
asset_subtype: "suburban"
loan_type: "bridge"
scenario: "value_add"

pipeline_state:
  L0_ingestion:    "complete"
  L1_screening:    "complete"
  L2_underwriting: "complete"
  L4_structuring:  "in_progress"
  L5_compliance:   "pending"
  L6_risk:         "pending"
  L7_assembly:     "pending"

status: "in_progress"
deal_stage: "full_underwrite"
recommendation: "pending"

quick_metrics:
  purchase_price:    5000000
  loan_amount:       3250000
  noi_underwritten:  300000
  dscr:              1.026
  ltv:               0.65
  debt_yield:        0.0923
  cap_rate:          0.06
  irr_projected:     0.142
  equity_required:   2150000

flags:
  - "bridge_dscr_thin_at_close"
  - "rollover_concentration_year_2"
blocking_flags: []

tier: "analyst"
institution_config_id: null
created_by: "wizard"
source_documents:
  - "riverside_rent_roll_apr2026.xlsx"
  - "riverside_t12_2025.pdf"
  - "riverside_appraisal_2026.pdf"
---

# Riverside Office Center — Phoenix, AZ

> **Deal ID:** uw_2026_b8c2d4 | **Scenario:** Value-Add Bridge | **Status:** In Progress  
> **42,500 SF** | **1998 Vintage** | **$5,000,000 Purchase** | **$117/SF** | **6.0% Cap Rate (in-place)**

This file is a **second worked example** in the conformance corpus. It exists to show that the `.uw.md` format is not multifamily-only: every concept in `Parkview-Apts-Glendale-AZ.uw.md` has an analogue here for a different asset class (suburban office) and a different debt instrument (bridge loan with interest reserve).

---

## Deal Context {#deal_context}

Riverside is a 42,500 SF Class B suburban office property in north Phoenix at 73% occupancy. The seller is a regional REIT divesting non-strategic assets; the property has been undermanaged with two of the three top-floor tenants approaching natural roll-down in the next 18 months. Thesis: acquire below replacement cost, lease the vacancy through a local broker, retain or replace the rolling tenants at market terms, then refinance into permanent debt at year 2 once stabilized NOI supports a 1.30x DSCR.

```json uw:section=deal_context source=user ts=2026-04-25T08:45:00Z v=1 confidence=high
{
  "_meta": {
    "section": "deal_context",
    "version": 1,
    "superseded": false,
    "source": "user",
    "actor": "jared",
    "timestamp": "2026-04-25T08:45:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Bridge DSCR is thin at close (1.03x) — interest reserve sized for 18 months. Refi feasibility hinges on backfilling Suite 300 by month 12.",
  "deal_summary": "42,500 SF suburban office in north Phoenix, 73% occupied. Bridge-financed value-add — lease vacancy, manage rollover, refi into permanent debt at year 2.",
  "investment_thesis": "Class B office at $117/SF (~50% of replacement cost). Local broker network gives us conviction on filling 11,500 SF of vacancy within 12 months at $22/SF NNN. Rolling rents already at-market — credit on those is a wash.",
  "value_creation_strategy": "Fill 11,500 SF vacancy at $22/SF NNN over 12 months. Hold occupancy through Year 2 rollover with 50% renewal probability at flat rents. Take out the bridge with permanent debt at year 2.",
  "hold_strategy": "value_add_then_refi",
  "exit_strategy_description": "Refinance into 5-year permanent CMBS or life co debt at year 2 once stabilized NOI exceeds $400,000.",
  "deal_goal": "14% levered IRR with downside protected by below-replacement-cost basis."
}
```

---

## Property {#property}

```json uw:section=property source=user ts=2026-04-25T08:50:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "user",
    "actor": "jared",
    "timestamp": "2026-04-25T08:50:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "rentable_square_feet": 42500,
  "year_built": 1998,
  "year_renovated": 2014,
  "building_class": "B",
  "stories": 3,
  "parking_spaces": 170,
  "parking_ratio_per_1000_sf": 4.0,
  "occupancy_pct": 0.73,
  "submarket": "North Phoenix / Deer Valley"
}
```

---

## Rent Roll {#rent_roll}

Office tenant variant — the spec's `rent_roll` section accepts a `tenants` array (see Part IV §4) when the asset class is office, retail, or industrial.

```json uw:section=rent_roll source=user:upload ts=2026-04-25T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "rent_roll",
    "version": 1,
    "superseded": false,
    "source": "user:upload",
    "actor": "jared",
    "timestamp": "2026-04-25T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Suite 300 vacant since Q3 2025. Two top-floor tenants (Granite Engineering, Synthesis Health) on 36-month leases expiring late Y2.",
  "as_of_date": "2026-04-01",
  "total_rentable_sf": 42500,
  "occupied_sf": 31000,
  "vacant_sf": 11500,
  "occupancy_pct": 0.73,
  "weighted_avg_rent_psf": 21.50,
  "tenants": [
    {
      "tenant_id": "T-001",
      "tenant_name": "Granite Engineering LLC",
      "suite": "Suite 100",
      "leased_sf": 9500,
      "annual_base_rent": 209000,
      "rent_psf": 22.00,
      "lease_start": "2023-08-01",
      "lease_expiration": "2027-07-31",
      "lease_type": "NNN",
      "tenant_credit": "private",
      "anchor_tenant": false
    },
    {
      "tenant_id": "T-002",
      "tenant_name": "Synthesis Health PC",
      "suite": "Suite 200",
      "leased_sf": 10000,
      "annual_base_rent": 215000,
      "rent_psf": 21.50,
      "lease_start": "2023-09-15",
      "lease_expiration": "2027-09-14",
      "lease_type": "NNN",
      "tenant_credit": "private",
      "anchor_tenant": true
    },
    {
      "tenant_id": "T-003",
      "tenant_name": "Northstar Insurance Group",
      "suite": "Suite 201",
      "leased_sf": 7000,
      "annual_base_rent": 145600,
      "rent_psf": 20.80,
      "lease_start": "2024-02-01",
      "lease_expiration": "2029-01-31",
      "lease_type": "NNN",
      "tenant_credit": "non_investment_grade",
      "anchor_tenant": false
    },
    {
      "tenant_id": "T-004",
      "tenant_name": "Bridgestone Architects",
      "suite": "Suite 202",
      "leased_sf": 4500,
      "annual_base_rent": 96750,
      "rent_psf": 21.50,
      "lease_start": "2025-03-01",
      "lease_expiration": "2030-02-28",
      "lease_type": "NNN",
      "tenant_credit": "private",
      "anchor_tenant": false
    },
    {
      "tenant_id": "T-VAC-300",
      "tenant_name": null,
      "suite": "Suite 300",
      "leased_sf": 0,
      "vacant_sf": 11500,
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

```json uw:section=noi_model source=engine:calculations.ts ts=2026-04-25T11:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "engine:calculations.ts",
    "actor": "system",
    "timestamp": "2026-04-25T11:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Year-1 underwritten — assumes 73% occupancy held through Y1; Suite 300 backfill modeled in Y2.",
  "income": {
    "gross_potential_rent": 935000,
    "vacancy_loss": 252450,
    "effective_gross_income": 682550,
    "expense_reimbursements": 187500,
    "other_income": 12000
  },
  "expenses": {
    "property_taxes": 142000,
    "insurance": 38000,
    "utilities": 84000,
    "repairs_maintenance": 62000,
    "management_fee": 36000,
    "general_admin": 18000,
    "total_operating_expenses": 380000
  },
  "net_operating_income": 300000,
  "noi_per_sf": 7.06
}
```

---

## Debt Structure (Bridge) {#debt_structure}

```json uw:section=debt_structure source=user ts=2026-04-25T13:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "user",
    "actor": "jared",
    "timestamp": "2026-04-25T13:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Bridge debt with 18-month interest reserve sized into the loan. Typical for value-add office where in-place NOI doesn't service permanent debt.",
  "loan_type": "bridge",
  "lender_type": "debt_fund",
  "loan_amount": 3250000,
  "ltv": 0.65,
  "ltc": 0.60,
  "interest_rate_type": "floating",
  "interest_rate_index": "SOFR_30D",
  "interest_rate_spread_bps": 350,
  "all_in_rate_at_close": 0.09,
  "term_months": 36,
  "amortization": "interest_only",
  "extension_options": "two_12_month_extensions",
  "interest_reserve": 250000,
  "interest_reserve_months": 18,
  "annual_debt_service": 292500,
  "underwritten_noi": 300000,
  "dscr": 1.026,
  "debt_yield": 0.0923,
  "recourse": "non_recourse_with_carve_outs",
  "exit_test_dscr": 1.30
}
```

---

## Sources & Uses {#sources_uses}

```json uw:section=sources_uses source=engine:calculations.ts ts=2026-04-25T13:05:00Z v=1 confidence=high
{
  "_meta": {
    "section": "sources_uses",
    "version": 1,
    "superseded": false,
    "source": "engine:calculations.ts",
    "actor": "system",
    "timestamp": "2026-04-25T13:05:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "sources": {
    "loan_amount": 3250000,
    "sponsor_equity": 2150000,
    "total": 5400000
  },
  "uses": {
    "purchase_price": 5000000,
    "closing_costs": 150000,
    "interest_reserve": 250000,
    "total": 5400000
  },
  "total_sources": 5400000,
  "total_uses": 5400000
}
```

---

## Valuation {#valuation}

```json uw:section=valuation source=user:appraisal ts=2026-04-25T14:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "user:appraisal",
    "actor": "jared",
    "timestamp": "2026-04-25T14:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "purchase_price": 5000000,
  "appraised_value": 5050000,
  "underwritten_value": 5000000,
  "going_in_cap_rate": 0.06,
  "exit_cap_rate_assumption": 0.0675,
  "valuation_method": "income_capitalization",
  "price_per_sf": 117.65,
  "stabilized_value_estimate": 6300000
}
```
