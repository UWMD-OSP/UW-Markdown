---
uw_version: "1.1"
deal_id: "SRC-01-ACTOR-AND-RESOLUTION"
deal_name: "Actor And Resolution"
created: "2026-08-31T00:00:00Z"
last_modified: "2026-08-31T00:00:00Z"
asset_class: multifamily
deal_stage: screening
---

# Actor and resolution round-trip independently

A block written by agent L6-01 from the asset-class default table carries both
facts, and neither substitutes for the other.

```json uw:section=property source=agent/L6-01 ts=2026-08-31T00:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "agent/L6-01",
    "resolution": "asset_class_default",
    "agent_id": "L6-01",
    "agent_version": "1.0.0",
    "actor": "system",
    "timestamp": "2026-08-31T00:00:00Z",
    "confidence": "medium",
    "human_review_required": false,
    "field_overrides": [
      { "path": "year_built", "resolution": "user_input" }
    ]
  },
  "total_units": 48,
  "year_built": 1998
}
```
