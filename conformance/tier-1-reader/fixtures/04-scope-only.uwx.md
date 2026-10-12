---
uw_version: "3.0"
deal_id: TEST-SCOPE-004
deal_name: "Scope-only fixture (back-of-napkin)"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "404 Scope Lane"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: scope
status: under_review
recommendation: pending
flags: []
blocking_flags: []
tier: screener
created_by: "test-fixture"
---

# Scope-only fixture

This file represents the back-of-napkin entry point: only `property` is
populated, and most operating / debt assumptions are provisional defaults
filled by the scope agent. The `gaps` section enumerates the open
unknowns. Validates clean at `deal_stage: scope`.

## Property {#property}

```json uw:section=property source=manual ts=2026-01-15T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "resolution": "user_input",
      "actor": "user",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-01-15T10:00:00Z",
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
  "address": "404 Scope Lane, Phoenix, AZ 85001",
  "asset_class": "multifamily",
  "units": 24,
  "asking_price": 4800000
}
```

## NOI Model {#noi_model}

```json uw:section=noi_model source=system/uwmd ts=2026-01-15T10:00:00Z v=1 confidence=low
{
  "_meta": {
    "section": "noi_model",
    "provenance": {
      "source": "system/uwmd",
      "resolution": "asset_class_default",
      "actor": "agent/L0a",
      "agent_id": "agent/L0a",
      "agent_version": "1.0.0",
      "timestamp": "2026-01-15T10:00:00Z",
      "notes": "Filled from asset-class defaults; replace with real T-12 to advance past scope."
    },
    "quality": {
      "confidence": "low",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": true
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "expense_ratio": 0.4,
  "rent_growth_pct_y1": 0.03,
  "management_fee_pct": 0.035,
  "replacement_reserve_per_unit_y1": 300
}
```

## Debt Structure {#debt_structure}

```json uw:section=debt_structure source=system/uwmd ts=2026-01-15T10:00:00Z v=1 confidence=low
{
  "_meta": {
    "section": "debt_structure",
    "provenance": {
      "source": "system/uwmd",
      "resolution": "asset_class_default",
      "actor": "agent/L0a",
      "agent_id": "agent/L0a",
      "agent_version": "1.0.0",
      "timestamp": "2026-01-15T10:00:00Z",
      "notes": "Indicative terms from asset-class defaults."
    },
    "quality": {
      "confidence": "low",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": true
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "rate_pct": 0.067,
  "amortization_months": 360,
  "io_months": 0,
  "ltv_pct": 0.65
}
```

## Gaps {#gaps}

```json uw:section=gaps source=system/uwmd ts=2026-01-15T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "gaps",
    "provenance": {
      "source": "system/uwmd",
      "resolution": "system_default",
      "actor": "system/gaps-maintainer",
      "agent_id": "system/gaps-maintainer",
      "agent_version": "1.0.0",
      "timestamp": "2026-01-15T10:00:00Z",
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
  "items": [
    {
      "section": "noi_model",
      "field_path": "expense_ratio",
      "reason": "missing",
      "blocks_stage": "screening",
      "first_seen": "2026-01-15T10:00:00Z",
      "last_checked": "2026-01-15T10:00:00Z",
      "owner": "user"
    },
    {
      "section": "debt_structure",
      "field_path": "rate_pct",
      "reason": "missing",
      "blocks_stage": "screening",
      "first_seen": "2026-01-15T10:00:00Z",
      "last_checked": "2026-01-15T10:00:00Z",
      "owner": "user"
    },
    {
      "section": "rent_roll",
      "reason": "missing",
      "blocks_stage": "term_sheet",
      "first_seen": "2026-01-15T10:00:00Z",
      "last_checked": "2026-01-15T10:00:00Z",
      "owner": "user"
    }
  ],
  "summary": {
    "total_open": 3,
    "blocking_current_stage": 0,
    "blocking_next_stage": 2
  }
}
```
