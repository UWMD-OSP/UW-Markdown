---
uw_version: "1.1"
deal_id: "uw_2026_student_housing_001"
deal_name: "Mill Ave Commons - Tempe, AZ"
created: "2026-08-12T09:00:00Z"
last_modified: "2026-08-12T09:00:00Z"

property_address: "920 S Mill Ave"
city: "Tempe"
state: "AZ"
zip: "85281"
asset_class: "student_housing"
asset_subtype: "purpose_built_off_campus"
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
  purchase_price:    58500000
  loan_amount:       35100000
  noi_underwritten:  3365456
  dscr:              1.2976998918
  ltv:               0.6
  debt_yield:        0.0958819373
  cap_rate:          0.0575291624
  irr_projected:     0.118
  equity_required:   25700000

flags: []
blocking_flags: []

tier: "analyst"
institution_config_id: null
created_by: "test-fixture"
source_documents:
  - "mill_ave_commons_t12_2026.pdf"
  - "mill_ave_commons_prelease_report_aug2026.xlsx"
  - "asu_enrollment_fall_2026.pdf"
---

# Mill Ave Commons - Tempe, AZ

Purpose-built off-campus student housing two blocks from the ASU Tempe campus,
leased by the bed on academic-year terms. The underwriting case assumes the
property re-leases at the pre-lease pace shown in the August report and holds
rate flat, since the submarket has absorbed two new deliveries in the last
eighteen months.

Note the negative leverage: a 5.75% going-in cap against 6.25% debt puts
year-one cash-on-cash at 3.0%. The deal underwrites on rate growth and the
pre-lease premium, not on current coupon.

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
  "total_units": 180,
  "total_beds": 600,
  "beds_per_unit_avg": 3.3333333333,
  "year_built": 2017,
  "year_renovated": null,
  "building_class": "A",
  "asset_subtype": "purpose_built_off_campus",
  "university_served": "Arizona State University - Tempe",
  "university_enrollment": 65000,
  "distance_to_campus_miles": 0.3,
  "shuttle_provided": false,
  "stories": 6,
  "parking_spaces": 410,
  "land_area_acres": 2.2,
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
  "_notes": "Student housing leases by the bed, not by the unit, so occupancy is a bed count. preleased_beds is the signed count for the COMING academic year and is the leading revenue indicator; occupied_beds is the current in-place count. The two are measured at different dates and are deliberately not derived from each other.",
  "total_units": 180,
  "total_beds": 600,
  "occupied_beds": 567,
  "preleased_beds": 573,
  "occupancy": 0.945,
  "pre_lease_rate": 0.955,
  "vacancy_pct": 0.055,
  "average_monthly_rent_per_bed": 900,
  "lease_term_months": 12,
  "parental_guaranty_pct": 0.92,
  "unit_mix": [
    { "type": "4x4", "units": 120, "beds": 480, "occupied_beds": 454, "rent_per_bed": 875 },
    { "type": "2x2", "units": 60, "beds": 120, "occupied_beds": 113, "rent_per_bed": 1000 }
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
  "_notes": "Gross potential rent is quoted per bed per month across all 600 beds. Turnover/make-ready is carried as its own line because student housing turns nearly the entire property on a single August date, which makes it a materially larger and less smoothable cost than in conventional multifamily.",
  "income": {
    "gross_potential_rent": 6480000,
    "vacancy_credit_loss": 356400,
    "utility_reimbursements": 288000,
    "parking_income": 96000,
    "admin_application_fees": 54000,
    "other_income": 42000,
    "effective_gross_income": 6603600
  },
  "expenses": {
    "payroll": 620000,
    "property_taxes": 585000,
    "insurance": 178000,
    "utilities": 512000,
    "repairs_maintenance": 295000,
    "turnover_make_ready": 268000,
    "marketing_leasing": 196000,
    "management_fee": 264144,
    "general_admin": 142000,
    "security": 88000,
    "replacement_reserve": 90000,
    "total_operating_expenses": 3238144
  },
  "net_operating_income": 3365456,
  "expense_ratio": 0.4903604095,
  "revenue_per_bed": 11006,
  "rent_growth_pct_y1": 0.03,
  "turnover_cost_per_bed": 446.6666666667
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
  "purchase_price": 58500000,
  "going_in_cap_rate": 0.0575291624,
  "price_per_bed": 97500,
  "exit_cap_rate": 0.06
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
  "loan_amount": 35100000,
  "interest_rate": 0.0625,
  "loan_term_years": 10,
  "amortization_years": 30,
  "io_period_months": 0,
  "annual_debt_service": 2593400.85,
  "dscr": 1.2976998918,
  "ltv": 0.6,
  "debt_yield": 0.0958819373,
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
    "loan_amount": 35100000,
    "sponsor_equity": 25700000,
    "total": 60800000
  },
  "uses": {
    "purchase_price": 58500000,
    "closing_costs": 1170000,
    "capex_reserve": 850000,
    "working_capital": 280000,
    "total": 60800000
  },
  "total_sources": 60800000,
  "total_uses": 60800000
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
    "exit_cap_rate": 0.06,
    "annual_rent_growth": 0.03,
    "annual_enrollment_growth": 0.015
  },
  "levered_irr": 0.118,
  "summary": {
    "equity_multiple": 1.66
  }
}
```

## Pipeline Log {#pipeline_log}

```json uw:section=pipeline_log source=system/engine ts=2026-08-12T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "pipeline_log",
    "version": 1,
    "superseded": false,
    "source": "system/engine",
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
    "total_revenue": 6603600
  },
  "expenses": {
    "total_operating_expenses": 3238144
  },
  "net_operating_income": 3365456,
  "reconciles_to_noi_model": true
}
```

## Preliminary Sizing

Loan sizing against the three standard constraints. The governing test is dscr; the proposed loan of $35,100,000 fits inside it.

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
    "noi_underwritten": 3365456,
    "value_basis": 58500000,
    "annual_debt_constant": 0.0739
  },
  "constraints": [
    {
      "test": "max_ltv",
      "limit": 0.75,
      "max_loan": 43875000
    },
    {
      "test": "min_dscr",
      "limit": 1.25,
      "max_loan": 36439413
    },
    {
      "test": "min_debt_yield",
      "limit": 0.09,
      "max_loan": 37393956
    }
  ],
  "max_supportable_loan": 36439413,
  "governing_constraint": "dscr",
  "proposed_loan": 35100000,
  "proposed_within_constraints": true,
  "cushion": 1339413
}
```

