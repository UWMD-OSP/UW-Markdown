---
uw_version: "2.0"
deal_id: SYNTHETIC-RESERVE
asset_class: industrial
deal_stage: screening
currency_code: USD
created: "2026-01-01"
---

# Synthetic custody statement

```json uw:section=reserve_accounts
{
  "_meta": {
    "provenance": {
      "source": "manual",
      "author": "synthetic-fixture",
      "timestamp": "2026-01-01T00:00:00Z"
    },
    "status": {
      "confidence": "verified"
    },
    "lineage": {
      "version": 1
    }
  },
  "content": {
    "accounts": [
      {
        "account_id": "property-capital",
        "class": "property_reserve",
        "purpose": "Gross property capital expenditure custody",
        "owner": "Synthetic Property LLC",
        "currency_code": "USD",
        "source": {
          "document": "synthetic-property-custody-statement.pdf",
          "locator": "Account header: property owner and restricted capital account"
        },
        "periods": [
          {
            "period_id": "jan",
            "start_date": "2026-01-01",
            "end_date": "2026-01-31",
            "opening_balance": 0,
            "ending_balance": 0.01,
            "source": {
              "document": "synthetic-property-custody-statement.pdf",
              "locator": "January opening 100; ending 150"
            },
            "movements": [
              {
                "movement_id": "deposit",
                "date": "2026-01-05",
                "kind": "contribution",
                "amount": 0.015,
                "counterparty": "Owner",
                "source": {
                  "document": "synthetic-property-custody-statement.pdf",
                  "locator": "Explicit source: owner deposit 0.015"
                }
              }
            ]
          }
        ]
      }
    ]
  }
}
```
