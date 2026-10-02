---
uw_version: "1.1"
deal_id: TEST-T3-VARIANT-09
deal_name: "RFC 0066 Two senior blocks and a senior preference"
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

# RFC 0066 Two senior blocks and a senior preference

The declared role is claimed twice. The read refuses without falling through: `CALC-RESOLVE-002`.

Two `debt_structure` blocks are a variant map only because each carries `_role` and a `variant=` key (RFC 0040's Markdown opt-in).


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
  "_role": "senior",
  "loan_amount": 1000000
}
```
