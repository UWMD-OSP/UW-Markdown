---
uw_version: "3.0"
deal_id: TEST-MAL-023
deal_name: "Malformed: retired official alias"
created: "2026-10-12T00:00:00Z"
last_modified: "2026-10-12T00:00:00Z"
asset_class: org.uwmd.data_center
deal_stage: screening
created_by: "test-fixture"
---

# Malformed fixture — retired official alias

`org.uwmd.data_center` is an ordinary namespaced identifier that ends in a builtin name.
It is refused like any other (RFC 0081 §5); the builtin is spelled `data_center`.

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
