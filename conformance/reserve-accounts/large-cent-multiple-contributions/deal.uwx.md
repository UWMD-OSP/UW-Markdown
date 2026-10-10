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
            "opening_balance": 285810.09,
            "ending_balance": 390555.22,
            "source": {
              "document": "synthetic-property-custody-statement.pdf",
              "locator": "January statement: opening 285810.09; ending 390555.22"
            },
            "movements": [
              {
                "movement_id": "row-1",
                "date": "2026-01-05",
                "kind": "contribution",
                "amount": 69669.14,
                "counterparty": "Synthetic Property LLC",
                "source": {
                  "document": "synthetic-property-custody-statement.pdf",
                  "locator": "Owner cash deposit 69669.14"
                }
              },
              {
                "movement_id": "row-2",
                "date": "2026-01-06",
                "kind": "contribution",
                "amount": 62507.8,
                "counterparty": "Synthetic Property LLC",
                "source": {
                  "document": "synthetic-property-custody-statement.pdf",
                  "locator": "Owner cash deposit 62507.80"
                }
              },
              {
                "movement_id": "row-3",
                "date": "2026-01-07",
                "kind": "internal_draw",
                "amount": 27431.81,
                "counterparty": "Synthetic Contractor",
                "source": {
                  "document": "synthetic-property-custody-statement.pdf",
                  "locator": "Contractor invoice payment from reserve 27431.81"
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
