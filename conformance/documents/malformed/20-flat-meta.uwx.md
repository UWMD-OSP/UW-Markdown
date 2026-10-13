---
uw_version: "3.0"
deal_id: TEST-MAL-020
deal_name: "Malformed: flat _meta"
created: "2026-10-12T00:00:00Z"
last_modified: "2026-10-12T00:00:00Z"
asset_class: multifamily
deal_stage: screening
created_by: "test-fixture"
---

# Malformed fixture — flat _meta

The retired flat `_meta` shape (`version`, `source`, … at its top level) in a Format 3.0
file. `_meta` must be the nested object; anything else is META-01 (RFC 0081 §3).

## Property {#property}

```json uw:section=property source=manual ts=2026-10-12T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-10-12T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "total_units": 24,
  "year_built": 1998
}
```
