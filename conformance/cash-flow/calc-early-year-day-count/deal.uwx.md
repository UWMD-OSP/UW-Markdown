---
uw_version: "1.1"
deal_id: CF-DECL-07
asset_class: multifamily
---

# Cash-Flow Decl Fixture

A synthetic two-flow series across proleptic Gregorian year `0000`, which is a
leap year: `0000-01-01` to `0001-01-01` spans 366 actual days. The two variants
differ only in their actual-day convention.

```json uw:section=cash_flow_series variant=a365 source=manual ts=2026-09-02T00:00:00Z v=1
{
  "day_count": "actual/365f",
  "series": [
    {
      "date": "0000-01-01",
      "amount": -100
    },
    {
      "date": "0001-01-01",
      "amount": 110
    }
  ]
}
```

```json uw:section=cash_flow_series variant=a360 source=manual ts=2026-09-02T00:00:00Z v=1
{
  "day_count": "actual/360",
  "series": [
    {
      "date": "0000-01-01",
      "amount": -100
    },
    {
      "date": "0001-01-01",
      "amount": 110
    }
  ]
}
```
