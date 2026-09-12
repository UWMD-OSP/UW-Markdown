---
uw_version: "1.1"
deal_id: TEST-PERIOD
deal_name: "Period Identity Fixture"
created: "2026-09-09T00:00:00Z"
last_modified: "2026-09-09T00:00:00Z"
property_address: "16 Variant Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: screening
status: under_review
recommendation: pending
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---
# Explicit periods (RFC 0041)

```json uw:section=property source=manual v=1
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-12T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "total_units": 100
}
```

```json uw:section=dcf source=manual v=1
{
  "_meta": {
    "section": "dcf",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-12T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "annual_cash_flows": [
    {
      "year": 3,
      "noi": 300
    },
    {
      "year": 1,
      "noi": 100
    }
  ]
}
```

```json uw:section=noi_model source=manual v=1
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-12T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "projections": {
    "year_1": {
      "projected_noi": 100
    },
    "year_3": {
      "projected_noi": 300
    }
  }
}
```

```json uw:section=lease_up_schedule variant=base source=manual v=1
{
  "_meta": {
    "section": "lease_up_schedule",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-12T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "period_granularity": "quarterly",
  "model_type": "natural_turnover",
  "schedule": [
    {
      "period": "2027-Q4",
      "noi": 200
    },
    {
      "period": "2028-Q1",
      "noi": 300
    }
  ]
}
```

```json uw:section=cash_flow_series variant=base source=manual v=1
{
  "_meta": {
    "section": "cash_flow_series",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-12T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "series": [
    {
      "date": "2028-02-29",
      "amount": 400
    }
  ]
}
```

```json uw:section=distribution_waterfall variant=base source=manual v=1
{
  "_meta": {
    "section": "distribution_waterfall",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-12T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "stated_schedule": [
    {
      "date": "2028-02-29",
      "lp_distribution": 500
    }
  ]
}
```
