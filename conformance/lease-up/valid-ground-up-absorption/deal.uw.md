---
uw_version: "1.1"
deal_id: TEST-LU-GROUNDUP
deal_name: "Ground-Up Absorption Curve"
created: "2026-09-01T10:00:00Z"
last_modified: "2026-09-01T10:00:00Z"
property_address: "500 Absorption Ave"
city: "Austin"
state: "TX"
zip: "78701"
asset_class: office
deal_stage: full_underwrite
status: under_review
recommendation: pending
quick_metrics:
  purchase_price: 8200000
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---

# Ground-Up Absorption Curve

New construction with no rent roll at acquisition -- the building did not
exist. `model_type: absorption_curve` means the absent `rent_roll` is by
construction, not an omission: no LU-04.

```json uw:section=property source=manual ts=2026-09-01T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-09-01T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "address": "500 Absorption Ave",
  "asset_class": "office",
  "rentable_square_feet": 42500,
  "year_built": 1998
}
```

```json uw:section=lease_up_schedule variant=base source=manual ts=2026-09-01T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "lease_up_schedule",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-09-01T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "model_type": "absorption_curve",
  "period_granularity": "monthly",
  "stabilization_target": "2027-12",
  "assumptions": {
    "monthly_turnover_rate": 0.04,
    "market_rent_psf_at_stabilization": 22.0,
    "vacancy_during_lease_up": 0.18,
    "concession_months_per_lease": 1,
    "tenant_improvement_psf": 35.0,
    "leasing_commission_rate": 0.06
  },
  "schedule": [
    {
      "period": "2026-10",
      "occupied_sf": 0,
      "leased_sf": 4200,
      "vacancy_rate": 1.0,
      "rent_revenue": 0,
      "concessions": 0,
      "ti_lc_capex": -147000,
      "net_cash_flow": -147000
    },
    {
      "period": "2026-11",
      "occupied_sf": 4200,
      "leased_sf": 9800,
      "vacancy_rate": 0.9012,
      "rent_revenue": 7700,
      "concessions": -3850,
      "ti_lc_capex": -196000,
      "net_cash_flow": -192150
    },
    {
      "period": "2026-12",
      "occupied_sf": 9800,
      "leased_sf": 15400,
      "vacancy_rate": 0.7694,
      "rent_revenue": 17966,
      "concessions": -5133,
      "ti_lc_capex": -196000,
      "net_cash_flow": -183167
    }
  ]
}
```
