---
uw_version: "3.0"
document_profile: offering-memorandum-v1
document_id: om:qa-001
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
  "document_id": "om:qa-001",
  "artifact_kind": "offering_memorandum",
  "as_of": "2026-10-01",
  "currency_code": "USD",
  "governing_documents": [
    "source:qa-om"
  ],
  "facts": {
    "property.year_built": {
      "value": 1998,
      "source_ref": {
        "source": "source:qa-om",
        "locator": "p2 improvements"
      }
    }
  },
  "unmapped_facts": [
    {
      "label": "asking_price",
      "term": {
        "value": 2000000,
        "source_ref": {
          "source": "source:qa-om",
          "locator": "p1 offering"
        }
      }
    },
    {
      "label": "forecast_noi",
      "term": {
        "value": 180000,
        "source_ref": {
          "source": "source:qa-om",
          "locator": "p3 forecast"
        }
      }
    }
  ]
}
```
