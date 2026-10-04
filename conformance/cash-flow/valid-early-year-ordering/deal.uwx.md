---
uw_version: "1.1"
deal_id: CF-VALID-03
asset_class: multifamily
---

# Cash-Flow Fixture

Ascending dates across the year-`0099`/`0100` boundary. They are in order on
the proleptic Gregorian calendar, so CF-02 must not fire.

```json uw:section=property source=manual ts=2026-09-02T00:00:00Z v=1
{ "total_units": 48 }
```

```json uw:section=cash_flow_series variant=base source=manual ts=2026-09-02T00:00:00Z v=1
{
  "series": [
    {
      "date": "0099-12-31",
      "amount": -100
    },
    {
      "date": "0100-01-01",
      "amount": 120
    }
  ]
}
```
