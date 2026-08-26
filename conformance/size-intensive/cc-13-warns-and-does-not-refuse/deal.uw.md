---
uw_version: "1.1"
deal_id: TEST-SI-CC13-WARN
deal_name: "Office Without A Stated RSF"
created: "2026-08-25T10:00:00Z"
last_modified: "2026-08-25T10:00:00Z"
property_address: "700 Size Way"
city: "Phoenix"
state: "AZ"
zip: "85004"
asset_class: office
deal_stage: screening
status: under_review
recommendation: pending
flags: []
blocking_flags: []
tier: screener
created_by: "test-fixture"
---

# Office Without A Stated RSF

A screening-stage office record that never states `rentable_square_feet`.
`CC-13` (RFC 0027, Protocol §XIII.1) must fire as a **warning** — and only a
warning: the document still parses, still validates without errors, and the
pack calcs that do not divide by RSF still evaluate. The gaps machinery, not a
refusal, owns "we don't know this yet."

```json uw:section=property source=manual ts=2026-08-25T10:00:00Z v=1 confidence=medium
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
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "year_built": 1998,
  "building_class": "B"
}
```

```json uw:section=valuation source=manual ts=2026-08-25T10:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-25T10:00:00Z",
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "purchase_price": 12000000
}
```

```json uw:section=noi_model source=manual ts=2026-08-25T10:00:00Z v=1 confidence=medium
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
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "_notes": null,
  "net_operating_income": 690000
}
```
