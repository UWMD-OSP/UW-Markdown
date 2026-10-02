---
uw_version: "1.1"
deal_id: TEST-T3-VARIANT-11
deal_name: "RFC 0066 An explicit variant and a declared role"
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

# RFC 0066 An explicit variant and a declared role

The caller's exact variant wins over the calculation's declared `senior`: the junior block is read, 0.1.

Three `debt_structure` blocks are a variant map only because each carries `_role` and a `variant=` key (RFC 0040's Markdown opt-in).

`producer-mezz` is the middle fence. A reader that takes the first fence (0.6) or the last (0.2) instead of the named variant fails this case.


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
  "_role": "senior",
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
