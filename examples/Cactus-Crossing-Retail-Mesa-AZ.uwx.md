---
uw_version: "1.1"
deal_id: "uw_2026_r5e7f1"
deal_name: "Cactus Crossing — Grocery-Anchored Retail, Mesa, AZ"
created: "2026-05-18T09:00:00Z"
last_modified: "2026-05-20T15:30:00Z"

property_address: "2150 S Power Rd"
city: "Mesa"
state: "AZ"
zip: "85209"
asset_class: "retail"
asset_subtype: "grocery_anchored_neighborhood_center"
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
  purchase_price:    18500000
  loan_amount:       11470000
  noi_underwritten:  1295000
  dscr:              1.451
  ltv:               0.62
  debt_yield:        0.1129
  cap_rate:          0.07
  irr_projected:     0.135
  equity_required:   7842500

flags:
  - "anchor_lease_rolls_year_4"
blocking_flags: []

tier: "analyst"
institution_config_id: null
created_by: "wizard"
source_documents:
  - "cactus_crossing_rent_roll_may2026.xlsx"
  - "cactus_crossing_t12_2025.pdf"
  - "cactus_crossing_appraisal_2026.pdf"
---

# Cactus Crossing — Grocery-Anchored Retail, Mesa, AZ

> **Deal ID:** uw_2026_r5e7f1 | **Scenario:** Stabilized Acquisition | **Status:** In Progress  
> **95,000 SF** | **2005 Vintage** | **$18,500,000 Purchase** | **$194.74/SF** | **7.0% Cap Rate (in-place)**

This file is a **third worked example** in the conformance corpus, alongside the
Parkview multifamily and Riverside office deals. It demonstrates the `.uw.md`
format for grocery-anchored neighborhood retail: an NNN lease structure with
expense reimbursements, percentage rent, and a tenant-level rent roll mixing a
grocery anchor with inline shop space.

---

## Deal Context {#deal_context}

Cactus Crossing is a 95,000 SF grocery-anchored neighborhood center in southeast Mesa, anchored by a regional grocer on a long-term NNN lease and 94% leased across eight tenants. The seller is a 1031 exchange buyer who is now out of their hold window. Thesis: acquire a stabilized, daily-needs center with a credit grocery anchor at a 7.0% in-place cap, hold for durable NNN cash flow, and harvest mark-to-market on the inline rollover over a 7-10 year hold.

```json uw:section=deal_context source=manual ts=2026-05-18T09:15:00Z v=1 confidence=high
{
  "_meta": {
    "section": "deal_context",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "actor": "jared",
    "timestamp": "2026-05-18T09:15:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Anchor grocery lease has 8 years remaining with two 5-year options; inline WALT ~4.2 years. Power Road corridor has strong daytime population and household income growth.",
  "deal_summary": "95,000 SF grocery-anchored neighborhood center in Mesa, 94% leased. Stabilized NNN acquisition at a 7.0% in-place cap with mark-to-market upside on inline rollover.",
  "investment_thesis": "Daily-needs retail anchored by a credit grocer at $194/SF. In-place inline rents are ~8% below market; staggered rollover lets us capture that without a heavy capital event.",
  "value_creation_strategy": "Backfill the single 5,700 SF vacant inline suite within 9 months at $28/SF NNN, roll expiring inline shops to market, and hold for stable distributions.",
  "hold_strategy": "core_plus_hold",
  "exit_strategy_description": "Sell or refinance at year 7-10 once inline rents are marked to market and the anchor exercises its first option.",
  "deal_goal": "13-14% levered IRR with a 5%+ year-1 cash-on-cash from durable NNN income."
}
```

---

## Property {#property}

```json uw:section=property source=manual ts=2026-05-18T09:30:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "actor": "jared",
    "timestamp": "2026-05-18T09:30:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "gross_leasable_area": 95000,
  "year_built": 2005,
  "year_renovated": 2019,
  "building_class": "B",
  "buildings": 4,
  "parking_spaces": 475,
  "parking_ratio_per_1000_sf": 5,
  "occupancy_pct": 0.94,
  "anchor_tenant": "Sonoran Fresh Market",
  "submarket": "Southeast Mesa / Power Road Corridor"
}
```

---

## Rent Roll {#rent_roll}

