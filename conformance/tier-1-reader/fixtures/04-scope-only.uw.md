---
uw_version: "1.1"
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
    "version": 1,
    "superseded": false,
    "source": "manual",
    "resolution": "user_input",
    "agent_id": null,
    "agent_version": null,
    "actor": "user",
    "timestamp": "2026-01-15T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
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
    "version": 1,
    "superseded": false,
    "source": "system/uwmd",
    "resolution": "asset_class_default",
    "agent_id": "agent/L0a",
    "agent_version": "1.0.0",
    "actor": "agent/L0a",
    "timestamp": "2026-01-15T10:00:00Z",
    "confidence": "low",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": "Filled from asset-class defaults; replace with real T-12 to advance past scope.",
    "provisional": true
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
    "version": 1,
    "superseded": false,
    "source": "system/uwmd",
    "resolution": "asset_class_default",
    "agent_id": "agent/L0a",
    "agent_version": "1.0.0",
    "actor": "agent/L0a",
    "timestamp": "2026-01-15T10:00:00Z",
    "confidence": "low",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": "Indicative terms from asset-class defaults.",
    "provisional": true
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
    "version": 1,
    "superseded": false,
    "source": "system/uwmd",
    "resolution": "system_default",
    "agent_id": "system/gaps-maintainer",
    "agent_version": "1.0.0",
    "actor": "system/gaps-maintainer",
    "timestamp": "2026-01-15T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
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
