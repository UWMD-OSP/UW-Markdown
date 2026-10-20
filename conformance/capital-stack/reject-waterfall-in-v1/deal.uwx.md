---
uw_version: "3.0"
deal_id: TEST-CS-WATERFALL
deal_name: "Capital Stack Attempting A Distribution Waterfall"
created: "2026-08-22T10:00:00Z"
last_modified: "2026-08-22T10:00:00Z"
property_address: "100 Stack Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: full_underwrite
status: under_review
recommendation: pending
quick_metrics:
  purchase_price: 40000000
  loan_amount: 26000000
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---

# Capital Stack Attempting A Distribution Waterfall

A `capital_stack` that tries to encode distribution tiers and a promote — at
the section level (`waterfall`) and smuggled onto a tranche (`promote`). Both
must be refused with the typed CS-WATERFALL-UNSUPPORTED pointing at
`x_partnership_structure` and RFC 0026 §E: the Phase 2 boundary, enforced.

```json uw:section=capital_stack source=manual ts=2026-08-22T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "capital_stack",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-22T10:00:00Z",
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
  "_notes": null,
  "point_in_time": "stabilization",
  "tranches": [
    {
      "id": "senior",
      "class": "senior_debt",
      "position": 1,
      "amount": 26000000,
      "rate": 0.0625,
      "amortization_months": 360,
      "accrual": "cash"
    },
    {
      "id": "common",
      "class": "common_equity",
      "position": 2,
      "amount": 14000000,
      "promote": 0.2
    }
  ],
  "waterfall": {
    "tiers": [
      {
        "hurdle": 0.08,
        "split": {
          "lp": 0.9,
          "gp": 0.1
        }
      },
      {
        "hurdle": 0.12,
        "split": {
          "lp": 0.8,
          "gp": 0.2
        }
      }
    ]
  }
}
```
