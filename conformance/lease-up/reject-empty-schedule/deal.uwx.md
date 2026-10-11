---
uw_version: "3.0"
deal_id: TEST-LU-03
deal_name: "Empty Schedule"
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

# Empty Schedule

A lease_up_schedule with no periods states a trajectory with no path (LU-03).

```json uw:section=property source=manual ts=2026-09-01T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-01T10:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
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
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-01T10:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
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
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-01T10:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "net_operating_income": 480000
}
```

```json uw:section=lease_up_schedule variant=base source=manual ts=2026-09-01T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "lease_up_schedule",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-01T10:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "model_type": "natural_turnover",
  "period_granularity": "quarterly",
  "stabilization_target": "2027-Q4",
  "assumptions": {
    "monthly_turnover_rate": 0.04,
    "market_rent_psf_at_stabilization": 22,
    "vacancy_during_lease_up": 0.18,
    "concession_months_per_lease": 1,
    "tenant_improvement_psf": 35,
    "leasing_commission_rate": 0.06
  },
  "schedule": []
}
```
