---
uw_version: "1.1"
deal_id: TAX-CONF
asset_class: multifamily
---

```json uw:section=noi_model variant=base source=manual ts=2026-09-15T00:00:00Z v=1
{
  "expenses": {
    "real_estate_taxes": {
      "value": 50,
      "abatement": {
        "kind": "freeze",
        "schedule": [
          {
            "period": "Y1",
            "full_tax": 100,
            "abated_tax": 50
          },
          {
            "period": "Y2",
            "full_tax": 90,
            "abated_tax": 50
          }
        ]
      }
    }
  }
}
```
