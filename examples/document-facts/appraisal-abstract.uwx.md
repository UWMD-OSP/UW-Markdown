---
uw_version: "3.0"
document_profile: appraisal-abstract-v1
document_id: appraisal:qa-001
as_of: 2026-09-30
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
  "document_id": "appraisal:qa-001",
  "artifact_kind": "appraisal_report",
  "as_of": "2026-09-30",
  "currency_code": "USD",
  "governing_documents": [
    "source:qa-appraisal"
  ],
  "facts": {
    "valuation.appraised_value": {
      "value": 2100000,
      "source_ref": {
        "source": "source:qa-appraisal",
        "locator": "p4 as-is conclusion"
      }
    },
    "valuation.appraised_as_of": {
      "value": "2026-09-30",
      "source_ref": {
        "source": "source:qa-appraisal",
        "locator": "p4 effective date"
      }
    },
    "valuation.appraisal_report_date": {
      "value": "2026-10-02",
      "source_ref": {
        "source": "source:qa-appraisal",
        "locator": "p1 report date"
      }
    }
  },
  "findings": [
    "Extraordinary assumption at source:qa-appraisal p8; independent review required."
  ]
}
```
