---
uw_version: "1.1"
deal_id: CF-REJECT-04
asset_class: multifamily
---

# Cash-Flow Fixture

Descending dates in early years: `0150-01-01`, then `0050-01-01`. They are out
of order on the proleptic Gregorian calendar, so CF-02 must fire.

```json uw:section=property source=manual ts=2026-09-02T00:00:00Z v=1
{ "total_units": 48 }
```

```json uw:section=cash_flow_series variant=base source=manual ts=2026-09-02T00:00:00Z v=1
{
  "series": [
    {
      "date": "0150-01-01",
      "amount": -100
    },
    {
      "date": "0050-01-01",
      "amount": 120
    }
  ]
}
```
