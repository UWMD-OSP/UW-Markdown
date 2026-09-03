---
uw_version: "1.1"
deal_id: WF-R5
asset_class: multifamily
---

# Waterfall Fixture

```json uw:section=cash_flow_series variant=base source=manual ts=2026-09-02T00:00:00Z v=1
{
  "series": [
    {
      "date": "2026-01-01",
      "amount": -1000000
    },
    {
      "date": "2028-01-01",
      "amount": 2000000
    }
  ]
}
```

```json uw:section=distribution_waterfall variant=base source=manual ts=2026-09-02T00:00:00Z v=1
{
  "cash_flow_ref": {
    "variant": "upside"
  },
  "equity_split": {
    "lp": 0.9,
    "gp": 0.1
  },
  "tiers": [
    {
      "type": "return_of_capital"
    },
    {
      "type": "split",
      "lp_share": 0.8,
      "gp_share": 0.2
    }
  ]
}
```
