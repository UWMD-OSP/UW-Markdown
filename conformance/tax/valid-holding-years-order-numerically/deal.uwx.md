---
uw_version: "1.1"
deal_id: TAX-CONF
asset_class: multifamily
---

```json uw:section=noi_model variant=base source=manual ts=2026-09-15T00:00:00Z v=1
{
  "expenses": {
    "real_estate_taxes": {
      "value": 100,
      "abatement": {
        "kind": "pilot",
        "program": "County PILOT",
        "schedule": [
          {
            "period": "Y9",
            "full_tax": 100,
            "abated_tax": 0
          },
          {
            "period": "Y10",
            "full_tax": 110,
            "abated_tax": 0
          }
        ]
      }
    }
  }
}
```
