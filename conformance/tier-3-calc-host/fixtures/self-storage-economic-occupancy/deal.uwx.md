---
uw_version: "1.1"
deal_id: TEST-T3-STORAGE-001
deal_name: "Self-Storage Economic Occupancy"
created: "2026-09-28T00:00:00Z"
last_modified: "2026-09-28T00:00:00Z"
property_address: "9100 W Bell Rd"
city: "Peoria"
state: "AZ"
zip: "85382"
asset_class: self_storage
deal_stage: full_underwrite
status: under_review
recommendation: pending
flags: []
blocking_flags: []
tier: analyst
created_by: "conformance"
---

# Self-Storage Economic Occupancy

Pins `economic_occupancy` over a `noi_model` shaped as format §4.5 states it:
`income.gross_potential_rent` is `{ value, source, ... }`, not a number.
Result = 1,053,000 / 1,080,000 = 0.975.

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
  "content": { "net_rentable_square_feet": 82000, "rentable_units": 640 }
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
        "value": 1080000,
        "source": "rent_roll",
        "per_unit_monthly": null,
        "per_sqft_annually": null,
        "rationale": null
      },
      "vacancy_credit_loss": {
        "value": 162000,
        "rate_applied": 0.15,
        "source": "underwritten",
        "vs_t12_actual": null,
        "vs_submarket_avg": null,
        "rationale": null
      },
      "other_income": {
        "value": 135000,
        "vs_t12": null,
        "non_recurring_excluded": null,
        "breakdown": {}
      },
      "effective_gross_income": 1053000
    },
    "expenses": {
      "total_operating_expenses": 381000
    },
    "net_operating_income": 672000
  }
}
```
