---
uw_version: "1.1"
deal_id: REC-C13
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
        "method": "net",
        "pro_rata_share": 0.0412,
        "share_basis": "nra",
        "recoverable_pool": [
          "real_estate_taxes",
          "insurance",
          "contract_services"
        ],
        "cap": {
          "pct": 0.05,
          "over": "base_year",
          "accumulation": "cumulative"
        }
      },
      "recovery_true_up": [
        {
          "period_start": "2025-01-01",
          "period_end": "2025-12-31",
          "pool_actual": 2216000.0,
          "tenant_share_uncapped": 91299.2,
          "tenant_share_capped": 91299.2,
          "estimated_billed": 84000.0,
          "true_up_amount": 8000.0,
          "settlement": "billed"
        }
      ]
    }
  ]
}
```
