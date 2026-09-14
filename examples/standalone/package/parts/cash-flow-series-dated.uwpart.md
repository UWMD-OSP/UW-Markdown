---
uwpart_version: "1.0"
part_id: cash-flow-series-dated
section: cash_flow_series
---

## Cash Flow Series {#cash_flow_series}

```json uw:section=cash_flow_series v=1
{
  "_meta": {
    "section": "cash_flow_series",
    "version": 1,
    "superseded": false,
    "source": "system/uwmd",
    "resolution": "source_document",
    "agent_id": null,
    "agent_version": null,
    "actor": "example-kit",
    "ts": "2026-09-13T00:00:00Z"
  },
  "series_id": "parkview-stated-ledger",
  "currency": "USD",
  "period_kind": "date",
  "flows": [
    { "date": "2026-01-01", "amount": -48000000, "label": "acquisition" },
    { "date": "2026-12-31", "amount": 2140000, "label": "stated_unlevered_cash" }
  ],
  "calculation_boundary": "Dated stated cash lines; no return metric is calculated in this fragment."
}
```

