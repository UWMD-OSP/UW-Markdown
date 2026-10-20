---
uw_version: "3.0"
deal_id: TEST-0098-CTP-AGREE
deal_name: "Construction to permanent reconciles per point"
created: "2026-10-19T00:00:00Z"
last_modified: "2026-10-19T00:00:00Z"
property_address: "100 Stack Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
---

# Construction to permanent reconciles per point

RFC 0098: a stabilization stack, a closing construction facility with no loan_amount, a stabilization takeout and a closing statement whose takeout line is 0 (#403). Each senior is the sole senior at its point, so CC-03 compares like-dated figures and passes.

```json uw:section=property source=manual ts=2026-10-19T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "timestamp": "2026-10-19T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "address": "100 Stack Way",
  "total_units": 120
}
```

```json uw:section=capital_stack source=manual ts=2026-10-19T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "capital_stack",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "timestamp": "2026-10-19T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "point_in_time": "stabilization",
  "tranches": [
    {
      "id": "senior",
      "class": "senior_debt",
      "position": 1,
      "amount": 18000000,
      "rate": 0.06
    },
    {
      "id": "mezz",
      "class": "mezzanine_debt",
      "position": 2,
      "amount": 2000000,
      "rate": 0.11
    }
  ]
}
```

```json uw:section=debt_structure variant=construction source=manual ts=2026-10-19T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "timestamp": "2026-10-19T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_role": "senior",
  "point_in_time": "closing",
  "loan_purpose": "construction"
}
```

```json uw:section=debt_structure variant=takeout source=manual ts=2026-10-19T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "timestamp": "2026-10-19T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_role": "senior",
  "point_in_time": "stabilization",
  "loan_amount": 18000000
}
```

```json uw:section=sources_uses source=manual ts=2026-10-19T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "sources_uses",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "timestamp": "2026-10-19T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "sources": {
    "loan_amount": 0,
    "construction_loan": 17000000
  }
}
```
