---
uw_version: "1.1"
deal_id: TEST-T3-VARIANT-01
deal_name: "RFC 0066 A primary and a junior block"
created: "2026-10-02T00:00:00Z"
last_modified: "2026-10-02T00:00:00Z"
property_address: "16 Variant Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: full_underwrite
status: under_review
recommendation: pending
flags: []
blocking_flags: []
tier: analyst
created_by: "conformance"
---

# RFC 0066 A primary and a junior block

RFC 0040's generic order reads the unique `primary` block: 6,000,000 / 10,000,000 = 0.6.

The selected block sits between two non-selected junior fences; neither fence order returns the expected result.

Three `debt_structure` blocks are a variant map only because each carries `_role` and a `variant=` key (RFC 0040's Markdown opt-in).


```json uw:section=valuation source=manual v=1
{
  "_meta": {
    "section": "valuation",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-10-02T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "purchase_price": 10000000
}
```

```json uw:section=debt_structure variant=producer-b-note source=manual v=1
{
  "_meta": {
    "section": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-10-02T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_role": "junior",
  "loan_amount": 2000000
}
```

```json uw:section=debt_structure variant=producer-senior source=manual v=1
{
  "_meta": {
    "section": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-10-02T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_role": "primary",
  "loan_amount": 6000000
}
```

```json uw:section=debt_structure variant=producer-mezz source=manual v=1
{
  "_meta": {
    "section": "debt_structure",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "timestamp": "2026-10-02T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": []
  },
  "_role": "junior",
  "loan_amount": 1000000
}
```
