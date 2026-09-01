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

This file is a **second worked example** in the conformance corpus. It exists to show that the `.uw.md` format is not multifamily-only: every concept in `Parkview-Apts-Glendale-AZ.uwx.md` has an analogue here for a different asset class (suburban office) and a different debt instrument (bridge loan with interest reserve).

---

## Deal Context {#deal_context}

Riverside is a 42,500 SF Class B suburban office property in north Phoenix at 73% occupancy. The seller is a regional REIT divesting non-strategic assets; the property has been undermanaged with two of the three top-floor tenants approaching natural roll-down in the next 18 months. Thesis: acquire below replacement cost, lease the vacancy through a local broker, retain or replace the rolling tenants at market terms, then refinance into permanent debt at year 2 once stabilized NOI supports a 1.30x DSCR.

```json uw:section=deal_context source=manual ts=2026-04-25T08:45:00Z v=1 confidence=high
{
  "_meta": {
    "section": "deal_context",
    "version": 1,
    "superseded": false,
    "source": "manual",
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

```json uw:section=property source=manual ts=2026-04-25T08:50:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
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
  "parking_ratio_per_1000_sf": 4,
  "occupancy_pct": 0.73,
  "submarket": "North Phoenix / Deer Valley"
}
```

---

## Rent Roll {#rent_roll}

Office tenant variant — the spec's `rent_roll` section accepts a `tenants` array (see Part IV §4) when the asset class is office, retail, or industrial.

```json uw:section=rent_roll source=manual ts=2026-04-25T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "rent_roll",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "resolution": "user_input",
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
  "weighted_avg_rent_psf": 21.5,
  "tenants": [
    {
      "tenant_id": "T-001",
      "tenant_name": "Granite Engineering LLC",
      "suite": "Suite 100",
      "leased_sf": 9500,
      "annual_base_rent": 209000,
      "rent_psf": 22,
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
      "rent_psf": 21.5,
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
      "rent_psf": 20.8,
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
      "rent_psf": 21.5,
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

```json uw:section=noi_model source=system/calculations.ts ts=2026-04-25T11:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "system/calculations.ts",
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
    "utilities": 86550,
    "repairs_maintenance": 62000,
    "management_fee": 36000,
    "general_admin": 18000,
    "total_operating_expenses": 382550
  },
  "net_operating_income": 300000,
  "noi_per_sf": 7.06
}
```

---

## Debt Structure (Bridge) {#debt_structure}

```json uw:section=debt_structure source=manual ts=2026-04-25T13:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "manual",
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
  "ltc": 0.6,
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
  "exit_test_dscr": 1.3
}
```

---

## Sources & Uses {#sources_uses}

```json uw:section=sources_uses source=system/calculations.ts ts=2026-04-25T13:05:00Z v=1 confidence=high
{
  "_meta": {
    "section": "sources_uses",
    "version": 1,
    "superseded": false,
    "source": "system/calculations.ts",
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

```json uw:section=valuation source=manual ts=2026-04-25T14:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "resolution": "user_input",
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
    "total_revenue": 682550
  },
  "expenses": {
    "total_operating_expenses": 382550
  },
  "net_operating_income": 300000,
  "reconciles_to_noi_model": true
}
```

## Preliminary Sizing

Loan sizing against the three standard constraints. The governing test is dscr; the proposed loan of $3,250,000 exceeds it.

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
    "noi_underwritten": 300000,
    "value_basis": 5000000,
    "annual_debt_constant": 0.09
  },
  "constraints": [
    {
      "test": "max_ltv",
      "limit": 0.75,
      "max_loan": 3750000
    },
    {
      "test": "min_dscr",
      "limit": 1.25,
      "max_loan": 2666667
    },
    {
      "test": "min_debt_yield",
      "limit": 0.09,
      "max_loan": 3333333
    }
  ],
  "max_supportable_loan": 2666667,
  "governing_constraint": "dscr",
  "proposed_loan": 3250000,
  "proposed_within_constraints": false,
  "cushion": -583333
}
```

## Borrower / Sponsor

Riverside Office Investors LLC — single-principal sponsorship; figures PFS-stated pending CPA verification.

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
      "name": "Tom Calloway",
      "role": "managing_member",
      "ownership_pct": 1,
      "is_guarantor": true,
      "is_key_man": true,
      "net_worth_stated": 5850000,
      "liquid_assets_stated": 357500,
      "contingent_liabilities_stated": 0,
      "years_cre_experience": 15,
      "pfs_received": true,
      "tax_returns_received": false,
      "figures_verified": false,
      "verification_basis": "pfs_stated"
    }
  ],
  "entity": {
    "name": "Riverside Office Investors LLC",
    "type": "llc",
    "state": "AZ"
  },
  "financial_summary": {
    "global_net_worth": 5850000,
    "global_liquidity": 357500,
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

Midtown Phoenix suburban office fundamentals as of 2026-08.

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
  "submarket": "Midtown Phoenix",
  "data_as_of": "2026-08-01",
  "vacancy": {
    "current_rate": 0.185,
    "trend": "stable"
  },
  "rents": {
    "yoy_growth_pct": 0.005,
    "trend": "flat"
  },
  "cap_rates": {
    "range_low": 0.08,
    "range_high": 0.095,
    "subject_going_in": 0.06
  },
  "supply": {
    "note": "No speculative office supply; elevated sublease availability keeps effective rents flat."
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
  "overall_status": "warnings_only",
  "financial_validity": [
    {
      "flag_id": "FV-001",
      "metric": "dscr",
      "value": 1.0256,
      "threshold": {
        "type": "min",
        "min": 1.2,
        "max": null
      },
      "severity": "warning",
      "message": "DSCR (1.0256x) is below the 1.20x warning threshold; passes the 1.0x error floor.",
      "suppressed": false,
      "suppress_reason": null
    },
    {
      "flag_id": "FV-002",
      "metric": "ltv",
      "value": 0.65,
      "threshold": {
        "type": "max",
        "min": null,
        "max": 0.75
      },
      "severity": "pass",
      "message": "LTV at 65.0% is within the 75% policy maximum.",
      "suppressed": false,
      "suppress_reason": null
    }
  ],
  "completeness": []
}
```
