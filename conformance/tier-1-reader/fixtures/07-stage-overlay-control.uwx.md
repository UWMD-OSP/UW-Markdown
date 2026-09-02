---
uw_version: "1.1"
deal_id: TEST-OVERLAY-CONTROL
deal_name: "Overlay Control Fixture"
created: "2026-08-26T12:00:00Z"
last_modified: "2026-08-26T12:00:00Z"
property_address: "42 Control St"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: office
deal_stage: full_underwrite
status: under_review
recommendation: pending
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---
# Overlay control fixture (RFC 0029)

An office deal with the same section inventory as the land fixture. The
overlay is two rows, not a loophole: the frozen validation verdict must
contain DQ-06 (rent_roll and operating_statement are still owed).

```json uw:section=property source=manual ts=2026-08-26T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-08-26T12:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "address": "42 Control St, Phoenix AZ",
  "rentable_square_feet": 42500
}
```
```json uw:section=noi_model source=manual ts=2026-08-26T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "noi_model",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-08-26T12:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "net_operating_income": 300000
}
```
```json uw:section=debt_structure source=manual ts=2026-08-26T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-08-26T12:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  }
}
```
```json uw:section=validation source=manual ts=2026-08-26T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "validation",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-08-26T12:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  }
}
```
```json uw:section=borrower_sponsor source=manual ts=2026-08-26T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "borrower_sponsor",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-08-26T12:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  }
}
```
```json uw:section=preliminary_sizing source=manual ts=2026-08-26T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "preliminary_sizing",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-08-26T12:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  }
}
```
```json uw:section=valuation source=manual ts=2026-08-26T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-08-26T12:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  }
}
```
```json uw:section=sources_uses source=manual ts=2026-08-26T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "sources_uses",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-08-26T12:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  }
}
```
```json uw:section=market_analysis source=manual ts=2026-08-26T12:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "market_analysis",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-08-26T12:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  }
}
```
