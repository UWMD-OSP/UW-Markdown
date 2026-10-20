---
uw_version: "3.0"
deal_id: TEST-TILDE-FENCE
deal_name: "Tilde fence is ordinary Markdown"
created: "2026-10-20T00:00:00Z"
last_modified: "2026-10-20T00:00:00Z"
property_address: "1 Tilde Way"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
---

# Tilde fence is ordinary Markdown

A structured block opens only with three backticks (Format §2.4, RFC 0102). The
`property` block below uses a tilde fence, so it is a Markdown code example, not
data: the record has no `property` section and owes CC-14.

~~~json uw:section=property source=manual ts=2026-10-20T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "timestamp": "2026-10-20T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "address": "1 Tilde Way",
  "total_units": 24
}
~~~

```json uw:section=valuation source=manual ts=2026-10-20T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "valuation",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "timestamp": "2026-10-20T00:00:00Z"
    },
    "quality": {
      "confidence": "high",
      "human_review_required": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "purchase_price": 6000000
}
```
