---
uw_version: "1.1"
deal_id: TEST-VARIANT-CC
deal_name: "Variant Cross-Check Fixture"
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
# 12-role-eligibility (RFC 0040)

```json uw:section=property source=manual v=1
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-11T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "total_units": 100
}
```

```json uw:section=sources_uses source=manual v=1
{
  "_meta": {
    "section": "sources_uses",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-11T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "sources": {
    "loan_amount": 6000000
  }
}
```

```json uw:section=valuation source=manual v=1
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-11T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "underwritten_value": 10000000
}
```

```json uw:section=noi_model source=manual v=1
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-11T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "net_operating_income": 600000
}
```

```json uw:section=stress_tests variant=base source=manual v=1
{
  "_meta": {
    "section": "stress_tests",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-11T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "base_case": {
    "annual_debt_service": 300000
  }
}
```

```json uw:section=debt_structure variant=default source=manual v=1
{
  "_meta": {
    "section": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-11T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_role": "component",
  "loan_amount": 6000000
}
```

```json uw:section=debt_structure variant=invalid source=manual v=1
{
  "_meta": {
    "section": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-11T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_role": "main"
}
```

```json uw:section=rent_roll source=manual v=1
{
  "_meta": {
    "section": "rent_roll",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-09-11T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_role": "component",
  "gross_potential_rent": 1000000
}
```
