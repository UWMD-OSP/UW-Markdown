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

A resolution method in `_meta.provenance.source`, where an actor belongs.
It is `SRC-02`, an error. Readers read `_meta` as stated: the tag is never
reinterpreted as a resolution (RFC 0081 §3).

```json uw:section=property source=system/uwmd ts=2026-08-31T00:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "market_data",
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
