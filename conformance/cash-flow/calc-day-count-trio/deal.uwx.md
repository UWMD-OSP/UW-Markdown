---
uw_version: "1.1"
deal_id: CF-DECL-06
asset_class: multifamily
---

# Cash-Flow Decl Fixture

```json uw:section=cash_flow_series variant=a365 source=manual ts=2026-09-02T00:00:00Z v=1
{
  "day_count": "actual/365f",
  "series": [
    {
      "date": "2026-01-15",
      "amount": -100
    },
    {
      "date": "2026-07-15",
      "amount": 105
    }
  ]
}
```

```json uw:section=cash_flow_series variant=a360 source=manual ts=2026-09-02T00:00:00Z v=1
{
  "day_count": "actual/360",
  "series": [
    {
      "date": "2026-01-15",
      "amount": -100
    },
    {
      "date": "2026-07-15",
      "amount": 105
    }
  ]
}
```

```json uw:section=cash_flow_series variant=us360 source=manual ts=2026-09-02T00:00:00Z v=1
{
  "day_count": "30/360us",
  "series": [
    {
      "date": "2026-01-15",
      "amount": -100
    },
    {
      "date": "2026-07-15",
      "amount": 105
    }
  ]
}
```
