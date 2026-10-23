---
uw_version: "3.0"
deal_id: test
deal_name: "Tower"
created: "2026-01-01"
last_modified: "2026-01-01"
property_address: "123 Main St"
city: Phoenix
state: AZ
zip: "85001"
asset_class: multifamily
unknown_key: retained
---
```json uw:section=property
{"_meta": {"section": "property", "provenance": {"source": "manual", "actor": "tester", "timestamp": "2026-01-01T00:00:00Z"}, "quality": {"confidence": "high", "human_review_required": false}, "lifecycle": {"revision": 1, "superseded": false}}, "address": "A", "asset_class": "multifamily", "units": 12, "total_units": 12, "asking_price": 100}
```
```json uw:section=components
{"_meta": {"section": "components", "provenance": {"source": "manual", "actor": "tester", "timestamp": "2026-01-01T00:00:00Z"}, "quality": {"confidence": "high", "human_review_required": false}, "lifecycle": {"revision": 1, "superseded": false}}, "retail": {"component_class": "retail", "net_operating_income": 1, "capital_stack": {"point_in_time": "closing", "tranches": [{"id": "a", "position": "1", "amount": null, "class": "common_equity"}]}}, "office": {"component_class": "office", "net_operating_income": 1}}
```
