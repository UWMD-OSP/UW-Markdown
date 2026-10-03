---
uw_version: "1.1"
deal_id: HDG-CONF
asset_class: office
currency_code: USD
---

```json uw:section=debt_structure variant=base source=manual ts=2026-10-03T00:00:00Z v=1
{
  "loan_amount": 40000000,
  "rate_type": "floating",
  "rate_index": "sofr",
  "rate_spread_bps": 275,
  "rate_cap_pct": 0.035,
  "rate_hedge": {
    "instrument": "rate_cap",
    "notional": 30000000,
    "strike_rate": 0.035,
    "index": "sofr",
    "effective_date": "2026-01-01",
    "expiration_date": "2028-01-01",
    "premium": 400000,
    "post_expiration_assumption": "replace"
  }
}
```

```json uw:section=sources_uses variant=base source=manual ts=2026-10-03T00:00:00Z v=1
{}
```

```json uw:section=cash_flow_series variant=cap-cash source=manual ts=2026-10-03T00:00:00Z v=1
{
  "series": [
    {
      "date": "2026-01-01",
      "amount": -400000,
      "kind": "debt_service",
      "label": "rate_cap_premium"
    },
    {
      "date": "2028-01-01",
      "amount": -360000,
      "kind": "debt_service",
      "label": "rate_cap_replacement_purchase"
    }
  ]
}
```
