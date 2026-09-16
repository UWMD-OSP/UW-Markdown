---
uw_version: "1.1"
deal_id: TAX-CONF
asset_class: multifamily
---

```json uw:section=noi_model variant=base source=manual ts=2026-09-15T00:00:00Z v=1
{
  "expenses": {
    "real_estate_taxes": {
      "value": 14790,
      "abatement": {
        "kind": "phase_in",
        "program": "Arizona GPLET",
        "stabilized_period": "Y2",
        "schedule": [
          {
            "period": "Y1",
            "full_tax": 58000,
            "abated_tax": 0
          },
          {
            "period": "Y2",
            "full_tax": 59160,
            "abated_tax": 14790
          },
          {
            "period": "Y3",
            "full_tax": 60343,
            "abated_tax": 30172
          }
        ]
      }
    }
  }
}
```
