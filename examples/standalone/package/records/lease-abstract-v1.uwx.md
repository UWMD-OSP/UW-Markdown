---
uw_version: "1.1"
document_profile: lease-abstract-v1
document_id: doc:parkview:anchor-tenant
lease_id: lease:anchor-tenant
artifact_kind: executed_lease
tenant: Anchor Tenant LLC
premises: Suite 210
governing_documents:
  - source:anchor-lease
---

# Anchor Tenant — Lease Abstract

This is a descriptive abstract of one executed lease. It preserves the source
locator for every asserted term and makes two gaps visible: a co-tenancy term is
ambiguous between the lease and amendment, while a guaranty was not stated in
the reviewed materials. No rent or cash-flow figure is calculated here.

## Lease Abstract Terms {#deal_context}

```json uw:section=deal_context v=1
{
  "_meta": {
    "section": "deal_context",
    "version": 1,
    "superseded": false,
    "source": "system/uwmd",
    "resolution": "source_document",
    "agent_id": null,
    "agent_version": null,
    "actor": "example-kit",
    "ts": "2026-09-13T00:00:00Z"
  },
  "profile": "lease-abstract-v1",
  "document_id": "doc:parkview:anchor-tenant",
  "lease_id": "lease:anchor-tenant",
  "artifact_kind": "executed_lease",
  "tenant": "Anchor Tenant LLC",
  "premises": "Suite 210",
  "governing_documents": ["source:anchor-lease"],
  "lease_context": {
    "suite": {
      "value": "210",
      "source_ref": { "source": "source:anchor-lease", "locator": "§1.1, p. 2" }
    },
    "status": {
      "value": "executed",
      "source_ref": { "source": "source:anchor-lease", "locator": "Cover, p. 1" }
    }
  },
  "lease_term": {
    "commencement": {
      "value": "2024-03-01",
      "source_ref": { "source": "source:anchor-lease", "locator": "§2.1, p. 5" }
    },
    "expiration": {
      "value": "2034-02-28",
      "source_ref": { "source": "source:anchor-lease", "locator": "§2.1, p. 5" }
    },
    "renewal_options": {
      "value": 2,
      "source_ref": { "source": "source:anchor-lease", "locator": "§2.3, p. 6" }
    }
  },
  "lease_economics": {
    "base_rent_annual": {
      "value": 184800,
      "source_ref": { "source": "source:anchor-lease", "locator": "§4.1, p. 11" }
    },
    "free_rent_months": {
      "value": 1,
      "source_ref": { "source": "source:anchor-lease", "locator": "§4.4, p. 13" }
    },
    "percentage_rent": {
      "value": null,
      "status": "not_stated"
    }
  },
  "lease_obligations": {
    "permitted_use": {
      "value": "Medical office",
      "source_ref": { "source": "source:anchor-lease", "locator": "§7.1, p. 24" }
    },
    "co_tenancy_remedy": {
      "value": null,
      "status": "ambiguous"
    }
  },
  "lease_credit": {
    "guaranty": {
      "value": null,
      "status": "not_stated"
    },
    "security_deposit": {
      "value": 30800,
      "source_ref": { "source": "source:anchor-lease", "locator": "§9.1, p. 31" }
    }
  },
  "lease_abstract_findings": {
    "review_flags": [
      "Confirm co-tenancy remedy against the first amendment before projecting a rent-roll row."
    ],
    "calculation_boundary": "No amount is annualized, forecast, or recomputed in this profile."
  }
}
```

