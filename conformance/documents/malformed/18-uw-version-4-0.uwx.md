---
uw_version: "4.0"
deal_id: TEST-MAL-018
deal_name: "Malformed: uw_version 4.0"
created: "2026-10-12T00:00:00Z"
last_modified: "2026-10-12T00:00:00Z"
asset_class: multifamily
deal_stage: screening
created_by: "test-fixture"
---

# Malformed fixture — uw_version 4.0

`uw_version` is declared as 4.0. Format 3.0 is the only admitted format: a reader refuses any other
value, or none, at parse stage (RFC 0081 D1). There is no partial read.

## Property {#property}

```json uw:section=property source=manual ts=2026-10-12T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-10-12T00:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "total_units": 24,
  "year_built": 1998
}
```
