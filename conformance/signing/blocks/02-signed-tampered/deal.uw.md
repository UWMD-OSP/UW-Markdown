---
uw_version: "1.1"
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

# Signing Base Fixture

The unsigned starting point for the `conformance/signing/` scenarios: the
smallest conformant file at the screening stage, so that what each scenario
exercises is the signature and nothing else. `scripts/gen-signing-fixtures.mjs`
reads this file and writes every `deal.uw.md` beside it — do not edit those by
hand.

```json uw:section=property source=manual ts=2026-01-15T10:00:00Z v=1 confidence=medium
{
  "section_id": "property",
  "_meta": {
    "section_id": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-01-15T10:00:00Z",
    "confidence": "medium",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null,
    "content_hash": "8d5d92991cded2903e1d200e379d5f7ec74428a9c375b51afaf4b076188dc1ad",
    "signature": {
      "alg": "ed25519",
      "kid": "uwmd-conformance-ed25519",
      "sig": "CDHhh5_SL03JALmsNTRJlgx29iDwtczuQdJ_mAFkBQZRjco5qXDnla8RJZ67qpha4bNbI462QDf9eb7IER8LDA",
      "signed_at": "2026-08-27T00:00:00Z"
    }
  },
  "content": {
    "total_units": 50,
    "year_built": 1996,
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
  },
  "_notes": null
}
```
