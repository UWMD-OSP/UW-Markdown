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
            "opening_balance": 1e+308,
            "ending_balance": 0,
            "source": {
              "document": "synthetic-property-custody-statement.pdf",
              "locator": "January statement: opening 1e308; ending 0"
            },
            "movements": [
              {
                "movement_id": "deposit",
                "date": "2026-01-05",
                "kind": "contribution",
                "amount": 1e+308,
                "counterparty": "Owner",
                "source": {
                  "document": "synthetic-property-custody-statement.pdf",
                  "locator": "Owner cash deposit 1e308"
                }
              }
            ]
          },
          {
            "period_id": "feb",
            "start_date": "2026-02-01",
            "end_date": "2026-02-28",
            "opening_balance": 100,
            "ending_balance": 100,
            "source": {
              "document": "synthetic-property-custody-statement.pdf",
              "locator": "February statement: opening 100; ending 100; no movements"
            },
            "movements": []
          },
          {
            "period_id": "mar",
            "start_date": "2026-03-01",
            "end_date": "2026-03-31",
            "opening_balance": 100,
            "ending_balance": 101,
            "source": {
              "document": "synthetic-property-custody-statement.pdf",
              "locator": "March statement: opening 100; ending 101; no movements"
            },
            "movements": []
          }
        ]
      }
    ]
  }
}
```
