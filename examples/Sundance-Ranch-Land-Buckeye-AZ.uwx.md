---
uw_version: "1.1"
deal_id: "uw_2026_land_001"
deal_name: "Sundance Ranch - Buckeye, AZ"
created: "2026-08-13T09:00:00Z"
last_modified: "2026-08-13T09:00:00Z"

property_address: "S Watson Rd & W Broadway Rd"
city: "Buckeye"
state: "AZ"
zip: "85326"
asset_class: "land"
asset_subtype: "entitled_residential"
loan_type: "land_acquisition"
scenario: "entitled_land_acquisition"

pipeline_state:
  L0_ingestion:    "complete"
  L1_screening:    "complete"
  L2_underwriting: "complete"
  L4_structuring:  "pending"
  L5_compliance:   "pending"
  L6_risk:         "pending"
  L7_assembly:     "pending"

status: "in_progress"
deal_stage: "screening"
recommendation: "pending"

quick_metrics:
  purchase_price:    16560000
  loan_amount:       8280000
  noi_underwritten:  -272000
  dscr:              null
  ltv:               0.5
  debt_yield:        null
  cap_rate:          null
  irr_projected:     0.19
  equity_required:   9626200

flags:
  - "negative_carry_by_design"
blocking_flags: []

tier: "analyst"
institution_config_id: null
created_by: "test-fixture"
source_documents:
  - "sundance_ranch_final_plat_2026.pdf"
  - "sundance_ranch_alta_survey_2026.pdf"
  - "buckeye_cfd_assessment_schedule_2026.pdf"
---

# Sundance Ranch - Buckeye, AZ

160 gross acres of entitled residential land in the far west Phoenix valley,
final-platted for 552 single-family lots. The business plan is a horizontal
development and finished-lot sale to production builders over a four-year
takedown.

**This deal has no cap rate, no DSCR, and no debt yield, and that is not an
omission.** Land is not an income property. The `noi_model` below carries the
annual cost of *holding* the dirt — property taxes, CFD assessments, insurance,
and site security — against a small grazing lease, so net operating income is
**negative $272,000**. The loan is an interest-only entitlement facility carried
out of the equity reserve in sources & uses, exactly as underwritten. Dividing
that negative NOI by the purchase price would produce a "-1.6% cap rate", which
is arithmetically valid and financially meaningless. The land pack omits those
three metrics rather than emitting misleading ones.

Land is underwritten here on basis and density instead: $30,000 per buildable
lot, $120,000 per usable acre, 86.25% of the gross acreage usable after the wash
and open-space dedications, and a land basis equal to 27.3% of the projected
finished-lot sellout.

## Property {#property}

```json uw:section=property source=manual ts=2026-08-13T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-13T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": "Usable acres are gross acres net of the regional wash, drainage easements, and dedicated open space. Entitled units is the final-plat lot count, not a density estimate.",
  "gross_acres": 160,
  "usable_acres": 138,
  "entitled_units": 552,
  "entitlement_status": "final_plat_recorded",
  "zoning": "R1-6 PAD",
  "asset_subtype": "entitled_residential",
  "planned_product": "single_family_detached",
  "utilities_to_site": true,
  "offsite_work_required": true,
  "cfd_district": "Buckeye CFD No. 4",
  "flood_zone": "X",
  "topography": "flat",
  "condition": "raw_entitled"
}
```

## Underwritten NOI {#noi_model}

```json uw:section=noi_model source=manual ts=2026-08-13T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-13T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": "For land this section is a CARRY model, not an operating model. Expenses are the annual cost of holding the asset; income is incidental interim revenue only. Net operating income is negative by design and must not be capitalized.",
  "income": {
    "grazing_lease": 18000,
    "effective_gross_income": 18000
  },
  "expenses": {
    "property_taxes": 148000,
    "insurance": 12000,
    "cfd_assessments": 96000,
    "site_maintenance_security": 34000,
    "total_operating_expenses": 290000
  },
  "net_operating_income": -272000,
  "is_carry_model": true,
  "annual_carry_cost": 290000,
  "carry_cost_per_acre": 1812.5
}
```

