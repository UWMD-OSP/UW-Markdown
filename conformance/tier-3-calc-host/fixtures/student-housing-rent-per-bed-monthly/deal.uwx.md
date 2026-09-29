---
uw_version: "1.1"
deal_id: TEST-T3-STUDENT-002
deal_name: "Student Housing Rent Per Bed Monthly"
created: "2026-09-28T00:00:00Z"
last_modified: "2026-09-28T00:00:00Z"
property_address: "300 Campus Way"
city: "Tempe"
state: "AZ"
zip: "85281"
asset_class: student_housing
deal_stage: full_underwrite
status: under_review
recommendation: pending
flags: []
blocking_flags: []
tier: analyst
created_by: "conformance"
---

# Student Housing Rent Per Bed Monthly

Pins `rent_per_bed_monthly` over a `noi_model` shaped as format §4.5 states
it: `income.gross_potential_rent` is `{ value, source, ... }`, not a number.
Result = 6,480,000 / (600 × 12) = 900.

```json uw:section=property source=manual ts=2026-09-28T00:00:00Z v=1 confidence=high
{
  "section_id": "property",
  "_meta": {
    "section_id": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "conformance",
    "timestamp": "2026-09-28T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": { "total_beds": 600 }
}
```

```json uw:section=noi_model source=manual ts=2026-09-28T00:00:00Z v=1 confidence=high
{
  "section_id": "noi_model",
  "_meta": {
    "section_id": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "conformance",
    "timestamp": "2026-09-28T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": {
    "underwriting_basis": "stabilized",
    "income": {
      "gross_potential_rent": {
        "value": 6480000,
        "source": "rent_roll",
        "per_unit_monthly": null,
        "per_sqft_annually": null,
        "rationale": "Quoted per bed per month across all 600 beds."
      },
      "vacancy_credit_loss": {
        "value": 356400,
        "rate_applied": 0.055,
        "source": "underwritten",
        "vs_t12_actual": null,
        "vs_submarket_avg": null,
        "rationale": null
      },
      "other_income": {
        "value": 480000,
        "vs_t12": null,
        "non_recurring_excluded": null,
        "breakdown": {}
      },
      "effective_gross_income": 6603600
    },
    "expenses": {
      "total_operating_expenses": 3238144
    },
    "net_operating_income": 3365456
  }
}
```
