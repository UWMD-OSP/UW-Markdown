---
uw_version: "3.0"
deal_id: uw_lite_normalization
deal_name: "Prose And Normalization"
created: "2026-08-08T00:00:00Z"
last_modified: "2026-08-08T00:00:00Z"
created_by: conformance
---

```json uw:section=valuation confidence=high source=manual ts=2026-08-08T00:00:00Z v=1
{
  "_meta": {
    "section": "valuation",
    "provenance": {
      "source": "manual",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-08T00:00:00Z",
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
  "going_in_cap_rate": 0.055,
  "purchase_price": 9400000
}
```

```json uw:section=x_uw_lite_source confidence=high source=manual ts=2026-08-08T00:00:00Z v=1
{
  "_meta": {
    "section": "x_uw_lite_source",
    "provenance": {
      "source": "manual",
      "actor": "conformance",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-08-08T00:00:00Z",
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
  "markdown": "---\nuw_lite_version: 1.0\ndeal_id: uw_lite_normalization\ndeal_name: Prose And Normalization\ncreated: 2026-08-08T00:00:00Z\ncreated_by: conformance\n---\n\n#    Executive summary\n\nA Lite document may carry arbitrary prose and headings the catalog does not\nknow about. None of it participates in the financial canonical form.\n\n## An unrecognized heading\n\nProse lines with trailing whitespace are normalized by the canonical renderer   \nbut their text content is preserved exactly.\n\n# Valuation\n\n-   Going-in cap rate:   5.50%   <!-- uw:valuation.going_in_cap_rate source=broker scenario=base note=\"broker OM page 4\" -->\n\n###### Deeply nested heading\n\n- Purchase price: $9,400,000 <!-- uw:acquisition.purchase_price -->\n\nClosing prose.\n",
  "profile": "deal-summary-v1",
  "representation": "uw-lite-markdown",
  "representation_version": "1.0"
}
```
