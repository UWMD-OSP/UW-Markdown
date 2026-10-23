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
```json uw:section=capital_stack
{"_meta": {"section": "capital_stack", "provenance": {"source": "manual", "actor": "tester", "timestamp": "2026-01-01T00:00:00Z"}, "quality": {"confidence": "high", "human_review_required": false}, "lifecycle": {"revision": 1, "superseded": false}}, "point_in_time": "invalid", "tranches": [{"id": "a", "position": 1, "amount": 0, "class": "senior_debt", "accrual": "unknown", "amortization_months": "bad"}], "sizing": null, "hurdle": 1}
```
