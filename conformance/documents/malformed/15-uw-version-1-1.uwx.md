---
uw_version: "1.1"
deal_id: TEST-MAL-015
deal_name: "Malformed: uw_version 1.1"
created: "2026-10-12T00:00:00Z"
last_modified: "2026-10-12T00:00:00Z"
asset_class: multifamily
deal_stage: screening
created_by: "test-fixture"
---

# Malformed fixture — uw_version 1.1

`uw_version` is declared as 1.1. Format 3.0 is the only admitted format: a reader refuses any other
value, or none, at parse stage (RFC 0081 D1). There is no partial read.

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
