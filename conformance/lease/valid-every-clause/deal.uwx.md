---
uw_version: "1.1"
deal_id: LSE-CONF
asset_class: office
---

```json uw:section=rent_roll variant=base source=manual ts=2026-09-15T00:00:00Z v=1
{
  "rent_roll_type": "commercial",
  "as_of_date": "2026-09-15",
  "tenants": [
    {
      "tenant_id": "T1",
      "tenant_name": "Anchor Co",
      "nra_sqft": 40000,
      "lease_commencement": "2026-01-01",
      "lease_expiration": "2031-12-31",
      "base_rent_annual": 100000,
      "escalation_type": "fixed_pct",
      "escalation_schedule": [
        {
          "effective_date": "2027-01-01",
          "base_rent_annual": 103000
        },
        {
          "effective_date": "2028-01-01",
          "base_rent_annual": 106090
        },
        {
          "effective_date": "2029-01-01",
          "base_rent_annual": 109273
        }
      ],
      "termination_option": {
        "earliest_date": "2029-06-30",
        "notice_months": 9,
        "penalty": 250000,
        "penalty_includes": [
          "unamortized_ti",
          "unamortized_lc",
          "fee"
        ]
      },
      "co_tenancy_clause": true,
      "co_tenancy_details": {
        "trigger": "both",
        "named_cotenants": [
          "Department Store Co"
        ],
        "occupancy_threshold": 0.7,
        "remedy": "rent_reduction",
        "remedy_value": 0.5,
        "cure_period_months": 12
      },
      "ti_allowance_original": 500000,
      "ti_outstanding_balance": 300000,
      "lc_original": 120000,
      "lc_outstanding_balance": 80000
    }
  ]
}
```
