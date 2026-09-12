---
uw_version: "2.0"
deal_id: SYNTHETIC-PROPERTY-CASH-FLOWS
deal_name: "Synthetic assembly test ledger"
asset_class: office
deal_stage: intake
created: "2026-09-12T00:00:00Z"
last_modified: "2026-09-12T00:00:00Z"
---

# Synthetic property cash-flow assembly

Engineering test inputs only. No actual property, transaction or underwriting
recommendation. The owner requested synthetic fixtures before real-deal review.

The restricted reserve funds separate maintenance work. Its internal spending
is excluded from every cash row below, including lease-up TI/LC and nonleasing
capex. The stated release is the remaining balance; no restricted reserve remains
after disposition. These are authored test assertions, not a reserve rollforward.

```json uw:section=lease_up_schedule variant=base source=manual ts=2026-09-12T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "lease_up_schedule",
    "provenance": {
      "source": "manual",
      "resolution": "manual_override",
      "actor": "synthetic-test-author",
      "timestamp": "2026-09-12T00:00:00Z",
      "notes": "Synthetic engineering inputs, not an actual property or investment."
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
  "model_type": "natural_turnover",
  "period_granularity": "quarterly",
  "schedule": [
    {
      "period": "2026-Q3",
      "rent_revenue": null,
      "concessions": -1000,
      "ti_lc_capex": -10000,
      "net_cash_flow": 109000
    },
    {
      "period": "2026-Q4",
      "rent_revenue": 130000,
      "concessions": 0,
      "ti_lc_capex": -5000,
      "net_cash_flow": 125000
    }
  ]
}
```

```json uw:section=cash_flow_series variant=base source=manual ts=2026-09-12T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "cash_flow_series",
    "provenance": {
      "source": "manual",
      "resolution": "manual_override",
      "actor": "synthetic-test-author",
      "timestamp": "2026-09-12T00:00:00Z",
      "notes": "Synthetic engineering inputs, not an actual property or investment."
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
  "day_count": "actual/365f",
  "series": [
    {
      "date": "2026-07-01",
      "amount": -1000000,
      "label": "Synthetic purchase price"
    },
    {
      "date": "2026-07-01",
      "amount": -10000,
      "label": "Synthetic acquisition costs"
    },
    {
      "date": "2026-07-01",
      "amount": -20000,
      "label": "Synthetic restricted reserve funding"
    },
    {
      "date": "2026-09-30",
      "amount": 0,
      "label": "Synthetic stated zero other income"
    },
    {
      "date": "2026-09-30",
      "amount": -40000,
      "label": "Synthetic operating cash expenses"
    },
    {
      "date": "2026-12-31",
      "amount": -45000,
      "label": "Synthetic operating cash expenses"
    },
    {
      "date": "2026-12-31",
      "amount": -10000,
      "label": "Synthetic nonleasing capital paid outside reserve"
    },
    {
      "date": "2026-12-31",
      "amount": 1150000,
      "label": "Synthetic gross sale excluding reserve release"
    },
    {
      "date": "2026-12-31",
      "amount": -20000,
      "label": "Synthetic sale costs"
    },
    {
      "date": "2026-12-31",
      "amount": 5000,
      "label": "Synthetic remaining reserve release"
    }
  ]
}
```
