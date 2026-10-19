---
uw_version: "3.0"
asset_class: office
deal_id: RFC0096-accept-own-prototype-named-variant
---

```json uw:section=rent_roll source=manual ts=2026-10-19T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "rent_roll",
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
  "rent_roll_type": "commercial",
  "as_of_date": "2026-01-01",
  "tenants": [
    {
      "tenant_name": "synthetic 0",
      "recovery_true_up": [
        {
          "period_start": "2025-01-01",
          "period_end": "2025-12-31",
          "settlement": "billed",
          "cash_flow_ref": {
            "variant": "toString"
          }
        }
      ]
    }
  ]
}
```
```json uw:section=cash_flow_series variant=toString source=manual ts=2026-10-19T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "cash_flow_series",
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
  "series": [
    {
      "date": "2026-01-01",
      "amount": 1
    }
  ]
}
```
