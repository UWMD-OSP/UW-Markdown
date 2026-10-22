---
uw_version: "3.0"
deal_id: TEST-SIG-001
deal_name: "Signing Base Fixture"
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

# Signing Base Fixture

The unsigned starting point for the `conformance/signing/` scenarios: the
smallest conformant file at the screening stage, so that what each scenario
exercises is the signature and nothing else. `scripts/gen-signing-fixtures.mjs`
reads this file and writes every `deal.uw.md` beside it — do not edit those by
hand.

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
    },
    "integrity": {
      "input_hash": null,
      "content_hash": "0f2100fd78214c07fbc8f7c3281b10a1b87fb760f1ed8028f3cd77177ec4b38c",
      "parent_hash": null,
      "signature": {
        "alg": "ed25519",
        "kid": "uwmd-conformance-ed25519",
        "sig": "zhe8oIV8xBpurcO-L_NQi9BwJ6HsOmeS1Fiojn1D1tlI9qKSg3KGGFiX8gHGmEq9eoyiD69UcTiGLHIfXhYjDg=",
        "signed_at": "2026-08-27T00:00:00Z"
      }
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
