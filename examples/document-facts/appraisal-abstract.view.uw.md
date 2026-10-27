---
uw_version: "3.0"
uw_lite_version: "1.0"
document_profile: "appraisal-abstract-v1"
document_id: "appraisal:qa-001"
---

# Document facts — view only

Every stated fact, null status, source locator and finding is shown below.
Lite compilation and CLI/MCP/HTTP profile bindings are unsupported.

```json
{
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
