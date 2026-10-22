---
uw_version: "3.0"
asset_class: multifamily
deal_id: rfc0096-authored-control
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
  "tenants": [
    {
      "tenant_name": "synthetic",
      "recovery_terms": {
        "method": "net",
        "pro_rata_share": 0.5,
        "share_basis": "bad",
        "base_year": "bad",
        "admin_fee_pct": 1,
        "cap": {
          "pct": 0.05,
          "over": "bad",
          "accumulation": null
        }
      },
      "recovery_true_up": [
        {
          "period_start": "2025-01-01",
          "period_end": "2025-12-31",
          "settlement": "unsettled",
          "pool_actual": -1,
          "extra": 0
        }
      ]
    }
  ]
}
```
