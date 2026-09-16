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

```json uw:section=rent_roll external=true v=1
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
  "external": {
    "parts": ["rent-roll-210", "rent-roll-215", "rent-roll-220"],
    "collection_key": "unit_id",
    "collection_path": "units",
    "part_count": 3
  }
}
```
