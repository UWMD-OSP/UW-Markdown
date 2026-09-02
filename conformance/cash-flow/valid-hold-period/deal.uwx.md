---
uw_version: "1.1"
deal_id: CF-VALID-01
asset_class: multifamily
---

# Cash-Flow Fixture

```json uw:section=property source=manual ts=2026-09-02T00:00:00Z v=1
{ "total_units": 48 }
```

```json uw:section=cash_flow_series variant=base source=manual ts=2026-09-02T00:00:00Z v=1
{
  "label": "Levered hold-period cash flow",
  "day_count": "actual/365f",
  "series": [
    {
      "date": "2026-03-17",
      "amount": -14250000,
      "kind": "acquisition",
      "label": "Close"
    },
    {
      "date": "2026-09-30",
      "amount": 412000,
      "kind": "operating"
    },
    {
      "date": "2027-03-31",
      "amount": 431000,
      "kind": "operating"
    },
    {
      "date": "2027-06-15",
      "amount": -350000,
      "kind": "capex"
    },
    {
      "date": "2031-03-17",
      "amount": 19800000,
      "kind": "disposition",
      "label": "Exit"
    }
  ],
  "stated_metrics": {
    "total_net": 6043000,
    "moic": 1.4139,
    "xnpv": {
      "rate": 0.06,
      "value": 1022812.04
    },
    "xirr": 0.075239
  }
}
```
