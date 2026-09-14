---
uwpart_version: "1.0"
part_id: operating-statement-t12
section: operating_statement
---

## Operating Statement {#operating_statement}

```json uw:section=operating_statement v=1
{
  "_meta": {
    "section": "operating_statement",
    "version": 1,
    "superseded": false,
    "source": "system/uwmd",
    "resolution": "source_document",
    "agent_id": null,
    "agent_version": null,
    "actor": "example-kit",
    "ts": "2026-09-13T00:00:00Z"
  },
  "period": "2025-T12",
  "variant": "t12",
  "income": {
    "base_rent": 182400,
    "reimbursements": 24600,
    "other_income": 8400
  },
  "expenses": {
    "taxes": 31800,
    "insurance": 12600,
    "repairs": 17400,
    "management": 11800
  },
  "stated_noi": 200800,
  "calculation_boundary": "Stated T-12 ledger fragment; this example does not recompute NOI."
}
```

