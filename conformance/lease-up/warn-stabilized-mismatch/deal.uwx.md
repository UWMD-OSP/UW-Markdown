---
uw_version: "1.1"
deal_id: TEST-CC-15
deal_name: "Endpoint Disagrees With Stabilized NOI"
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

# Endpoint Disagrees With Stabilized NOI

The base variant claims a stabilized NOI of $420,000 against noi_model at $480,000 -- 12.5% apart, far beyond LEASE_UP_STABILIZED_TOLERANCE (CC-15, warning).

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

```json uw:section=rent_roll source=manual ts=2026-09-01T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "rent_roll",
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
  "total_units": 12,
  "occupied_units": 9,
  "physical_occupancy": 0.75
}
```

```json uw:section=noi_model source=manual ts=2026-09-01T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
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
  "net_operating_income": 480000
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
  "model_type": "natural_turnover",
  "period_granularity": "quarterly",
  "stabilization_target": "2027-Q4",
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
      "period": "2026-Q3",
      "occupied_sf": 31000,
      "leased_sf": 31000,
      "in_place_rent_psf": 21.5,
      "market_rent_psf": 22.0,
      "vacancy_rate": 0.27,
      "rent_revenue": 166375,
      "concessions": -5400,
      "ti_lc_capex": -42500,
      "net_cash_flow": 118475
    },
    {
      "period": "2026-Q4",
      "occupied_sf": 40500,
      "leased_sf": 41000,
      "in_place_rent_psf": 21.65,
      "market_rent_psf": 22.0,
      "vacancy_rate": 0.05,
      "rent_revenue": 184025,
      "concessions": -8100,
      "ti_lc_capex": -52500,
      "net_cash_flow": 123425
    }
  ],
  "stabilized_summary": {
    "occupied_sf": 40500,
    "occupancy_rate": 0.9529,
    "annualized_noi": 420000
  }
}
```
