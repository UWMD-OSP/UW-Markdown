---
uw_lite_version: 1.0
deal_id: uw_lite_normalization
deal_name: Prose And Normalization
created: 2026-08-08T00:00:00Z
created_by: conformance
---

#    Executive summary

A Lite document may carry arbitrary prose and headings the catalog does not
know about. None of it participates in the financial canonical form.

## An unrecognized heading

Prose lines with trailing whitespace are normalized by the canonical renderer   
but their text content is preserved exactly.

# Valuation

-   Going-in cap rate:   5.50%   <!-- uw:valuation.going_in_cap_rate source=broker scenario=base note="broker OM page 4" -->

###### Deeply nested heading

- Purchase price: $9,400,000 <!-- uw:acquisition.purchase_price -->

Closing prose.
