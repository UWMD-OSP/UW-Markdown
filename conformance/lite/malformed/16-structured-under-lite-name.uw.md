---
uw_version: "3.0"
deal_id: TEST-LITE-016
deal_name: "Malformed: structured content under .uw.md"
created: "2026-10-12T00:00:00Z"
last_modified: "2026-10-12T00:00:00Z"
asset_class: multifamily
---

# Structured content under the Lite extension

`.uw.md` is the UW Lite extension. A file of that name that carries UWX
structured section fences contradicts its representation and is refused with
`SOURCE_CONTENT_MISMATCH` — explicit selection or not (RFC 0081 §4). The
record belongs in a `.uwx.md` file.

```json uw:section=property source=manual ts=2026-10-12T00:00:00Z v=1 confidence=high
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "test-fixture",
      "timestamp": "2026-10-12T00:00:00Z"
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
  "total_units": 24
}
```
