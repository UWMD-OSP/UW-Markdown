---
uw_version: "2.0"
deal_id: RSV-CONF
deal_name: "Synthetic reserve roll-forward"
asset_class: multifamily
deal_stage: intake
created: "2026-09-28T00:00:00Z"
last_modified: "2026-09-28T00:00:00Z"
---

# Synthetic reserve-account statement

Engineering test inputs only. An account with no statements states nothing to roll forward.

```json uw:section=reserve_accounts source=manual ts=2026-09-28T00:00:00Z v=1 confidence=high
{
  "label": "Replacement reserve, quarterly statements",
  "accounts": [
    {
      "account_id": "replacement-reserve",
      "class": "property_reserve",
      "purpose": "Replacement reserve funded at closing and monthly thereafter",
      "currency_code": "USD",
      "statements": []
    }
  ]
}
```
