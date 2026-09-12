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
# Malformed and duplicate periods (RFC 0041)

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
      "year": 1,
      "noi": 100
    },
    {
      "year": 1,
      "noi": 101
    },
    {
      "noi": 300
    }
  ]
}
```

```json uw:section=custom_calculations source=manual v=1
{
  "_meta": {
    "section": "custom_calculations",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-12T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "id": "mismatch",
  "formula": "dcf.annual_cash_flows@2028-01-01.noi",
  "deterministic": true
}
```
