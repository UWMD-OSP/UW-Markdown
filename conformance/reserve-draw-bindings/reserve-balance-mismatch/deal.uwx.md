---
uw_version: "2.0"
deal_id: SYNTHETIC-DRAW-BINDING
asset_class: industrial
deal_stage: screening
currency_code: USD
created: "2026-01-01"
---

# Synthetic reserve and gross invoices

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
        "purpose": "Property capital invoice custody",
        "owner": "Synthetic Property LLC",
        "currency_code": "USD",
        "source": {
          "document": "synthetic-reserve-and-invoices.pdf",
          "locator": "Account header identifies property owner and restricted capital account"
        },
        "periods": [
          {
            "period_id": "jan",
            "start_date": "2026-01-01",
            "end_date": "2026-01-31",
            "opening_balance": 1000,
            "ending_balance": 901,
            "source": {
              "document": "synthetic-reserve-and-invoices.pdf",
              "locator": "January statement: opening 1000; ending 900"
            },
            "movements": [
              {
                "movement_id": "draw-1",
                "date": "2026-01-20",
                "kind": "internal_draw",
                "amount": 100,
                "counterparty": "Synthetic Contractor",
                "source": {
                  "document": "synthetic-reserve-and-invoices.pdf",
                  "locator": "Reserve pays invoice 1 for gross property work 100"
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
```json uw:section=cash_flow_series variant=gross
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
    "series": [
      {
        "date": "2026-01-20",
        "amount": -100,
        "kind": "capex",
        "label": "Gross contractor invoice 1"
      }
    ]
  }
}
```
```json uw:section=lease_up_schedule variant=leasing
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
    "model_type": "absorption_curve",
    "period_granularity": "monthly",
    "schedule": [
      {
        "period": "2026-01",
        "rent_revenue": 100,
        "concessions": 0,
        "ti_lc_capex": -100,
        "net_cash_flow": 0
      }
    ]
  }
}
```
