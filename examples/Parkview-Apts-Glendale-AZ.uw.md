---
uw_lite_version: 1.0
deal_id: uw_2026_a3f9b1
deal_name: Parkview Apartments — Glendale, AZ
created: 2026-08-13T00:00:00Z
created_by: uwmd-examples
asset_class: multifamily
---

# Parkview Apartments — Glendale, AZ

A 48-unit garden-style multifamily property in Glendale, Arizona, offered at a
5.51% going-in cap rate on underwritten NOI, with a 70% LTV agency loan.

This file is the **UW Lite** (`.uw.md`) summary of the deal. Its sibling
[`Parkview-Apts-Glendale-AZ.uwx.md`](Parkview-Apts-Glendale-AZ.uwx.md) is the
same deal as a complete **UW Extended** (`.uwx.md`) record. Every number below
appears in that record; the record additionally carries the rent roll, the
operating statement, the five-year cash-flow model, sponsor and market analysis,
the validation log, and the full provenance chain — none of which Lite
represents. Lite is a readable summary, not a second financial model.

# Property

- Total units: 48 <!-- uw:property.total_units -->
- Total NRA: 41,400 <!-- uw:property.total_nra_sqft -->

# Acquisition

- Purchase price: $7,200,000 <!-- uw:acquisition.purchase_price -->

# Valuation

- Going-in cap rate: 5.51% <!-- uw:valuation.going_in_cap_rate scenario=base -->

# Net operating income

- Net operating income: $396,635 <!-- uw:noi.net_operating_income -->

The figure above is **underwritten** NOI. Trailing-twelve actual NOI was
$412,096; the difference is the underwriting adjustment, and only the
underwritten number is carried here. Which of the two a summary means is exactly
the kind of ambiguity a bare spreadsheet cell leaves open and an anchored field
does not.

# Debt

- Loan amount: $5,040,000 <!-- uw:debt.loan_amount -->
- Interest rate: 5.875% <!-- uw:debt.interest_rate -->
- Annual debt service: $357,612 <!-- uw:debt.annual_debt_service -->

# What this file deliberately does not contain

There is no DSCR field and no LTV field, though both are central to the deal.
They are **derived**, not stated: DSCR is NOI ÷ annual debt service and LTV is
loan amount ÷ purchase price, and UW Markdown computes them deterministically
from the fields above rather than storing a number a reader would have to trust.
Writing them here would create a second place for them to be wrong. Compile this
file and the multifamily pack derives them from the eight anchored inputs:
DSCR 1.1091, LTV 0.7000, cap rate 0.0551, debt yield 0.0787 — the same values
the complete record reports.

The same reasoning explains why the labels to the left of each colon are
presentation only. "Total NRA", "Net rentable area", and "Rentable SF" are the
same field to a compiler because they carry the same `uw:` anchor; the anchor is
the semantics and the label is for the human.

Every anchored field above is a **user-supplied input**. A verification receipt
over this document can establish that the content is unchanged and that the
deterministic math agrees with the stated inputs. It cannot establish that the
inputs are true, complete, audited, or supported by source documents.

# Try it

```
uwmd validate examples/Parkview-Apts-Glendale-AZ.uw.md
uwmd convert  examples/Parkview-Apts-Glendale-AZ.uw.md --to uwx --stdout
uwmd convert  examples/Parkview-Apts-Glendale-AZ.uwx.md --to lite --stdout \
  --projection-report omitted.json
```

The first command parses and reports Lite syntax issues. The second compiles
Lite into the Document Envelope and serializes it as UWX — deterministic for
every supported construct, with this file's complete source retained in the
`x_uw_lite_source` extension.

The third goes the other way, and is where the asymmetry becomes concrete.
Projecting the complete record back down to Lite yields **7 projected paths and
1,215 omitted ones**. That ratio is the whole point of the split: Lite is a
faithful summary of a handful of headline inputs, and the working record is
three orders of magnitude larger. `UWX -> Lite` is a named, explicitly lossy
projection and reports every path it dropped; it is not a round-trip, and
nothing built on it may claim model fidelity.
