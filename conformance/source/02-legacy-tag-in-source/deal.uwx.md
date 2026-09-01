---
uw_version: "1.1"
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

```json uw:section=property source=market_data ts=2026-08-31T00:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "market_data",
    "agent_id": null,
    "agent_version": null,
    "actor": "system",
    "timestamp": "2026-08-31T00:00:00Z",
    "confidence": "medium",
    "human_review_required": false
  },
  "total_units": 48
}
```
