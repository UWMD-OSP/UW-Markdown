---
uw_version: "3.0"
document_profile: loan-quote-v1
document_id: quote:qa-001
as_of: 2026-10-01
currency_code: USD
---

> Synthetic source-fact QA fixture.

```json uw:section=document_facts
{
  "_meta": {
    "section": "document_facts",
    "provenance": {
      "source": "manual",
      "actor": "uwmd-fixture",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-10-01T00:00:00Z",
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
  "document_id": "quote:qa-001",
  "artifact_kind": "quote",
  "as_of": "2026-10-01",
  "currency_code": "USD",
  "governing_documents": [
    "source:qa-quote"
  ],
  "facts": {
    "debt_structure.loan_amount": {
      "value": 1000000,
      "source_ref": {
        "source": "source:qa-quote",
        "locator": "p1 amount"
      }
    },
    "debt_structure.interest_rate": {
      "value": 0.06,
      "source_ref": {
        "source": "source:qa-quote",
        "locator": "p1 rate"
      }
    },
    "debt_structure.io_period_months": {
      "value": null,
      "status": "not_stated"
    }
  },
  "unmapped_facts": [
    {
      "label": "maximum_ltv",
      "term": {
        "value": 0.65,
        "source_ref": {
          "source": "source:qa-quote",
          "locator": "p1 maximum LTV"
        }
      }
    }
  ],
  "findings": [
    "Unsigned quote; not an adopted loan. Expiry2026-11-01."
  ]
}
```
