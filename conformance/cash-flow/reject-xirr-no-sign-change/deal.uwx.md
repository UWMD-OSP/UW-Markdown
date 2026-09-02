---
uw_version: "1.1"
deal_id: CF-REJECT-03
asset_class: multifamily
---

# Cash-Flow Fixture

```json uw:section=property source=manual ts=2026-09-02T00:00:00Z v=1
{ "total_units": 48 }
```

```json uw:section=cash_flow_series variant=base source=manual ts=2026-09-02T00:00:00Z v=1
{
  "series": [
    {
      "date": "2026-06-01",
      "amount": 100
    },
    {
      "date": "2027-06-01",
      "amount": 120
    }
  ],
  "stated_metrics": {
    "xirr": 0.2
  }
}
```
