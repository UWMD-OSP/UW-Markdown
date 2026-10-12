---
uw_version: "3.0"
deal_id: TEST-RETURNS-TAX-BASIS
deal_name: "Returns Tax Basis Fixture"
created: "2026-09-09T00:00:00Z"
last_modified: "2026-09-09T00:00:00Z"
property_address: "38 Basis Blvd"
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
# Returns tax-basis fixture (RFC 0038)

`dcf.returns.tax_basis` is `post_tax` — a plausible misspelling of the
registered `after_tax`. The frozen verdict pins `RT-01` as an error; the
document is otherwise ordinary.

```json uw:section=property source=manual ts=2026-09-09T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-09T00:00:00Z",
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
  "address": "38 Basis Blvd, Phoenix AZ",
  "total_units": 80
}
```
```json uw:section=dcf source=manual ts=2026-09-09T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "dcf",
    "provenance": {
      "source": "manual",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-09-09T00:00:00Z",
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
  "hold_period_years": 5,
  "returns": {
    "levered_irr": 0.142,
    "unlevered_irr": 0.091,
    "equity_multiple": 1.84,
    "tax_basis": "post_tax"
  }
}
```
