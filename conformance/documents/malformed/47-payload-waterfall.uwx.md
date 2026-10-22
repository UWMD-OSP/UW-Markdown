---
uw_version: "3.0"
asset_class: multifamily
deal_id: rfc0096-authored-control
---

```json uw:section=distribution_waterfall source=manual ts=2026-10-19T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "distribution_waterfall",
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
  "cash_flow_ref": {
    "variant": "equity"
  },
  "equity_split": {
    "lp": 0.9,
    "gp": 0.1
  },
  "tiers": [
    {
      "type": "split",
      "lp_share": 0.9,
      "gp_share": 0.1
    }
  ],
  "clawback": {
    "basis": "lp_preferred_shortfall",
    "floor_rate": 0,
    "floor_multiple": 1,
    "net_of_tax_rate": null,
    "cap": "promote_received",
    "extra": 0
  },
  "stated_outcomes": {
    "lp": {
      "contributions": false,
      "moic": -1,
      "extra": 0
    },
    "gp": null,
    "promote_total": "bad",
    "extra": 0
  },
  "stated_schedule": [
    {
      "date": "2026-02-30",
      "by_tier": [
        {
          "tier": -1,
          "lp": false,
          "extra": 0
        }
      ],
      "extra": 0
    },
    {
      "date": "2026-01-01\n",
      "by_tier": false
    }
  ]
}
```
