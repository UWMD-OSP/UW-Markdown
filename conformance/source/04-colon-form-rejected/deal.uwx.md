---
uw_version: "1.1"
deal_id: "SRC-04-COLON-FORM"
deal_name: "Colon Form Rejected"
created: "2026-08-31T00:00:00Z"
last_modified: "2026-08-31T00:00:00Z"
asset_class: multifamily
deal_stage: screening
---

# The retired colon form

`agent:L0-01` raises `SRC-01`, and an actor writing under that spelling is
NOT classified as a human write — the prefix test's negative space used to
grant it `human_only` authority.

```json uw:section=property source=manual ts=2026-08-31T00:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "analyst",
    "timestamp": "2026-08-31T00:00:00Z",
    "confidence": "medium",
    "human_review_required": false
  },
  "total_units": 48
}
```

```json uw:section=valuation source=agent:L0-01 ts=2026-08-31T00:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "agent:L0-01",
    "agent_id": "L0-01",
    "agent_version": "1.0.0",
    "actor": "system",
    "timestamp": "2026-08-31T00:00:00Z",
    "confidence": "medium",
    "human_review_required": false
  },
  "purchase_price": 5000000
}
```
