---
uw_version: "3.0"
asset_class: mixed_use
deal_id: rfc0096-authored-control
---

```json uw:section=capital_stack source=manual ts=2026-10-19T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "capital_stack",
    "provenance": {
      "source": "manual",
      "actor": "conformance-author",
      "timestamp": "2026-10-19T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "tranches": [
    {
      "id": "senior",
      "class": "senior_debt",
      "position": 1,
      "amount": 1,
      "rate": 0.05,
      "accrual": "cash"
    }
  ],
  "sizing": [
    {
      "id": "",
      "fn": "bad",
      "over": "senior",
      "through": 1,
      "value": false,
      "extra": 1
    },
    false
  ]
}
```
```json uw:section=components source=manual ts=2026-10-19T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "components",
    "provenance": {
      "source": "manual",
      "actor": "conformance-author",
      "timestamp": "2026-10-19T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "multifamily": {
    "component_class": "multifamily",
    "capital_stack": {
      "sizing": false
    }
  }
}
```
