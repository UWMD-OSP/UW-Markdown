---
uw_version: "1.1"
deal_id: DEAL-LOC-01
deal_name: "Locale Conformance Deal"
created: "2026-09-01T10:00:00Z"
last_modified: "2026-09-01T10:00:00Z"
property_address: "900 Umlaut Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: screening
status: under_review
recommendation: pending
quick_metrics:
  purchase_price: 8200000
  loan_amount: 5330000
  noi_underwritten: 479700
  cap_rate: 0.0585
  dscr: 1.42
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---

# Locale Conformance Deal

The shared base document for the RFC 0001 locale suite. The runner injects a
`locale:` frontmatter line per scenario; the content below is canonical and
identical for every locale by construction.

```json uw:section=property source=manual ts=2026-09-01T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-09-01T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "total_units": 96,
  "year_built": 1988
}
```

```json uw:section=noi_model source=manual ts=2026-09-01T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-09-01T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "net_operating_income": 479700
}
```

```json uw:section=valuation source=manual ts=2026-09-01T10:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-09-01T10:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "purchase_price": 8200000
}
```
