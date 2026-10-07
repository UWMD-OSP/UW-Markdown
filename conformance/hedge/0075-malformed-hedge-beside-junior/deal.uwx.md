---
uw_version: "1.1"
deal_id: HDG-CONF
asset_class: office
currency_code: USD
---

```json uw:section=debt_structure variant=bridge source=manual ts=2026-10-03T00:00:00Z v=1
{
  "loan_amount": 40000000,
  "rate_type": "floating",
  "rate_index": "sofr",
  "rate_spread_bps": 275,
  "rate_cap_pct": 0.035,
  "rate_hedge": "rate_cap",
  "_role": "senior"
}
```

```json uw:section=debt_structure variant=mezz source=manual ts=2026-10-03T00:00:00Z v=1
{
  "loan_amount": 40000000,
  "rate_type": "floating",
  "rate_index": "sofr",
  "rate_spread_bps": 275,
  "rate_cap_pct": 0.035,
  "_role": "junior"
}
```

```json uw:section=sources_uses variant=base source=manual ts=2026-10-03T00:00:00Z v=1
{
  "uses": {
    "rate_cap_cost": 400000,
    "interest_reserve": 750000,
    "escrows": [
      {
        "name": "tax",
        "upfront": 120000,
        "monthly": 30000,
        "lender_required": true
      },
      {
        "name": "insurance",
        "monthly": 8000
      },
      {
        "name": "interest",
        "upfront": 750000
      },
      {
        "name": "other",
        "label": "Seismic retrofit holdback",
        "upfront": 250000
      },
      {
        "name": "rate_cap_replacement",
        "upfront": 0,
        "monthly": 12500
      }
    ]
  }
}
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
