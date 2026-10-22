---
uw_version: "3.0"
deal_id: TEST-OVERLAY-MU
deal_name: "Mixed-Use Overlay Fixture"
created: "2026-08-26T12:00:00Z"
last_modified: "2026-08-26T12:00:00Z"
property_address: "700 Mixed Ave"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: mixed_use
deal_stage: full_underwrite
status: in_progress
recommendation: pending
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---
# Mixed-use overlay fixture (RFC 0029)

A mixed-use deal at full_underwrite whose components section satisfies the
substitution for rent_roll and operating_statement. The frozen validation
verdict must contain no DQ-06, and the component NOIs foot to the property
NOI (CC-12).

```json uw:section=property source=manual ts=2026-08-26T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-26T12:00:00Z",
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
  "address": "700 Mixed Ave, Phoenix AZ"
}
```
```json uw:section=components source=manual ts=2026-08-26T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "components",
    "provenance": {
      "source": "manual",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-26T12:00:00Z",
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
  "multifamily": {
    "component_class": "multifamily",
    "effective_gross_income": 2180000,
    "operating_expenses": 880000,
    "net_operating_income": 1300000,
    "total_units": 120,
    "allocation_pct": 0.7
  },
  "retail": {
    "component_class": "retail",
    "effective_gross_income": 520000,
    "operating_expenses": 148000,
    "net_operating_income": 372000,
    "nra_sqft": 18000,
    "allocation_pct": 0.3
  }
}
```
```json uw:section=noi_model source=manual ts=2026-08-26T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "provenance": {
      "source": "manual",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-26T12:00:00Z",
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
  "net_operating_income": 1672000
}
```
```json uw:section=debt_structure source=manual ts=2026-08-26T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "provenance": {
      "source": "manual",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-26T12:00:00Z",
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
  }
}
```
```json uw:section=validation source=manual ts=2026-08-26T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "validation",
    "provenance": {
      "source": "manual",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-26T12:00:00Z",
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
  }
}
```
```json uw:section=borrower_sponsor source=manual ts=2026-08-26T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "borrower_sponsor",
    "provenance": {
      "source": "manual",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-26T12:00:00Z",
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
  }
}
```
```json uw:section=preliminary_sizing source=manual ts=2026-08-26T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "preliminary_sizing",
    "provenance": {
      "source": "manual",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-26T12:00:00Z",
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
  }
}
```
```json uw:section=valuation source=manual ts=2026-08-26T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "provenance": {
      "source": "manual",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-26T12:00:00Z",
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
  }
}
```
```json uw:section=sources_uses source=manual ts=2026-08-26T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "sources_uses",
    "provenance": {
      "source": "manual",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-26T12:00:00Z",
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
  }
}
```
```json uw:section=market_analysis source=manual ts=2026-08-26T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "market_analysis",
    "provenance": {
      "source": "manual",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-26T12:00:00Z",
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
  }
}
```
