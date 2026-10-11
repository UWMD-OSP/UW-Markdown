---
uw_version: "3.0"
deal_id: "SRC-03-UNMATCHED-SUPERSEDES"
deal_name: "Unmatched Supersedes"
created: "2026-08-31T00:00:00Z"
last_modified: "2026-08-31T00:00:00Z"
asset_class: multifamily
deal_stage: screening
---

# The regression test for RFC 0031

An edit to a block whose source matches only the `*` catch-all must supersede,
and a `section_replace` against it must be refused. This is the case that
silently destroyed data before the catch-all existed.

```json uw:section=property source=legacy-import-tool ts=2026-08-31T00:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "legacy-import-tool",
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