## Valuation {#valuation}

```json uw:section=valuation source=manual ts=2026-08-13T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-13T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": "going_in_cap_rate and exit_cap_rate are null by construction — there is no stabilized income to capitalize. Value is expressed per acre and per buildable unit, and tested against the projected finished-lot sellout.",
  "purchase_price": 16560000,
  "going_in_cap_rate": null,
  "exit_cap_rate": null,
  "price_per_acre": 103500,
  "price_per_usable_acre": 120000,
  "price_per_buildable_unit": 30000,
  "projected_gross_sellout": 60720000,
  "projected_lot_price": 110000,
  "valuation_method": "comparable_sales_and_residual"
}
```

## Debt Structure {#debt_structure}

```json uw:section=debt_structure source=manual ts=2026-08-13T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-13T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": "Interest-only land acquisition facility with partial-release provisions on lot takedown. Interest is funded from the entitlement carry reserve in sources & uses, not from operations — there are none.",
  "loan_amount": 8280000,
  "interest_rate": 0.0925,
  "loan_term_years": 3,
  "amortization_years": null,
  "io_period_months": 36,
  "annual_debt_service": 765900,
  "dscr": null,
  "ltv": 0.5,
  "debt_yield": null,
  "release_price_per_lot": 18000,
  "recourse": "full_recourse"
}
```

## Sources & Uses {#sources_uses}

```json uw:section=sources_uses source=manual ts=2026-08-13T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "sources_uses",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-13T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "sources": {
    "loan_amount": 8280000,
    "sponsor_equity": 9626200,
    "total": 17906200
  },
  "uses": {
    "purchase_price": 16560000,
    "closing_costs": 331200,
    "entitlement_carry_reserve": 870000,
    "due_diligence": 145000,
    "total": 17906200
  },
  "total_sources": 17906200,
  "total_uses": 17906200
}
```

## DCF & Hold Period {#dcf}

```json uw:section=dcf source=manual ts=2026-08-13T09:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "dcf",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-13T09:00:00Z",
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": "Returns come from lot takedown proceeds, not from an exit capitalization. There is no exit cap rate.",
  "assumptions": {
    "hold_period_years": 4,
    "exit_cap_rate": null,
    "annual_lot_price_growth": 0.03,
    "takedown_schedule_lots_per_year": [0, 138, 207, 207]
  },
  "levered_irr": 0.19,
  "summary": {
    "equity_multiple": 1.71
  }
}
```

## Pipeline Log {#pipeline_log}

```json uw:section=pipeline_log source=engine ts=2026-08-13T09:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "pipeline_log",
    "version": 1,
    "superseded": false,
    "source": "engine",
    "agent_id": null,
    "agent_version": null,
    "actor": "system",
    "timestamp": "2026-08-13T09:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "entries": [
    {
      "entry_id": "log_001",
      "timestamp": "2026-08-13T09:00:00Z",
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

## Validation

Financial-validity engine run. Income-property thresholds do not apply to a land carry; the run records the LTC test.

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
    "notes": "Land basis: no income-property thresholds (DSCR / debt yield / cap rate) apply — the carry statement nets negative by design. Sizing discipline lives in LTC and the interest reserve."
  },
  "overall_status": "clean",
  "financial_validity": [
    {
      "flag_id": "FV-001",
      "metric": "ltc",
      "value": 0.5,
      "threshold": {
        "type": "max",
        "min": null,
        "max": 0.8
      },
      "severity": "pass",
      "message": "LTC at 50.0% is well inside the 80% warning threshold for land.",
      "suppressed": false,
      "suppress_reason": null
    }
  ],
  "completeness": []
}
```
