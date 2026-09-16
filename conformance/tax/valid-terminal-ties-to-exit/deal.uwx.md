---
uw_version: "1.1"
deal_id: TAX-CONF
asset_class: multifamily
---

```json uw:section=noi_model variant=base source=manual ts=2026-09-15T00:00:00Z v=1
{
  "expenses": {
    "real_estate_taxes": {
      "value": 58000
    }
  }
}
```

```json uw:section=dcf variant=base source=manual ts=2026-09-15T00:00:00Z v=1
{
  "exit_analysis": {
    "exit_year": 5,
    "exit_value_gross": 7750733,
    "terminal_tax": {
      "trigger": "sale",
      "value_basis": 7750733,
      "assessment_ratio": 0.7,
      "assessed_value": 5425513.1,
      "millage_rate": 0.0115,
      "indicated_tax": 62393.4,
      "in_exit_noi": true
    }
  }
}
```
