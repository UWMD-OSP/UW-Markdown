---
rfc: 0105
title: Name the field each financial-validity threshold reads, and check each stated home
status: accepted
author: UWMD maintainers
created: 2026-10-20
affects:
  - format-spec
  - core-library
  - conformance-corpus
---

# RFC 0105: Financial-validity thresholds read named, defined fields

> **Accepted by the owner, 2026-10-20, as drafted** (owner: "RFC 0105 accepted as drafted (D1 every Format-defined home, D2 most severe band only, D3 keep FV-01..FV-14 numbering, D4 undefined fields not read, D5 no version)").
> Origin:
> [#428](https://github.com/UWMD-OSP/UW-Markdown/issues/428), found while
> certifying the independent Python implementation (#354). It changes which
> documents draw `FV-*` findings, so it is normative.

## Summary

Format §5.2 gives the financial-validity bands (DSCR, LTV, debt yield, cap rate,
vacancy, OpEx ratio, IRR, equity multiple, rent growth, LTC) but not which field
each is read from, and does not number the codes. The reference reads
frontmatter `quick_metrics` plus three fields the Format never defines
(`noi_model.vacancy_rate`, `dcf.levered_equity_multiple`,
`dcf.assumptions.annual_rent_growth`); Python reads the section fields the
Format does define. This RFC adds a "read from" column and the code numbers to
§5.2, and checks every Format-defined home of each metric, mirroring RFC 0099's
rule for dictionary metrics.

## Motivation

| Metric | Reference reads | Python reads | Format-defined home(s) |
|---|---|---|---|
| DSCR, LTV, debt yield, cap rate, IRR | `quick_metrics.*` | section fields | both: `quick_metrics` and the section fields |
| Vacancy | `noi_model.vacancy_rate` (**undefined**) | `noi_model.income.vacancy_credit_loss.rate_applied` | `rate_applied` (§4.5) |
| OpEx ratio | total opex ÷ EGI | `noi_model.expenses.expense_ratio` | `expense_ratio` (§4.5) |
| Rent growth | `dcf.assumptions.annual_rent_growth` (**undefined**) | `dcf.assumptions.revenue_growth_rate` | `revenue_growth_rate` (§4.9) |
| Equity multiple | `dcf.levered_equity_multiple` (**undefined**) | `dcf.returns.equity_multiple` | `returns.equity_multiple` |

So one document can draw `FV-04` in one implementation and nothing in the other,
and a value stated in the Format's own field is never checked by the reference.

## Proposed change

1. **§5.2 gains two columns**: the code for each band (`FV-01`…`FV-14`, the
   numbers the reference already emits) and **read from**: every Format-defined
   home of the metric. For the five headline metrics that is
   `quick_metrics.<id>` and the section field (for example
   `debt_structure.sizing_metrics.dscr_underwritten`); for the others, the §4.5
   or §4.9 field above.
2. **Each stated home is checked.** A finite number at a listed home is
   evaluated against the band, and an issue names that home in `field`. A home
   that is absent or not a number draws nothing here.
3. **One issue per home and band.** A value that crosses an error band draws the
   error code only, not also the warning for the same side.
4. Fields the Format does not define are not read.

## Compatibility analysis

No compatibility path (prelaunch). Documents stating figures in the Format's own
fields start drawing `FV-*` where they cross a band; documents relying on the
undefined reference-only fields stop doing so. The portable corpus has no
`FV`-distinguishing case, so no frozen expectation changes.

## Conformance impact

Portable cases for each metric at each home: inside, warning band, error band,
and absent. Both implementations must agree before `validate` is claimed by
Python (#354).

## Alternatives considered

- **One home per metric** (`quick_metrics` only, or section fields only). Simpler,
  but leaves stated figures unchecked, which is the defect RFC 0099 removed for
  dictionary metrics.
- **Keep the reference's reads.** They include fields no document can find in the
  Format.

## Decisions (accepted 2026-10-20)

| # | Question | Proposal | Why |
|---|---|---|---|
| D1 | Which homes | Every Format-defined home (table above) | Same rule as RFC 0099 for dictionary metrics |
| D2 | Bands on one value | The most severe band crossed, one issue | Today a DSCR under 1.0 draws both FV-04 error and warning |
| D3 | Code numbers | The reference's existing `FV-01`…`FV-14`, written into §5.2 | No renumbering |
| D4 | Undefined fields | Not read | The Format is the contract |
| D5 | Versions | None allocated; prelaunch 4.x | RFC 0091 D6 |
