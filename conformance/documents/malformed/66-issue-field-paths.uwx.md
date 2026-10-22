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
status: under_review
recommendation: pending
quick_metrics:
  purchase_price: 10000000
  loan_amount: 7500000
  noi_underwritten: 600000
  dscr: 1.25
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

## Completeness: no provenance source

```json uw:section=noi_model source=manual ts=2026-01-15T10:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "noi_model",
    "provenance": {
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
  "net_operating_income": 600000
}
```

## Source outside the actor grammar

```json uw:section=valuation source=manual ts=2026-01-15T10:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "valuation",
    "provenance": {
      "source": "agent:screener",
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
  "purchase_price": 10000000
}
```

## Array element by index

```json uw:section=capital_stack source=manual ts=2026-01-15T10:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "capital_stack",
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
  "point_in_time": "closing",
  "tranches": [
    {
      "id": "senior",
      "class": "senior_debt",
      "position": 1,
      "amount": 7500000,
      "rate": 0.06
    },
    {
      "id": "common",
      "class": "common_equity",
      "position": 0,
      "amount": 2500000
    }
  ]
}
```

## No metadata object

```json uw:section=risk_assessment source=manual ts=2026-01-15T10:00:00Z v=1 confidence=medium
{
  "summary": "No _meta."
}
```
