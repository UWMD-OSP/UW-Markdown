---
uw_version: "1.1"
deal_id: "SRC-03-REPLACED-IN-PLACE"
deal_name: "Replaced In Place"
created: "2026-08-31T00:00:00Z"
last_modified: "2026-08-31T00:00:00Z"
asset_class: multifamily
deal_stage: screening
---

# What the bug used to produce

Version 2 of a catch-all-governed section with no superseded prior block:
the predecessor was overwritten in place. Provenance verification must
report `POL-02`.

```json uw:section=property source=legacy-import-tool ts=2026-08-31T00:00:00Z v=2 confidence=medium
{
  "_meta": {
    "section": "property",
    "version": 2,
    "superseded": false,
    "source": "legacy-import-tool",
    "agent_id": null,
    "agent_version": null,
    "actor": "system",
    "timestamp": "2026-08-31T00:00:00Z",
    "confidence": "medium",
    "human_review_required": false
  },
  "total_units": 52
}
```
