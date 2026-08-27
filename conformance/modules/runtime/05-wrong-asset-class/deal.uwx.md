---
uw_version: "1.1"
deal_id: TEST-MOD-HOSP-001
deal_name: "Boutique Hotel Austin"
created: "2026-08-27T00:00:00Z"
last_modified: "2026-08-27T00:00:00Z"
property_address: "1200 South Congress Ave"
city: "Austin"
state: "TX"
zip: "78704"
asset_class: office
deal_stage: screening
status: under_review
recommendation: pending
quick_metrics:
  purchase_price: 34000000
  loan_amount: 21000000
flags: []
blocking_flags: []
tier: analyst
created_by: "test-fixture"
---

# Boutique Hotel Austin

An 80-key independent-turned-Autograph property on South Congress. It exists to
exercise the hospitality module end to end, and it is deliberately **not** a
clean deal: RevPAR runs below the comp set and the flag's total fee burden is
over 13%, so both warning rules fire and both branches are covered by one file.
Occupancy is stored as a fraction (`0.72`), which is the format-wide rule and
the thing hotel operators most often get wrong.

## Property
```json uw:section=property source=manual ts=2026-08-27T00:00:00Z v=1 confidence=high
{
  "section_id": "property",
  "_meta": {
    "section_id": "property",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-27T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": {
    "key_count": 80,
    "year_built": 1964,
    "renovated_year": 2021,
    "building_class": "B+",
    "asset_subtype": "boutique",
    "stories": 3,
    "parking_spaces": 42,
    "parking_type": "surface",
    "condition": "good"
  },
  "_notes": null
}
```

## Hotel Operating Metrics

Trailing twelve months. 80 keys x 365 nights = 29,200 available room nights.
Comp-set RevPAR of $160 comes from the STR report dated 2026-07-31.
```json uw:section=hotel_metrics source=manual ts=2026-08-27T00:00:00Z v=1 confidence=high
{
  "section_id": "hotel_metrics",
  "_meta": {
    "section_id": "hotel_metrics",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-27T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": {
    "adr": 180,
    "occupancy": 0.72,
    "available_room_nights": 29200,
    "key_count": 80,
    "market_revpar": 160
  },
  "_notes": null
}
```

## Brand & Franchise

6% franchise + 3% marketing + 5% loyalty = 14% of room revenue, which is over
the 13% the module warns at. That is the point of the fixture, not an error in it.
```json uw:section=hotel_brand source=manual ts=2026-08-27T00:00:00Z v=1 confidence=high
{
  "section_id": "hotel_brand",
  "_meta": {
    "section_id": "hotel_brand",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-27T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": {
    "flag": "Marriott Autograph Collection",
    "franchise_fee_pct_of_rooms": 0.06,
    "marketing_fund_pct": 0.03,
    "loyalty_program_pct": 0.05,
    "term_years": 20
  },
  "_notes": null
}
```

## Food & Beverage

Restaurant and bar, no banquet business.
```json uw:section=hotel_food_beverage source=manual ts=2026-08-27T00:00:00Z v=1 confidence=high
{
  "section_id": "hotel_food_beverage",
  "_meta": {
    "section_id": "hotel_food_beverage",
    "version": 1,
    "superseded": false,
    "source": "manual",
    "agent_id": null,
    "agent_version": null,
    "actor": "test-fixture",
    "timestamp": "2026-08-27T00:00:00Z",
    "confidence": "high",
    "human_review_required": false,
    "flags": [],
    "input_hash": null,
    "notes": null
  },
  "content": {
    "fb_revenue": 900000,
    "fb_cogs": 270000,
    "fb_labor": 380000,
    "complimentary_breakfast_cost_per_occupied_room": 4.25
  },
  "_notes": null
}
```

