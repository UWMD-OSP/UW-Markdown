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

Engineering test inputs only. A draw dated after the statement period it is listed in.

```json uw:section=reserve_accounts source=manual ts=2026-09-28T00:00:00Z v=1 confidence=high
{
  "label": "Replacement reserve, quarterly statements",
  "accounts": [
    {
      "account_id": "replacement-reserve",
      "class": "property_reserve",
      "purpose": "Replacement reserve funded at closing and monthly thereafter",
      "currency_code": "USD",
      "statements": [
        {
          "period_start": "2026-04-01",
          "period_end": "2026-06-30",
          "opening_balance": 0,
          "movements": [
            {
              "kind": "contribution",
              "amount": 250000,
              "date": "2026-04-15",
              "label": "Closing funding"
            },
            {
              "kind": "contribution",
              "amount": 12500,
              "date": "2026-05-01",
              "label": "Monthly deposit"
            },
            {
              "kind": "contribution",
              "amount": 12500,
              "date": "2026-06-01",
              "label": "Monthly deposit"
            },
            {
              "kind": "draw",
              "amount": 84300.5,
              "date": "2026-07-01",
              "label": "Roof replacement draw"
            }
          ],
          "ending_balance": 190699.5
        },
        {
          "period_start": "2026-07-01",
          "period_end": "2026-09-30",
          "opening_balance": 190699.5,
          "movements": [
            {
              "kind": "contribution",
              "amount": 12500,
              "date": "2026-07-01"
            },
            {
              "kind": "contribution",
              "amount": 12500,
              "date": "2026-08-01"
            },
            {
              "kind": "contribution",
              "amount": 12500,
              "date": "2026-09-01"
            },
            {
              "kind": "release",
              "amount": 50000,
              "date": "2026-09-30",
              "label": "Excess returned to owner"
            }
          ],
          "ending_balance": 178199.5
        }
      ]
    }
  ]
}
```
