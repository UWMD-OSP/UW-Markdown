---
uw_version: "3.0"
deal_id: "SRC-05-NO-CATCHALL"
deal_name: "No Catch-All"
created: "2026-08-31T00:00:00Z"
last_modified: "2026-08-31T00:00:00Z"
asset_class: multifamily
deal_stage: screening
---

# An incomplete policy list is a refusal, not a grant

A caller-supplied policy list that covers no pattern matching the block's
source must refuse the write. Reading "no policy" as authorization is how
the unpoliced-write path opened.

```json uw:section=property source=manual ts=2026-08-31T00:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "analyst",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-31T00:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "medium",
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
  "total_units": 48
}
```
