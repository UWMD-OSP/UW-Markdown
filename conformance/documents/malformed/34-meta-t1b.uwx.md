---
uw_version: "3.0"
deal_id: RFC0094-34
deal_name: "RFC0094 synthetic 34-meta-t1b"
created: "2026-01-15T10:00:00Z"
last_modified: "2026-01-15T10:00:00Z"
property_address: "100 Test Lane"
city: "Phoenix"
state: "AZ"
zip: "85001"
asset_class: multifamily
deal_stage: screening
status: under_review
recommendation: pending
quick_metrics:
  purchase_price: 10000000
  loan_amount: 7500000
  noi_underwritten: 600000
  dscr: 1.25
  ltv: 0.75
  debt_yield: 0.08
  cap_rate: 0.06
  equity_required: 2500000
flags: []
blocking_flags: []
tier: screener
created_by: "analyst"
---

# RFC0094 synthetic 34-meta-t1b

The initial property block is a positive screening control. The appended
blocks deliberately violate only the diagnostic conditions stated below.

```json uw:section=property source=manual ts=2026-01-15T10:00:00Z v=1 confidence=medium
{
  "_meta": {
    "section": "property",
    "provenance": {
      "source": "manual",
      "actor": "analyst",
      "agent_id": null,
      "agent_version": null,
      "timestamp": "2026-01-15T10:00:00Z",
      "notes": null
    },
    "quality": {
      "confidence": "medium",
      "human_review_required": false,
      "flags": [],
      "partial": false,
      "provisional": false
    },
    "lifecycle": {
      "revision": 1,
      "superseded": false
    }
  },
  "_notes": null,
  "total_units": 50,
  "year_built": 1995,
  "building_class": "B",
  "asset_subtype": "garden",
  "total_nra_sqft": 45000,
  "land_area_acres": 2.1,
  "stories": 2,
  "parking_spaces": 75,
  "parking_type": "surface",
  "zoning": "R-3",
  "condition": "good",
  "amenities": [
    "pool",
    "laundry"
  ]
}
```

# Authored diagnostic controls