Retail tenant variant — the spec's `rent_roll` section accepts a `tenants` array (see Part IV §4) for office, retail, and industrial. Grocery anchor on NNN with percentage-rent overage; inline shops on NNN.

```json uw:section=rent_roll source=manual ts=2026-05-18T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "rent_roll",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "resolution": "user_input",
    "actor": "jared",
    "timestamp": "2026-05-18T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "One vacant 5,700 SF inline suite (former bank, second-generation restaurant-ready). Anchor reports $620/SF sales; percentage-rent breakpoint not yet crossed.",
  "as_of_date": "2026-05-01",
  "total_gla": 95000,
  "occupied_gla": 89300,
  "vacant_gla": 5700,
  "occupancy_pct": 0.94,
  "weighted_avg_rent_psf": 18.14,
  "tenants": [
    {
      "tenant_id": "T-ANC",
      "tenant_name": "Sonoran Fresh Market",
      "suite": "Anchor",
      "leased_sf": 45000,
      "annual_base_rent": 517500,
      "rent_psf": 11.5,
      "lease_start": "2018-06-01",
      "lease_expiration": "2034-05-31",
      "lease_type": "NNN",
      "percentage_rent": true,
      "tenant_credit": "national_credit",
      "anchor_tenant": true
    },
    {
      "tenant_id": "T-001",
      "tenant_name": "Desert Pharmacy & Wellness",
      "suite": "A-1",
      "leased_sf": 12000,
      "annual_base_rent": 288000,
      "rent_psf": 24,
      "lease_start": "2021-03-01",
      "lease_expiration": "2031-02-28",
      "lease_type": "NNN",
      "tenant_credit": "national_credit",
      "anchor_tenant": false
    },
    {
      "tenant_id": "T-002",
      "tenant_name": "Power Road Fitness",
      "suite": "A-2",
      "leased_sf": 15000,
      "annual_base_rent": 270000,
      "rent_psf": 18,
      "lease_start": "2020-09-01",
      "lease_expiration": "2030-08-31",
      "lease_type": "NNN",
      "tenant_credit": "regional",
      "anchor_tenant": false
    },
    {
      "tenant_id": "T-003",
      "tenant_name": "Agave Cantina",
      "suite": "B-1",
      "leased_sf": 6000,
      "annual_base_rent": 192000,
      "rent_psf": 32,
      "lease_start": "2022-11-01",
      "lease_expiration": "2032-10-31",
      "lease_type": "NNN",
      "tenant_credit": "private",
      "anchor_tenant": false
    },
    {
      "tenant_id": "T-004",
      "tenant_name": "Polished Nail Bar",
      "suite": "B-2",
      "leased_sf": 2500,
      "annual_base_rent": 75000,
      "rent_psf": 30,
      "lease_start": "2023-05-01",
      "lease_expiration": "2028-04-30",
      "lease_type": "NNN",
      "tenant_credit": "private",
      "anchor_tenant": false
    },
    {
      "tenant_id": "T-005",
      "tenant_name": "Saguaro Coffee Roasters",
      "suite": "B-3",
      "leased_sf": 1800,
      "annual_base_rent": 68400,
      "rent_psf": 38,
      "lease_start": "2024-01-15",
      "lease_expiration": "2031-01-14",
      "lease_type": "NNN",
      "tenant_credit": "private",
      "anchor_tenant": false
    },
    {
      "tenant_id": "T-006",
      "tenant_name": "Valley First Credit Union",
      "suite": "C-1",
      "leased_sf": 3000,
      "annual_base_rent": 105000,
      "rent_psf": 35,
      "lease_start": "2019-07-01",
      "lease_expiration": "2029-06-30",
      "lease_type": "NNN",
      "tenant_credit": "regional",
      "anchor_tenant": false
    },
    {
      "tenant_id": "T-007",
      "tenant_name": "Mesa Urgent Care",
      "suite": "C-2",
      "leased_sf": 4000,
      "annual_base_rent": 104000,
      "rent_psf": 26,
      "lease_start": "2022-02-01",
      "lease_expiration": "2032-01-31",
      "lease_type": "NNN",
      "tenant_credit": "regional",
      "anchor_tenant": false
    },
    {
      "tenant_id": "T-VAC-D1",
      "tenant_name": null,
      "suite": "D-1",
      "leased_sf": 0,
      "vacant_sf": 5700,
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

```json uw:section=noi_model source=system/calculations.ts ts=2026-05-18T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "system/calculations.ts",
    "actor": "system",
    "timestamp": "2026-05-18T12:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Year-1 underwritten. NNN structure — recoverable expenses (taxes, insurance, CAM) are largely passed through to tenants via expense_reimbursements.",
  "income": {
    "base_rent": 1619900,
    "vacancy_credit_loss": 48900,
    "expense_reimbursements": 430000,
    "percentage_rent": 34000,
    "other_income": 18000,
    "effective_gross_income": 2053000
  },
  "expenses": {
    "property_taxes": 268000,
    "insurance": 62000,
    "cam": 205000,
    "utilities": 46000,
    "repairs_maintenance": 72000,
    "management_fee": 61590,
    "general_admin": 43410,
    "total_operating_expenses": 758000
  },
  "net_operating_income": 1295000,
  "noi_per_sf": 13.63
}
```

---

## Debt Structure {#debt_structure}

```json uw:section=debt_structure source=manual ts=2026-05-18T13:30:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "actor": "jared",
    "timestamp": "2026-05-18T13:30:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_notes": "Fixed-rate permanent debt sized to a 1.45x DSCR / 11.3% debt yield. Conservative 62% LTV reflects lender caution on retail despite the credit anchor.",
  "loan_type": "permanent",
  "lender_type": "cmbs",
  "loan_amount": 11470000,
  "ltv": 0.62,
  "ltc": 0.594,
  "interest_rate_type": "fixed",
  "all_in_rate_at_close": 0.0675,
  "term_months": 120,
  "amortization_months": 360,
  "amortization": "30yr_amortizing",
  "io_months": 0,
  "annual_debt_service": 892710,
  "underwritten_noi": 1295000,
  "dscr": 1.451,
  "debt_yield": 0.1129,
  "recourse": "non_recourse_with_carve_outs",
  "prepayment": "defeasance"
}
```

---

## Sources & Uses {#sources_uses}

```json uw:section=sources_uses source=system/calculations.ts ts=2026-05-18T13:35:00Z v=1 confidence=high
{
  "_meta": {
    "section": "sources_uses",
    "version": 1,
    "superseded": false,
    "source": "system/calculations.ts",
    "actor": "system",
    "timestamp": "2026-05-18T13:35:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "sources": {
    "loan_amount": 11470000,
    "sponsor_equity": 7842500,
    "total": 19312500
  },
  "uses": {
    "purchase_price": 18500000,
    "closing_costs": 462500,
    "ti_lc_reserve": 350000,
    "total": 19312500
  },
  "total_sources": 19312500,
  "total_uses": 19312500
}
```

---

## Valuation {#valuation}

```json uw:section=valuation source=manual ts=2026-05-18T14:30:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "resolution": "user_input",
    "actor": "jared",
    "timestamp": "2026-05-18T14:30:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "purchase_price": 18500000,
  "appraised_value": 18650000,
  "underwritten_value": 18500000,
  "going_in_cap_rate": 0.07,
  "exit_cap_rate_assumption": 0.0725,
  "valuation_method": "income_capitalization",
  "price_per_sf": 194.74,
  "stabilized_value_estimate": 19800000
}
```

## Operating Statement (T-12)

Trailing-twelve summary reconciled to the NOI model — same revenue, expense, and NOI totals; the line-item detail lives in the source statement.

```json uw:section=operating_statement source=system/extractor ts=2026-08-26T09:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "operating_statement",
    "version": 1,
    "superseded": false,
    "source": "system/extractor",
    "resolution": "ai_extracted",
    "agent_id": null,
    "agent_version": null,
    "actor": "jared",
    "timestamp": "2026-08-26T09:00:00Z",
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": "T-12 summary reconciled to the NOI model; line detail retained in the source statement."
  },
  "period": "t12",
  "period_end": "2026-06-30",
  "statement_basis": "accrual",
  "income": {
    "total_revenue": 2053000
  },
  "expenses": {
    "total_operating_expenses": 758000
  },
  "net_operating_income": 1295000,
  "reconciles_to_noi_model": true
}
```

## Preliminary Sizing

Loan sizing against the three standard constraints. The governing test is dscr; the proposed loan of $11,470,000 fits inside it.

```json uw:section=preliminary_sizing source=manual ts=2026-08-26T09:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "preliminary_sizing",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "jared",
    "timestamp": "2026-08-26T09:00:00Z",
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "sizing_basis": {
    "noi_underwritten": 1295000,
    "value_basis": 18500000,
    "annual_debt_constant": 0.0778
  },
  "constraints": [
    {
      "test": "max_ltv",
      "limit": 0.75,
      "max_loan": 13875000
    },
    {
      "test": "min_dscr",
      "limit": 1.25,
      "max_loan": 13311064
    },
    {
      "test": "min_debt_yield",
      "limit": 0.09,
      "max_loan": 14388889
    }
  ],
  "max_supportable_loan": 13311064,
  "governing_constraint": "dscr",
  "proposed_loan": 11470000,
  "proposed_within_constraints": true,
  "cushion": 1841064
}
```

## Borrower / Sponsor

Cactus Crossing Retail Partners LLC — single-principal sponsorship; figures PFS-stated pending CPA verification.

```json uw:section=borrower_sponsor source=manual ts=2026-08-26T09:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "borrower_sponsor",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "jared",
    "timestamp": "2026-08-26T09:00:00Z",
    "confidence": "medium",
    "human_review_required": true,
    "flags": [],
    "input_hash": null,
    "notes": "Figures are PFS-stated; CPA verification requested for the DD period."
  },
  "principals": [
    {
      "name": "Dana Whitfield",
      "role": "managing_member",
      "ownership_pct": 1,
      "is_guarantor": true,
      "is_key_man": true,
      "net_worth_stated": 20646000,
      "liquid_assets_stated": 1261700,
      "contingent_liabilities_stated": 0,
      "years_cre_experience": 15,
      "pfs_received": true,
      "tax_returns_received": false,
      "figures_verified": false,
      "verification_basis": "pfs_stated"
    }
  ],
  "entity": {
    "name": "Cactus Crossing Retail Partners LLC",
    "type": "llc",
    "state": "AZ"
  },
  "financial_summary": {
    "global_net_worth": 20646000,
    "global_liquidity": 1261700,
    "nw_to_loan_ratio": 1.8,
    "nw_to_loan_policy_min": 1,
    "liquidity_to_loan_ratio": 0.11,
    "liquidity_to_loan_policy_min": 0.1,
    "all_figures_verified": false,
    "unverified_flag": true
  }
}
```

## Market Analysis

Mesa / East Valley neighborhood retail fundamentals as of 2026-08.

```json uw:section=market_analysis source=manual ts=2026-08-26T09:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "market_analysis",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "jared",
    "timestamp": "2026-08-26T09:00:00Z",
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": "Broker survey and published market reports; refresh before credit committee."
  },
  "market": "Phoenix Metro",
  "submarket": "Mesa / East Valley",
  "data_as_of": "2026-08-01",
  "vacancy": {
    "current_rate": 0.062,
    "trend": "stable"
  },
  "rents": {
    "yoy_growth_pct": 0.022,
    "trend": "flat"
  },
  "cap_rates": {
    "range_low": 0.0675,
    "range_high": 0.0725,
    "subject_going_in": 0.07
  },
  "supply": {
    "note": "Limited new unanchored retail supply; grocery-anchored pipeline concentrated in Queen Creek."
  }
}
```

## Validation

Financial-validity engine run over the sections above.

```json uw:section=validation source=system/financialValidityChecker ts=2026-08-26T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "validation",
    "version": 1,
    "superseded": false,
    "source": "system/financialValidityChecker",
    "agent_id": null,
    "agent_version": null,
    "actor": "system",
    "timestamp": "2026-08-26T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "overall_status": "clean",
  "financial_validity": [
    {
      "flag_id": "FV-001",
      "metric": "dscr",
      "value": 1.4506,
      "threshold": {
        "type": "min",
        "min": 1.2,
        "max": null
      },
      "severity": "pass",
      "message": "DSCR (1.4506x) clears the 1.20x warning threshold.",
      "suppressed": false,
      "suppress_reason": null
    },
    {
      "flag_id": "FV-002",
      "metric": "ltv",
      "value": 0.62,
      "threshold": {
        "type": "max",
        "min": null,
        "max": 0.75
      },
      "severity": "pass",
      "message": "LTV at 62.0% is within the 75% policy maximum.",
      "suppressed": false,
      "suppress_reason": null
    }
  ],
  "completeness": []
}
```
