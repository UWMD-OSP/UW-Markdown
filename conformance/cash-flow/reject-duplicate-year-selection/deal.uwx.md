---
uw_version: "2.0"
deal_id: SYNTHETIC-SAME-DAY
asset_class: office
deal_stage: intake
---

# Synthetic same-day conformance

Engineering inputs only.

```json uw:section=property variant=base source=manual ts=2026-09-24T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "resolution": "manual_override",
      "actor": "synthetic-test-author",
      "timestamp": "2026-09-24T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": true,
      "flags": []
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    },
    "integrity": {
      "input_hash": null,
      "parent_hash": null
    }
  },
  "asset_class": "office",
  "rentable_square_feet": 1000
}
```

```json uw:section=dcf variant=base source=manual ts=2026-09-24T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "dcf",
    "provenance": {
      "source": "manual",
      "resolution": "manual_override",
      "actor": "synthetic-test-author",
      "timestamp": "2026-09-24T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": true,
      "flags": []
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    },
    "integrity": {
      "input_hash": null,
      "parent_hash": null
    }
  },
  "annual_cash_flows": [
    {
      "year": 1,
      "noi": 100
    },
    {
      "year": 1,
      "noi": 110
    },
    {
      "year": 2,
      "noi": 150
    }
  ]
}
```