```json uw:section=x_t1b_ordinary
{"_meta":{"section":"x_t1b_ordinary","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_year_zero_leap
{"_meta":{"section":"x_t1b_year_zero_leap","provenance":{"source":"manual","actor":"analyst","timestamp":"0000-02-29T23:59:59Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_min_year
{"_meta":{"section":"x_t1b_min_year","provenance":{"source":"manual","actor":"analyst","timestamp":"0000-01-01T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_max_year
{"_meta":{"section":"x_t1b_max_year","provenance":{"source":"manual","actor":"analyst","timestamp":"9999-12-31T23:59:59Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_leap_2000
{"_meta":{"section":"x_t1b_leap_2000","provenance":{"source":"manual","actor":"analyst","timestamp":"2000-02-29T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_leap_2400
{"_meta":{"section":"x_t1b_leap_2400","provenance":{"source":"manual","actor":"analyst","timestamp":"2400-02-29T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_leap_2024
{"_meta":{"section":"x_t1b_leap_2024","provenance":{"source":"manual","actor":"analyst","timestamp":"2024-02-29T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_nonleap_feb28
{"_meta":{"section":"x_t1b_nonleap_feb28","provenance":{"source":"manual","actor":"analyst","timestamp":"1900-02-28T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_single_fraction
{"_meta":{"section":"x_t1b_single_fraction","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T01:02:03.0Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_leading_zero_fraction
{"_meta":{"section":"x_t1b_leading_zero_fraction","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T01:02:03.000000001Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_long_fraction
{"_meta":{"section":"x_t1b_long_fraction","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T01:02:03.1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_nonleap_1900
{"_meta":{"section":"x_t1b_nonleap_1900","provenance":{"source":"manual","actor":"analyst","timestamp":"1900-02-29T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_nonleap_2100
{"_meta":{"section":"x_t1b_nonleap_2100","provenance":{"source":"manual","actor":"analyst","timestamp":"2100-02-29T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_nonleap_2026
{"_meta":{"section":"x_t1b_nonleap_2026","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-02-29T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_feb30
{"_meta":{"section":"x_t1b_feb30","provenance":{"source":"manual","actor":"analyst","timestamp":"2000-02-30T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_april31
{"_meta":{"section":"x_t1b_april31","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-04-31T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_month00
{"_meta":{"section":"x_t1b_month00","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-00-01T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_month13
{"_meta":{"section":"x_t1b_month13","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-13-01T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_day00
{"_meta":{"section":"x_t1b_day00","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-00T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_day32
{"_meta":{"section":"x_t1b_day32","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-32T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_hour24
{"_meta":{"section":"x_t1b_hour24","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T24:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_minute60
{"_meta":{"section":"x_t1b_minute60","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T00:60:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_second60
{"_meta":{"section":"x_t1b_second60","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T23:59:60Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_announced_leap_second_still_forbidden
{"_meta":{"section":"x_t1b_announced_leap_second_still_forbidden","provenance":{"source":"manual","actor":"analyst","timestamp":"2016-12-31T23:59:60Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_lower_t
{"_meta":{"section":"x_t1b_lower_t","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18t00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_lower_z
{"_meta":{"section":"x_t1b_lower_z","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T00:00:00z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_space_separator
{"_meta":{"section":"x_t1b_space_separator","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18 00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_plus_zero_offset
{"_meta":{"section":"x_t1b_plus_zero_offset","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T00:00:00+00:00"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_minus_zero_offset
{"_meta":{"section":"x_t1b_minus_zero_offset","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T00:00:00-00:00"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_nonzero_offset
{"_meta":{"section":"x_t1b_nonzero_offset","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T00:00:00-07:00"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_missing_zone
{"_meta":{"section":"x_t1b_missing_zone","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T00:00:00"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_missing_time
{"_meta":{"section":"x_t1b_missing_time","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_empty_fraction
{"_meta":{"section":"x_t1b_empty_fraction","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T00:00:00.Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_comma_fraction
{"_meta":{"section":"x_t1b_comma_fraction","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T00:00:00,1Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_fullwidth_fraction
{"_meta":{"section":"x_t1b_fullwidth_fraction","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T00:00:00.\uff11Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_arabic_year
{"_meta":{"section":"x_t1b_arabic_year","provenance":{"source":"manual","actor":"analyst","timestamp":"\u0662\u0660\u0662\u0666-10-18T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_fullwidth_year
{"_meta":{"section":"x_t1b_fullwidth_year","provenance":{"source":"manual","actor":"analyst","timestamp":"\uff12\uff10\uff12\uff16-10-18T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_unicode_minus
{"_meta":{"section":"x_t1b_unicode_minus","provenance":{"source":"manual","actor":"analyst","timestamp":"2026\u221210-18T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_leading_space
{"_meta":{"section":"x_t1b_leading_space","provenance":{"source":"manual","actor":"analyst","timestamp":" 2026-10-18T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_trailing_space
{"_meta":{"section":"x_t1b_trailing_space","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T00:00:00Z "},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_trailing_newline
{"_meta":{"section":"x_t1b_trailing_newline","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T00:00:00Z\n"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_trailing_crlf
{"_meta":{"section":"x_t1b_trailing_crlf","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T00:00:00Z\r\n"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_trailing_line_separator
{"_meta":{"section":"x_t1b_trailing_line_separator","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T00:00:00Z\u2028"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_embedded_newline
{"_meta":{"section":"x_t1b_embedded_newline","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T00:00:\n00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_embedded_nul
{"_meta":{"section":"x_t1b_embedded_nul","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T00:00:00Z\u0000"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_empty
{"_meta":{"section":"x_t1b_empty","provenance":{"source":"manual","actor":"analyst","timestamp":""},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_volatile
{"_meta":{"section":"x_t1b_volatile","provenance":{"source":"manual","actor":"analyst","timestamp":"<volatile>"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_signed_year
{"_meta":{"section":"x_t1b_signed_year","provenance":{"source":"manual","actor":"analyst","timestamp":"+2026-10-18T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_five_digit_year
{"_meta":{"section":"x_t1b_five_digit_year","provenance":{"source":"manual","actor":"analyst","timestamp":"10000-10-18T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_three_digit_year
{"_meta":{"section":"x_t1b_three_digit_year","provenance":{"source":"manual","actor":"analyst","timestamp":"026-10-18T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_one_digit_month
{"_meta":{"section":"x_t1b_one_digit_month","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-1-18T00:00:00Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_one_digit_second
{"_meta":{"section":"x_t1b_one_digit_second","provenance":{"source":"manual","actor":"analyst","timestamp":"2026-10-18T00:00:0Z"},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_null
{"_meta":{"section":"x_t1b_null","provenance":{"source":"manual","actor":"analyst","timestamp":null},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_bool_true
{"_meta":{"section":"x_t1b_bool_true","provenance":{"source":"manual","actor":"analyst","timestamp":true},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_bool_false
{"_meta":{"section":"x_t1b_bool_false","provenance":{"source":"manual","actor":"analyst","timestamp":false},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_integer
{"_meta":{"section":"x_t1b_integer","provenance":{"source":"manual","actor":"analyst","timestamp":20261018},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_decimal
{"_meta":{"section":"x_t1b_decimal","provenance":{"source":"manual","actor":"analyst","timestamp":1.5},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_array
{"_meta":{"section":"x_t1b_array","provenance":{"source":"manual","actor":"analyst","timestamp":[]},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_object
{"_meta":{"section":"x_t1b_object","provenance":{"source":"manual","actor":"analyst","timestamp":{}},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

```json uw:section=x_t1b_boxed
{"_meta":{"section":"x_t1b_boxed","provenance":{"source":"manual","actor":"analyst","timestamp":{"value":"2026-10-18T00:00:00Z"}},"quality":{"confidence":"high","human_review_required":false},"lifecycle":{"revision":1,"superseded":false}},"value":1}
```

