---
uw_version: "3.0"
deal_id: "SRC-04-COLON-FORM"
deal_name: "Colon Form Rejected"
created: "2026-08-31T00:00:00Z"
last_modified: "2026-08-31T00:00:00Z"
asset_class: multifamily
deal_stage: screening
---

# The retired colon form

`agent:L0-01` raises `SRC-01`, and an actor writing under that spelling is
NOT classified as a human write â€” the prefix test's negative space used to
grant it `human_only` authority.

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

```json uw:section=valuation source=agent/L0-01 ts=2026-08-31T00:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "valuation",
    "provenance": {
      "source": "agent:L0-01",
      "actor": "system",
      "agent_id": "L0-01",
      "agent_version": "1.0.0",
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
  "purchase_price": 5000000
}
```
