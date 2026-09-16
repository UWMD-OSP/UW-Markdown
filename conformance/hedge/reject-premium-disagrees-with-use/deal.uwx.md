---
uw_version: "1.1"
deal_id: HDG-CONF
asset_class: office
---

```json uw:section=debt_structure variant=base source=manual ts=2026-09-15T00:00:00Z v=1
{
  "loan_amount": 40000000,
  "rate_type": "floating",
  "rate_index": "sofr",
  "rate_spread_bps": 275,
  "rate_hedge": {
    "instrument": "rate_cap",
    "notional": 30000000,
    "strike_rate": 0.035,
    "index": "sofr",
    "effective_date": "2026-01-01",
    "expiration_date": "2029-01-01",
    "premium": 410000,
    "post_expiration_assumption": "unhedged"
  }
}
```

```json uw:section=sources_uses variant=base source=manual ts=2026-09-15T00:00:00Z v=1
{
  "uses": {
    "rate_cap_cost": 500000
  }
}
```
