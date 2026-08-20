---
uw_version: "1.1"
deal_id: TEST-MAL-CC-11
deal_name: "Malformed: mixed-use-components-on-other-class"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "1 Mixed-Use Way"
city: "Phoenix"
state: "AZ"
zip: "85004"
asset_class: office
deal_stage: full_underwrite
status: under_review
recommendation: pending
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---

# Malformed mixed-use — CC-11

```json uw:section=valuation source=manual ts=2026-01-15T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-01-15T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "purchase_price": 40000000
}
```

```json uw:section=noi_model source=manual ts=2026-01-15T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-01-15T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "net_operating_income": 1672000
}
```

```json uw:section=components source=manual ts=2026-01-15T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "components",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-01-15T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "multifamily": {
    "component_class": "multifamily",
    "effective_gross_income": 2180000,
    "operating_expenses": 880000,
    "net_operating_income": 1300000,
    "total_units": 120,
    "nra_sqft": 96000,
    "allocation_pct": 0.78
  },
  "retail": {
    "component_class": "retail",
    "effective_gross_income": 520000,
    "operating_expenses": 148000,
    "net_operating_income": 372000,
    "nra_sqft": 18000,
    "allocation_pct": 0.22
  }
}
```
