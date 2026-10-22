---
uw_version: "3.0"
deal_id: TEST-MIN-001
deal_name: "Minimal Screening Fixture"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "100 Test Lane"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: screening
status: in_progress
recommendation: pending
quick_metrics:
  purchase_price: 10000000
  loan_amount: 7500000
  noi_underwritten: 600000
  dscr: 0.95
  ltv: 0.75
  debt_yield: 0.08
  cap_rate: 0.06
  equity_required: 2500000
flags: []
blocking_flags: []
tier: screener
created_by: "test-fixture"
---

# Minimal Screening Fixture

This is the smallest possible conformant file at the screening stage —
property and quick_metrics only.

```json uw:section=property source=manual ts=2026-01-15T10:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-01-15T10:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "medium",
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
  "_notes": null,
  "total_units": 50,
  "year_built": 1995,
  "building_class": "B",
  "asset_subtype": "garden",
  "total_nra_sqft": 45000,
  "land_area_acres": 2.1,
  "stories": 2,
  "parking_spaces": 75,
  "parking_type": "surface",
  "zoning": "R-3",
  "condition": "good",
  "amenities": [
    "pool",
    "laundry"
  ]
}
```

```json uw:section=debt_structure source=manual ts=2026-01-15T10:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "debt_structure",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "timestamp": "2026-01-15T10:00:00Z"
    },
    "quality": {
      "confidence": "medium",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "sizing_metrics": {
    "dscr_underwritten": 1.1,
    "ltv": 0.9,
    "debt_yield": 0.08
  }
}
```

```json uw:section=valuation source=manual ts=2026-01-15T10:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "valuation",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "timestamp": "2026-01-15T10:00:00Z"
    },
    "quality": {
      "confidence": "medium",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "going_in_cap_rate": 0.2
}
```

```json uw:section=noi_model source=manual ts=2026-01-15T10:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "noi_model",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "timestamp": "2026-01-15T10:00:00Z"
    },
    "quality": {
      "confidence": "medium",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "income": {
    "vacancy_credit_loss": {
      "rate_applied": 0.5
    }
  },
  "expenses": {
    "expense_ratio": 0.1
  }
}
```

```json uw:section=dcf source=manual ts=2026-01-15T10:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "dcf",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "timestamp": "2026-01-15T10:00:00Z"
    },
    "quality": {
      "confidence": "medium",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "assumptions": {
    "revenue_growth_rate": 0.1
  },
  "returns": {
    "levered_irr": 0.5,
    "equity_multiple": 0.8
  }
}
```
