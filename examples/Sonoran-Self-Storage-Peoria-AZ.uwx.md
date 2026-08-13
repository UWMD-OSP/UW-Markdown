---
uw_version: "1.1"
deal_id: "uw_2026_self_storage_001"
deal_name: "Sonoran Self Storage - Peoria, AZ"
created: "2026-06-05T09:00:00Z"
last_modified: "2026-06-05T09:00:00Z"

property_address: "8720 W Peoria Ave"
city: "Peoria"
state: "AZ"
zip: "85345"
asset_class: "self_storage"
asset_subtype: "drive_up_climate_control"
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
  purchase_price:    9600000
  loan_amount:       6240000
  noi_underwritten:  672000
  dscr:              1.3153
  ltv:               0.65
  debt_yield:        0.1076923077
  cap_rate:          0.07
  irr_projected:     0.071
  equity_required:   3560000

flags: []
blocking_flags: []

tier: "analyst"
institution_config_id: null
created_by: "test-fixture"
source_documents:
  - "sonoran_self_storage_t12_2026.pdf"
  - "sonoran_self_storage_rent_roll_may2026.xlsx"
---

# Sonoran Self Storage - Peoria, AZ

Stabilized self-storage acquisition in the northwest Phoenix metro with a mix of
drive-up and climate-controlled units. The underwriting case assumes modest rate
growth and continued physical occupancy above 85%.

## Property {#property}

```json uw:section=property source=manual ts=2026-06-05T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-06-05T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "rentable_units": 880,
  "occupied_units": 760,
  "net_rentable_square_feet": 82000,
  "year_built": 2014,
  "year_renovated": 2022,
  "building_class": "B",
  "asset_subtype": "drive_up_climate_control",
  "climate_controlled_pct": 0.32,
  "drive_up_pct": 0.68,
  "land_area_acres": 6.4,
  "condition": "good"
}
```

## Rent Roll {#rent_roll}

```json uw:section=rent_roll source=manual ts=2026-06-05T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "rent_roll",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-06-05T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "rentable_units": 880,
  "occupied_units": 760,
  "physical_occupancy": 0.8636363636,
  "economic_occupancy": 0.975,
  "vacancy_pct": 0.1363636364,
  "economic_vacancy_pct": 0.15,
  "average_monthly_rent_per_occupied_unit": 118.42,
  "unit_mix": [
    { "type": "drive_up", "units": 598, "occupied_units": 524, "nrsf": 55760 },
    { "type": "climate_control", "units": 282, "occupied_units": 236, "nrsf": 26240 }
  ]
}
```

## NOI Model {#noi_model}

```json uw:section=noi_model source=manual ts=2026-06-05T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-06-05T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "income": {
    "gross_potential_rent": 1080000,
    "economic_vacancy_loss": 162000,
    "admin_fees": 45000,
    "tenant_insurance_income": 72000,
    "other_income": 18000,
    "effective_gross_income": 1053000
  },
  "expenses": {
    "payroll": 105000,
    "property_taxes": 92000,
    "insurance": 34000,
    "utilities": 26000,
    "repairs_maintenance": 24000,
    "marketing": 18000,
    "management_fee": 52000,
    "general_admin": 30000,
    "total_operating_expenses": 381000
  },
  "net_operating_income": 672000,
  "expense_ratio": 0.3618233618,
  "rent_growth_pct_y1": 0.025,
  "revenue_per_nrsf": 12.8414634146
}
```

## Valuation {#valuation}

```json uw:section=valuation source=manual ts=2026-06-05T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-06-05T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "purchase_price": 9600000,
  "going_in_cap_rate": 0.07,
  "price_per_nrsf": 117.0731707317,
  "exit_cap_rate": 0.0675
}
```

## Debt Structure {#debt_structure}

```json uw:section=debt_structure source=manual ts=2026-06-05T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-06-05T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "loan_amount": 6240000,
  "interest_rate": 0.0675,
  "loan_term_years": 7,
  "amortization_years": 30,
  "io_period_months": 0,
  "annual_debt_service": 510606,
  "dscr": 1.3153,
  "ltv": 0.65,
  "debt_yield": 0.1076923077,
  "recourse": "non_recourse"
}
```

## Sources & Uses {#sources_uses}

```json uw:section=sources_uses source=manual ts=2026-06-05T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "sources_uses",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-06-05T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "sources": {
    "loan_amount": 6240000,
    "sponsor_equity": 3560000,
    "total": 9800000
  },
  "uses": {
    "purchase_price": 9600000,
    "closing_costs": 150000,
    "reserves": 50000,
    "total": 9800000
  },
  "total_sources": 9800000,
  "total_uses": 9800000
}
```

## DCF {#dcf}

```json uw:section=dcf source=manual ts=2026-06-05T09:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "dcf",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-06-05T09:00:00Z",
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "assumptions": {
    "hold_period_years": 5,
    "exit_cap_rate": 0.0675,
    "annual_rent_growth": 0.025
  },
  "levered_irr": 0.071,
  "summary": {
    "equity_multiple": 1.52
  }
}
```

## Pipeline Log {#pipeline_log}

```json uw:section=pipeline_log source=engine ts=2026-06-05T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "pipeline_log",
    "version": 1,
    "superseded": false,
    "source": "engine",
    "agent_id": null,
    "agent_version": null,
    "actor": "system",
    "timestamp": "2026-06-05T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "entries": [
    {
      "entry_id": "log_001",
      "timestamp": "2026-06-05T09:00:00Z",
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
