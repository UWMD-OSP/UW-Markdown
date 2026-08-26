---
uw_version: "1.1"
deal_id: "uw_2026_senior_housing_001"
deal_name: "Ocotillo Senior Living - Chandler, AZ"
created: "2026-08-12T09:00:00Z"
last_modified: "2026-08-12T09:00:00Z"

property_address: "3340 S Alma School Rd"
city: "Chandler"
state: "AZ"
zip: "85248"
asset_class: "senior_housing"
asset_subtype: "assisted_living_memory_care"
loan_type: "permanent"
scenario: "stabilized_acquisition"

pipeline_state:
  L0_ingestion:    "complete"
  L1_screening:    "complete"
  L2_underwriting: "complete"
  L4_structuring:  "pending"
  L5_compliance:   "pending"
  L6_risk:         "pending"
  L7_assembly:     "pending"

status: "in_progress"
deal_stage: "full_underwrite"
recommendation: "pending"

quick_metrics:
  purchase_price:    29800000
  loan_amount:       18476000
  noi_underwritten:  2307320
  dscr:              1.5030528173
  ltv:               0.62
  debt_yield:        0.1248820091
  cap_rate:          0.0774268456
  irr_projected:     0.145
  equity_required:   13224000

flags: []
blocking_flags: []

tier: "analyst"
institution_config_id: null
created_by: "test-fixture"
source_documents:
  - "ocotillo_senior_living_t12_2026.pdf"
  - "ocotillo_senior_living_census_jul2026.xlsx"
  - "ocotillo_senior_living_operator_agreement.pdf"
---

# Ocotillo Senior Living - Chandler, AZ

Stabilized assisted-living and memory-care community in the southeast Phoenix
metro, operated under a third-party management agreement. The underwriting case
holds census in the high 80s and assumes care-fee growth in line with the
prevailing wage environment rather than ahead of it, since labor is the dominant
cost line and the operator has limited pricing power mid-year.

## Property {#property}

```json uw:section=property source=manual ts=2026-08-12T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-12T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "total_units": 120,
  "assisted_living_units": 88,
  "memory_care_units": 32,
  "total_beds": 138,
  "year_built": 2015,
  "year_renovated": 2023,
  "building_class": "A",
  "asset_subtype": "assisted_living_memory_care",
  "operator": "Sonoran Care Partners",
  "management_agreement_expiration": "2031-12-31",
  "licensed_beds": 138,
  "stories": 2,
  "land_area_acres": 5.1,
  "condition": "good"
}
```

## Rent Roll {#rent_roll}

```json uw:section=rent_roll source=manual ts=2026-08-12T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "rent_roll",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-12T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": "Senior housing is a census business, not a lease-based rent roll. This section carries the unit census and the average monthly rate; care fees vary by acuity level and are carried in the income model rather than per unit here.",
  "total_units": 120,
  "occupied_units": 106,
  "occupancy": 0.8833333333,
  "vacancy_pct": 0.1166666667,
  "average_monthly_rate": 5800,
  "unit_mix": [
    { "type": "assisted_living", "units": 88, "occupied_units": 79, "average_monthly_rate": 5400 },
    { "type": "memory_care", "units": 32, "occupied_units": 27, "average_monthly_rate": 6900 }
  ],
  "acuity_mix": [
    { "level": "level_1", "residents": 34 },
    { "level": "level_2", "residents": 41 },
    { "level": "level_3", "residents": 31 }
  ]
}
```

## NOI Model {#noi_model}

```json uw:section=noi_model source=manual ts=2026-08-12T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-12T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": "Care revenue is level-of-care fees billed above room and board. total_labor_expense is a subtotal of the three labor lines inside expenses; it sits at the model level so the expense lines still foot to total_operating_expenses without double counting.",
  "income": {
    "gross_potential_revenue": 8352000,
    "vacancy_loss": 974400,
    "care_revenue": 1908000,
    "community_fees": 212000,
    "other_income": 148000,
    "effective_gross_income": 9645600
  },
  "expenses": {
    "salaries_wages": 3180000,
    "employee_benefits": 668000,
    "contract_labor": 142000,
    "dietary_food": 720000,
    "housekeeping_laundry": 218000,
    "activities_transportation": 165000,
    "marketing": 195000,
    "repairs_maintenance": 240000,
    "utilities": 385000,
    "management_fee": 482280,
    "property_taxes": 410000,
    "insurance": 268000,
    "general_admin": 205000,
    "replacement_reserve": 60000,
    "total_operating_expenses": 7338280
  },
  "total_labor_expense": 3990000,
  "net_operating_income": 2307320,
  "expense_ratio": 0.7607904122,
  "labor_ratio": 0.4136601145,
  "care_revenue_ratio": 0.1978104006,
  "revpor_monthly": 7583.0188679245,
  "rate_growth_pct_y1": 0.035
}
```

## Valuation {#valuation}

```json uw:section=valuation source=manual ts=2026-08-12T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-12T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "purchase_price": 29800000,
  "going_in_cap_rate": 0.0774268456,
  "price_per_unit": 248333.3333333333,
  "exit_cap_rate": 0.08
}
```

## Debt Structure {#debt_structure}

