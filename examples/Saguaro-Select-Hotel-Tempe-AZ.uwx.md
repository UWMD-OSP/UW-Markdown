---
uw_version: "1.1"
deal_id: "uw_2026_hospitality_001"
deal_name: "Saguaro Select Hotel - Tempe, AZ"
created: "2026-08-11T09:00:00Z"
last_modified: "2026-08-11T09:00:00Z"

property_address: "1450 E Apache Blvd"
city: "Tempe"
state: "AZ"
zip: "85281"
asset_class: "hospitality"
asset_subtype: "select_service"
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
  purchase_price:    23800000
  loan_amount:       14280000
  noi_underwritten:  1961600
  dscr:              1.5287953137
  ltv:               0.6
  debt_yield:        0.1373669468
  cap_rate:          0.0824201681
  irr_projected:     0.132
  equity_required:   11370000

flags: []
blocking_flags: []

tier: "analyst"
institution_config_id: null
created_by: "test-fixture"
source_documents:
  - "saguaro_select_str_report_jul2026.pdf"
  - "saguaro_select_t12_2026.pdf"
  - "saguaro_select_franchise_agreement.pdf"
---

# Saguaro Select Hotel - Tempe, AZ

Stabilized select-service acquisition adjacent to the ASU campus and the Loop 202
corridor. The underwriting case holds ADR flat in year one and assumes occupancy
stays in the low-to-mid 70s, with a franchise-mandated PIP funded at close out of
the sources & uses rather than out of operations.

## Property {#property}

```json uw:section=property source=manual ts=2026-08-11T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-11T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "keys": 142,
  "year_built": 2009,
  "year_renovated": 2019,
  "building_class": "B",
  "asset_subtype": "select_service",
  "brand": "Marriott Courtyard",
  "franchise_expiration": "2034-06-30",
  "stories": 5,
  "meeting_space_sqft": 2400,
  "parking_spaces": 168,
  "land_area_acres": 2.7,
  "condition": "good"
}
```

## Rent Roll {#rent_roll}

```json uw:section=rent_roll source=manual ts=2026-08-11T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "rent_roll",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-11T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": "Hospitality has no lease-based rent roll. This section carries the trailing-twelve room-night statistics that stand in for one: available room nights are keys x 365, and occupied room nights come from the STR report.",
  "keys": 142,
  "available_room_nights": 51830,
  "occupied_room_nights": 38000,
  "occupancy": 0.73316612,
  "adr": 160.0,
  "revpar": 117.3065792012,
  "vacancy_pct": 0.26683388,
  "segmentation": [
    { "segment": "transient", "room_nights": 21280, "adr": 168.5 },
    { "segment": "group", "room_nights": 9120, "adr": 152.0 },
    { "segment": "contract", "room_nights": 7600, "adr": 141.25 }
  ]
}
```

## NOI Model {#noi_model}

```json uw:section=noi_model source=manual ts=2026-08-11T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-11T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": "USALI-shaped. Gross operating profit is struck after departmental and undistributed expenses; the management fee, fixed charges, and the FF&E reserve fall below GOP to reach NOI.",
  "income": {
    "rooms_revenue": 6080000,
    "food_beverage_revenue": 620000,
    "other_operated_departments": 145000,
    "miscellaneous_income": 55000,
    "effective_gross_income": 6900000
  },
  "expenses": {
    "rooms_department": 1520000,
    "food_beverage_department": 496000,
    "other_departmental": 87000,
    "administrative_general": 462000,
    "sales_marketing": 428000,
    "franchise_fees": 486400,
    "property_operations_maintenance": 276000,
    "utilities": 262000,
    "management_fee": 207000,
    "property_taxes": 310000,
    "insurance": 128000,
    "ffe_reserve": 276000,
    "total_operating_expenses": 4938400
  },
  "gross_operating_profit": 2882600,
  "net_operating_income": 1961600,
  "expense_ratio": 0.7157101449,
  "gop_margin": 0.4177681159,
  "adr_growth_pct_y1": 0.0,
  "revpar_per_key": 42816.9014084507
}
```

## Valuation {#valuation}

```json uw:section=valuation source=manual ts=2026-08-11T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-11T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "purchase_price": 23800000,
  "going_in_cap_rate": 0.0824201681,
  "price_per_key": 167605.6338028169,
  "exit_cap_rate": 0.0875
}
```

## Debt Structure {#debt_structure}

```json uw:section=debt_structure source=manual ts=2026-08-11T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-11T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "loan_amount": 14280000,
  "interest_rate": 0.0765,
  "loan_term_years": 5,
  "amortization_years": 25,
  "io_period_months": 0,
  "annual_debt_service": 1283101.79,
  "dscr": 1.5287953137,
  "ltv": 0.6,
  "debt_yield": 0.1373669468,
  "recourse": "non_recourse"
}
```

