---
uw_version: "3.0"
deal_id: TEST-MAL-022
deal_name: "Malformed: resolution outside the closed vocabulary"
created: "2026-10-12T00:00:00Z"
last_modified: "2026-10-12T00:00:00Z"
asset_class: multifamily
deal_stage: screening
created_by: "test-fixture"
---

# Malformed fixture — resolution outside the closed vocabulary

`provenance.resolution` must be a member of the closed resolution vocabulary (Format §2.6).
`manual` is an actor, not a resolution: SRC-03, an error.

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
      "notes": null,
      "resolution": "manual"
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
