---
uw_version: "1.1"
deal_id: TEST-SI-CC13-MU
deal_name: "Mixed-Use Without A Property-Level Size"
created: "2026-08-25T10:00:00Z"
last_modified: "2026-08-25T10:00:00Z"
property_address: "800 Blend Blvd"
city: "Phoenix"
state: "AZ"
zip: "85004"
asset_class: mixed_use
deal_stage: screening
status: under_review
recommendation: pending
flags: []
blocking_flags: []
tier: screener
created_by: "test-fixture"
---

# Mixed-Use Without A Property-Level Size

A mixed-use record whose property section states no size figure at all. Per
Protocol §XIII.2 the class has **no** property-level primary size field — its
sizes live per-component in `components` and do not sum — so `CC-13` must stay
silent. A registry that warned here would be demanding a number that must not
exist.

```json uw:section=property source=manual ts=2026-08-25T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-25T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "year_built": 2015
}
```

```json uw:section=components source=manual ts=2026-08-25T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "components",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-25T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "multifamily": {
    "component_class": "multifamily",
    "total_units": 120,
    "net_operating_income": 1500000,
    "allocation_pct": 0.75
  },
  "retail": {
    "component_class": "retail",
    "gross_leasable_area": 18000,
    "net_operating_income": 500000,
    "allocation_pct": 0.25
  }
}
```

```json uw:section=noi_model source=manual ts=2026-08-25T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-25T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "net_operating_income": 2000000
}
```