```json uw:section=debt_structure source=manual ts=2026-08-12T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-12T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "loan_amount": 18476000,
  "interest_rate": 0.074,
  "loan_term_years": 7,
  "amortization_years": 30,
  "io_period_months": 0,
  "annual_debt_service": 1535089.1,
  "dscr": 1.5030528173,
  "ltv": 0.62,
  "debt_yield": 0.1248820091,
  "recourse": "non_recourse"
}
```

## Sources & Uses {#sources_uses}

```json uw:section=sources_uses source=manual ts=2026-08-12T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "sources_uses",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-12T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "sources": {
    "loan_amount": 18476000,
    "sponsor_equity": 13224000,
    "total": 31700000
  },
  "uses": {
    "purchase_price": 29800000,
    "closing_costs": 745000,
    "capex_reserve": 900000,
    "working_capital": 255000,
    "total": 31700000
  },
  "total_sources": 31700000,
  "total_uses": 31700000
}
```

## DCF {#dcf}

```json uw:section=dcf source=manual ts=2026-08-12T09:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "dcf",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-12T09:00:00Z",
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "assumptions": {
    "hold_period_years": 5,
    "exit_cap_rate": 0.08,
    "annual_rate_growth": 0.035,
    "annual_wage_growth": 0.04
  },
  "levered_irr": 0.145,
  "summary": {
    "equity_multiple": 1.83
  }
}
```

## Pipeline Log {#pipeline_log}

```json uw:section=pipeline_log source=engine ts=2026-08-12T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "pipeline_log",
    "version": 1,
    "superseded": false,
    "source": "engine",
    "agent_id": null,
    "agent_version": null,
    "actor": "system",
    "timestamp": "2026-08-12T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "entries": [
    {
      "entry_id": "log_001",
      "timestamp": "2026-08-12T09:00:00Z",
      "event_type": "file_created",
      "agent_or_actor": "test-fixture",
      "section_affected": null,
      "status": "success",
      "input_sections": [],
      "output_sections": [],
      "flags_raised": [],
      "flags_cleared": [],
      "duration_ms": null,
      "input_hash": null,
      "output_hash": null,
      "error_code": null,
      "error_message": null,
      "notes": null
    }
  ]
}
```

## Operating Statement (T-12)

Trailing-twelve summary reconciled to the NOI model — same revenue, expense, and NOI totals; the line-item detail lives in the source statement.

```json uw:section=operating_statement source=extractor ts=2026-08-26T09:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "operating_statement",
    "version": 1,
    "superseded": false,
    "source": "extractor",
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
    "total_revenue": 9645600
  },
  "expenses": {
    "total_operating_expenses": 7338280
  },
  "net_operating_income": 2307320,
  "reconciles_to_noi_model": true
}
```

## Preliminary Sizing

Loan sizing against the three standard constraints. The governing test is dscr; the proposed loan of $18,476,000 fits inside it.

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
    "noi_underwritten": 2307320,
    "value_basis": 29800000,
    "annual_debt_constant": 0.0831
  },
  "constraints": [
    {
      "test": "max_ltv",
      "limit": 0.75,
      "max_loan": 22350000
    },
    {
      "test": "min_dscr",
      "limit": 1.25,
      "max_loan": 22216323
    },
    {
      "test": "min_debt_yield",
      "limit": 0.09,
      "max_loan": 25636889
    }
  ],
  "max_supportable_loan": 22216323,
  "governing_constraint": "dscr",
  "proposed_loan": 18476000,
  "proposed_within_constraints": true,
  "cushion": 3740323
}
```

## Borrower / Sponsor

Ocotillo Senior Care Group LLC — single-principal sponsorship; figures PFS-stated pending CPA verification.

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
      "name": "Elaine Marsh",
      "role": "managing_member",
      "ownership_pct": 1,
      "is_guarantor": true,
      "is_key_man": true,
      "net_worth_stated": 33256800,
      "liquid_assets_stated": 2032360,
      "contingent_liabilities_stated": 0,
      "years_cre_experience": 15,
      "pfs_received": true,
      "tax_returns_received": false,
      "figures_verified": false,
      "verification_basis": "pfs_stated"
    }
  ],
  "entity": {
    "name": "Ocotillo Senior Care Group LLC",
    "type": "llc",
    "state": "AZ"
  },
  "financial_summary": {
    "global_net_worth": 33256800,
    "global_liquidity": 2032360,
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

Chandler / Southeast Valley assisted living fundamentals as of 2026-08.

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
  "submarket": "Chandler / Southeast Valley",
  "data_as_of": "2026-08-01",
  "vacancy": {
    "current_rate": 0.08,
    "trend": "stable"
  },
  "rents": {
    "yoy_growth_pct": 0.04,
    "trend": "moderate"
  },
  "cap_rates": {
    "range_low": 0.075,
    "range_high": 0.0825,
    "subject_going_in": 0.0774268456
  },
  "supply": {
    "note": "AL/MC pipeline modest; labor availability, not demand, is the binding constraint in this submarket."
  }
}
```

## Validation

Financial-validity engine run over the sections above.

```json uw:section=validation source=engine:financialValidityChecker ts=2026-08-26T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "validation",
    "version": 1,
    "superseded": false,
    "source": "engine:financialValidityChecker",
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
      "value": 1.5031,
      "threshold": {
        "type": "min",
        "min": 1.2,
        "max": null
      },
      "severity": "pass",
      "message": "DSCR (1.5031x) clears the 1.20x warning threshold.",
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