## Sources & Uses {#sources_uses}

```json uw:section=sources_uses source=manual ts=2026-08-11T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "sources_uses",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-11T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "sources": {
    "loan_amount": 14280000,
    "sponsor_equity": 11370000,
    "total": 25650000
  },
  "uses": {
    "purchase_price": 23800000,
    "closing_costs": 595000,
    "pip_reserve": 1100000,
    "working_capital": 155000,
    "total": 25650000
  },
  "total_sources": 25650000,
  "total_uses": 25650000
}
```

## DCF {#dcf}

```json uw:section=dcf source=manual ts=2026-08-11T09:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "dcf",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-11T09:00:00Z",
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "assumptions": {
    "hold_period_years": 5,
    "exit_cap_rate": 0.0875,
    "annual_revpar_growth": 0.03
  },
  "levered_irr": 0.132,
  "summary": {
    "equity_multiple": 1.78
  }
}
```

## Pipeline Log {#pipeline_log}

```json uw:section=pipeline_log source=system/engine ts=2026-08-11T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "pipeline_log",
    "version": 1,
    "superseded": false,
    "source": "system/engine",
    "agent_id": null,
    "agent_version": null,
    "actor": "system",
    "timestamp": "2026-08-11T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "entries": [
    {
      "entry_id": "log_001",
      "timestamp": "2026-08-11T09:00:00Z",
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
    "total_revenue": 6900000
  },
  "expenses": {
    "total_operating_expenses": 4938400
  },
  "net_operating_income": 1961600,
  "reconciles_to_noi_model": true
}
```

## Preliminary Sizing

Loan sizing against the three standard constraints. The governing test is dscr; the proposed loan of $14,280,000 fits inside it.

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
    "noi_underwritten": 1961600,
    "value_basis": 23800000,
    "annual_debt_constant": 0.0899
  },
  "constraints": [
    {
      "test": "max_ltv",
      "limit": 0.75,
      "max_loan": 17850000
    },
    {
      "test": "min_dscr",
      "limit": 1.25,
      "max_loan": 17464958
    },
    {
      "test": "min_debt_yield",
      "limit": 0.09,
      "max_loan": 21795556
    }
  ],
  "max_supportable_loan": 17464958,
  "governing_constraint": "dscr",
  "proposed_loan": 14280000,
  "proposed_within_constraints": true,
  "cushion": 3184958
}
```

## Borrower / Sponsor

Saguaro Hospitality Ventures LLC — single-principal sponsorship; figures PFS-stated pending CPA verification.

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
      "name": "Nina Alvarez",
      "role": "managing_member",
      "ownership_pct": 1,
      "is_guarantor": true,
      "is_key_man": true,
      "net_worth_stated": 25704000,
      "liquid_assets_stated": 1570800,
      "contingent_liabilities_stated": 0,
      "years_cre_experience": 15,
      "pfs_received": true,
      "tax_returns_received": false,
      "figures_verified": false,
      "verification_basis": "pfs_stated"
    }
  ],
  "entity": {
    "name": "Saguaro Hospitality Ventures LLC",
    "type": "llc",
    "state": "AZ"
  },
  "financial_summary": {
    "global_net_worth": 25704000,
    "global_liquidity": 1570800,
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

Tempe / Airport select-service hotel fundamentals as of 2026-08.

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
  "submarket": "Tempe / Airport",
  "data_as_of": "2026-08-01",
  "vacancy": {
    "current_rate": 0.28,
    "trend": "stable"
  },
  "rents": {
    "yoy_growth_pct": 0.025,
    "trend": "flat"
  },
  "cap_rates": {
    "range_low": 0.08,
    "range_high": 0.0875,
    "subject_going_in": 0.0824201681
  },
  "supply": {
    "note": "One competing select-service property (128 keys) under construction near the airport; delivery late 2027."
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
      "value": 1.5288,
      "threshold": {
        "type": "min",
        "min": 1.2,
        "max": null
      },
      "severity": "pass",
      "message": "DSCR (1.5288x) clears the 1.20x warning threshold.",
      "suppressed": false,
      "suppress_reason": null
    },
    {
      "flag_id": "FV-002",
      "metric": "ltv",
      "value": 0.6,
      "threshold": {
        "type": "max",
        "min": null,
        "max": 0.75
      },
      "severity": "pass",
      "message": "LTV at 60.0% is within the 75% policy maximum.",
      "suppressed": false,
      "suppress_reason": null
    }
  ],
  "completeness": []
}
```
