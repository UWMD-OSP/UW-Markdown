---
uw_version: "3.0"
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
    "strike_rate": 0.035,
    "notional": 30000000,
    "index": "sofr"
  }
}
```
