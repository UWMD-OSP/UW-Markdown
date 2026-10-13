---
uw_version: "3.0"
deal_id: TEST-MAL-021
deal_name: "Malformed: section_id wrapper"
created: "2026-10-12T00:00:00Z"
last_modified: "2026-10-12T00:00:00Z"
asset_class: multifamily
deal_stage: screening
created_by: "test-fixture"
---

# Malformed fixture — section_id wrapper

The retired `{section_id, _meta, content}` wrapper. A block is the bare payload with an
inline `_meta`; a top-level `section_id` member is META-01 (RFC 0081 §3).

## Property {#property}

```json uw:section=property source=manual ts=2026-10-12T00:00:00Z v=1 confidence=high
{
  "section_id": "property",
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
  "content": {
    "total_units": 24,
    "year_built": 1998
  }
}
```