## Borrower / Sponsor

Mill Avenue Student Housing LP — single-principal sponsorship; figures PFS-stated pending CPA verification.

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
      "name": "Priya Raman",
      "role": "managing_member",
      "ownership_pct": 1,
      "is_guarantor": true,
      "is_key_man": true,
      "net_worth_stated": 63180000,
      "liquid_assets_stated": 3861000,
      "contingent_liabilities_stated": 0,
      "years_cre_experience": 15,
      "pfs_received": true,
      "tax_returns_received": false,
      "figures_verified": false,
      "verification_basis": "pfs_stated"
    }
  ],
  "entity": {
    "name": "Mill Avenue Student Housing LP",
    "type": "llc",
    "state": "AZ"
  },
  "financial_summary": {
    "global_net_worth": 63180000,
    "global_liquidity": 3861000,
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

Tempe / ASU purpose-built student housing fundamentals as of 2026-08.

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
  "submarket": "Tempe / ASU",
  "data_as_of": "2026-08-01",
  "vacancy": {
    "current_rate": 0.035,
    "trend": "stable"
  },
  "rents": {
    "yoy_growth_pct": 0.032,
    "trend": "moderate"
  },
  "cap_rates": {
    "range_low": 0.055,
    "range_high": 0.06,
    "subject_going_in": 0.0575291624
  },
  "supply": {
    "note": "Two towers (1,150 beds) delivering pre-2027 within one mile of campus; ASU enrollment growth continues to absorb."
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
      "value": 1.2977,
      "threshold": {
        "type": "min",
        "min": 1.2,
        "max": null
      },
      "severity": "pass",
      "message": "DSCR (1.2977x) clears the 1.20x warning threshold.",
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
