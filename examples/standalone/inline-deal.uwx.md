---
uw_version: "1.1"
document_profile: deal-underwriting-v1
deal_id: uw_standalone_parkview_inline
deal_name: Parkview Standalone Kit — Inline
asset_class: multifamily
---

# Parkview Standalone Kit — Inline Record

The rent roll is carried in one record in this form.

## Property {#property}

```json uw:section=property v=1
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "system/uwmd",
    "resolution": "source_document",
    "agent_id": null,
    "agent_version": null,
    "actor": "example-kit",
    "ts": "2026-09-13T00:00:00Z"
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
    "version": 1,
    "superseded": false,
    "source": "system/uwmd",
    "resolution": "source_document",
    "agent_id": null,
    "agent_version": null,
    "actor": "example-kit",
    "ts": "2026-09-13T00:00:00Z"
  },
  "rent_roll_type": "multifamily",
  "units": [
    { "unit_id": "210", "tenant_name": "Anchor Tenant LLC", "monthly_rent": 15400, "lease_start": "2024-03-01", "lease_end": "2034-02-28" },
    { "unit_id": "215", "tenant_name": "Desert Legal Group", "monthly_rent": 13600, "lease_start": "2023-08-01", "lease_end": "2028-07-31" },
    { "unit_id": "220", "tenant_name": "Sonoran Design Studio", "monthly_rent": 11200, "lease_start": "2025-01-01", "lease_end": "2030-12-31" }
  ]
}
```

