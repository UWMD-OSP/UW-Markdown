---
uw_version: "3.0"
deal_id: "SRC-02-LEGACY-TAG"
deal_name: "Legacy Tag In Source"
created: "2026-08-31T00:00:00Z"
last_modified: "2026-08-31T00:00:00Z"
asset_class: multifamily
deal_stage: screening
---

# A canonical tag in the actor field

The pre-RFC-0031 spelling: a resolution method in `_meta.source`. Readers
interpret it as `resolution`, treat the actor as absent, and warn `SRC-02`.
The raw block bytes are never rewritten — `content._meta` feeds digests.

```json uw:section=property source=system/uwmd ts=2026-08-31T00:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "market_data",
      "resolution": "market_data",
      "actor": "system",
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
