---
uw_version: "3.0"
document_profile: deal-underwriting-v1
deal_id: uw_standalone_authored_2026_10_17
deal_name: Standalone Authored Kit — 2026-10-17
asset_class: multifamily
---

> Synthetic example: every name, party and figure in this record is fictional.

# Standalone Authored Kit — 2026-10-17 Record

Newly authored fictional fixture; these figures illustrate stated data, not a verified real property. The inline and externalized carriers represent the same new logical record.

## Property {#property}

```json uw:section=property v=1
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "system/standalone-kit",
      "actor": "analyst",
      "timestamp": "2026-10-17T21:34:15Z",
      "notes": "This deliberately authored fictional property only demonstrates structure and requires no human fact-review for that purpose; revision 1 is the new record head."
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
  "address": "100 Parkview Drive",
  "city": "Glendale",
  "state": "AZ",
  "total_units": 3,
  "total_nra_sqft": 3000
}
```

## Rent Roll {#rent_roll}

```json uw:section=rent_roll v=1
{
  "_meta": {
    "section": "rent_roll",
    "provenance": {
      "source": "system/standalone-kit",
      "actor": "analyst",
      "timestamp": "2026-10-17T21:34:15Z",
      "notes": "Human review is required before relying on these illustrative tenant rows as underwriting inputs; revision 1 is the new record head."
    },
    "quality": {
      "confidence": "medium",
      "human_review_required": true,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "rent_roll_type": "multifamily",
  "units": [
    {
      "unit_id": "210",
      "tenant_name": "Anchor Tenant LLC",
      "monthly_rent": 15400,
      "lease_start": "2024-03-01",
      "lease_end": "2034-02-28"
    },
    {
      "unit_id": "215",
      "tenant_name": "Desert Legal Group",
      "monthly_rent": 13600,
      "lease_start": "2023-08-01",
      "lease_end": "2028-07-31"
    },
    {
      "unit_id": "220",
      "tenant_name": "Sonoran Design Studio",
      "monthly_rent": 11200,
      "lease_start": "2025-01-01",
      "lease_end": "2030-12-31"
    }
  ]
}
```

