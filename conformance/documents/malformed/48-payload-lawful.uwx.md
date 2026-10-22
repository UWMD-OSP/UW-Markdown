---
uw_version: "3.0"
asset_class: multifamily
deal_id: rfc0096-authored-control
---

```json uw:section=lease_up_schedule source=manual ts=2026-10-19T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "lease_up_schedule",
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
  "model_type": "absorption_curve",
  "period_granularity": "monthly",
  "stabilization_target": null,
  "assumptions": null,
  "schedule": [
    {
      "period": "2026-01",
      "occupied_sf": null,
      "net_cash_flow": -1
    }
  ],
  "stabilized_summary": null,
  "_notes": false
}
```
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
      "recovery_terms": {
        "cap": {
          "pct": 0.05,
          "accumulation": null
        }
      },
      "recovery_true_up": null
    }
  ]
}
```
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
  "point_in_time": "stabilization",
  "tranches": [],
  "sizing": []
}
```
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
  "stated_outcomes": null,
  "stated_schedule": [
    {
      "date": "0000-99-99",
      "by_tier": []
    }
  ],
  "clawback": {
    "basis": "lp_irr_floor",
    "floor_rate": 0.08,
    "floor_multiple": null,
    "cap": "promote_received"
  }
}
```
