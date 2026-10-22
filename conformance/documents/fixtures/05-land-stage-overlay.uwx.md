---
uw_version: "3.0"
deal_id: TEST-OVERLAY-LAND
deal_name: "Land Overlay Fixture"
created: "2026-08-26T12:00:00Z"
last_modified: "2026-08-26T12:00:00Z"
property_address: "40 Acres Rd"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: land
deal_stage: full_underwrite
status: in_progress
recommendation: pending
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---
# Land overlay fixture (RFC 0029)

A land deal at full_underwrite with no rent_roll or operating_statement.
The frozen validation verdict must contain no DQ-06: the SS 5.1 class overlay
exempts both sections for land, and everything else the stage requires is
present.

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
  "address": "40 Acres Rd, Phoenix AZ",
  "gross_acres": 40
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
  "net_operating_income": -120000
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
