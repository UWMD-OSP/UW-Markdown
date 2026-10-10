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
            "opening_balance": 100,
            "ending_balance": 150,
            "source": {
              "document": "synthetic-property-custody-statement.pdf",
              "locator": "January opening 100; ending 150"
            },
            "movements": [
              {
                "movement_id": "owner-deposit",
                "date": "2026-01-05",
                "kind": "interest_credit",
                "amount": 80,
                "counterparty": "Synthetic Property LLC",
                "source": {
                  "document": "synthetic-property-custody-statement.pdf",
                  "locator": "January entry: owner transfers 80 from unrestricted cash into capital account"
                }
              },
              {
                "movement_id": "contractor-payment",
                "date": "2026-01-15",
                "kind": "internal_draw",
                "amount": 30,
                "counterparty": "Synthetic Contractor",
                "source": {
                  "document": "synthetic-property-custody-statement.pdf",
                  "locator": "January entry: capital account pays contractor invoice for gross property work of 30"
                }
              }
            ]
          },
          {
            "period_id": "feb",
            "start_date": "2026-02-01",
            "end_date": "2026-02-28",
            "previous_period_id": "jan",
            "opening_balance": 150,
            "ending_balance": 100,
            "source": {
              "document": "synthetic-property-custody-statement.pdf",
              "locator": "February opening is January ending; ending 100"
            },
            "movements": [
              {
                "movement_id": "owner-return",
                "date": "2026-02-10",
                "kind": "external_release",
                "amount": 50,
                "counterparty": "Synthetic Property LLC",
                "source": {
                  "document": "synthetic-property-custody-statement.pdf",
                  "locator": "February entry: capital account returns unused 50 to owner unrestricted cash"
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
