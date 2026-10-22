---
uw_version: "3.0"
deal_id: CONF-CC17-001
deal_name: "CC-17 Data Center Fixture"
created: "2026-10-22T00:00:00Z"
last_modified: "2026-10-22T00:00:00Z"
property_address: "100 Test Lane"
city: "Mesa"
state: "AZ"
zip: "85201"
asset_class: data_center
deal_stage: screening
status: in_progress
recommendation: pending
quick_metrics:
  purchase_price: 10000101
flags: []
blocking_flags: []
tier: screener
created_by: manual
---

# CC-17 Data Center Fixture

RFC 0086: `valuation.purchase_price` is the one purchase-price authority, and
the frontmatter summary is checked against it (`CC-17`).

The frontmatter price is $101 above the valuation: a CC-17 error.

```json uw:section=property source=manual ts=2026-10-22T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": { "source": "manual", "actor": "conformance", "agent_id": null, "agent_version": null, "timestamp": "2026-10-22T00:00:00Z", "notes": null },
    "quality": { "confidence": "high", "human_review_required": false, "flags": [], "partial": false, "provisional": false },
    "lifecycle": { "revision": 1, "superseded": false }
  },
  "critical_it_load_kw": 1000
}
```

```json uw:section=dc_capacity source=manual ts=2026-10-22T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "dc_capacity",
    "provenance": { "source": "manual", "actor": "conformance", "agent_id": null, "agent_version": null, "timestamp": "2026-10-22T00:00:00Z", "notes": null },
    "quality": { "confidence": "high", "human_review_required": false, "flags": [], "partial": false, "provisional": false },
    "lifecycle": { "revision": 1, "superseded": false }
  },
  "critical_it_load_kw": 1000,
  "planned_it_load_kw": 1000,
  "contracted_it_load_kw": 1000,
  "utility_feed_kw": 2000,
  "design_pue": 1.3,
  "redundancy": "n_plus_1"
}
```

```json uw:section=valuation source=manual ts=2026-10-22T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "provenance": { "source": "manual", "actor": "conformance", "agent_id": null, "agent_version": null, "timestamp": "2026-10-22T00:00:00Z", "notes": null },
    "quality": { "confidence": "high", "human_review_required": false, "flags": [], "partial": false, "provisional": false },
    "lifecycle": { "revision": 1, "superseded": false }
  },
  "purchase_price": 10000000
}
```
