---
uw_version: "1.1"
deal_id: REC-C10
asset_class: office
---

```json uw:section=rent_roll variant=base source=manual ts=2026-09-16T00:00:00Z v=1
{
  "rent_roll_type": "commercial",
  "as_of_date": "2026-09-15",
  "tenants": [
    {
      "tenant_id": "T1",
      "tenant_name": "Anchor Co",
      "nra_sqft": 40000,
      "lease_type": "nnn",
      "recovery_terms": {
        "method": "net"
      },
      "recovery_true_up": [
        {
          "period_start": "2026-01-01",
          "period_end": "2026-12-31"
        }
      ]
    }
  ]
}
```
