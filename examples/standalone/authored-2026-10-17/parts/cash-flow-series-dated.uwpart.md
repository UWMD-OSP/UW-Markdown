---
uw_version: "3.0"
uwpart_version: "1.0"
part_id: authored-2026-10-17-cash-flow-series-dated
section: cash_flow_series
---

## Cash Flow Series {#cash_flow_series}

```json uw:section=cash_flow_series v=1
{
  "_meta": {
    "section": "cash_flow_series",
    "provenance": {
      "source": "system/standalone-kit",
      "actor": "analyst",
      "timestamp": "2026-10-17T21:34:15Z",
      "notes": "Human review is required before reusing this illustrative stated-data fragment; revision 1 is the current block of its new part identity."
    },
    "quality": {
      "confidence": "medium",
      "human_review_required": true,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "series_id": "parkview-stated-ledger",
  "currency": "USD",
  "period_kind": "date",
  "series": [
    {
      "date": "2026-01-01",
      "amount": -48000000,
      "label": "acquisition"
    },
    {
      "date": "2026-12-31",
      "amount": 2140000,
      "label": "stated_unlevered_cash"
    }
  ],
  "calculation_boundary": "Dated stated cash lines; no return metric is calculated in this fragment."
}
```

