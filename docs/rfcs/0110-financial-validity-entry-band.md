---
rfc: 0110
title: Name the §4.17 financial_validity entry's band "band", as RFC 0109 does
status: accepted
author: UWMD maintainers
created: 2026-10-21
affects:
  - format-spec
  - conformance-corpus
---

# RFC 0110: Name the §4.17 financial_validity entry's band "band"

> **Accepted by the owner, 2026-10-21, as drafted** (owner: "RFC 0110 (#466)
> accepted, including both proposals: add ltc to the metric list, and drop stored
> entries marked info."). Origin: owner ruling of 2026-10-21 evening (1): rename
> §4.17 `financial_validity[].severity` to `band`, matching RFC 0109. It changes a
> section's member name, so it is normative.

## Summary

RFC 0109 made a financial-validity finding a deal flag with a `band`
(`"error"` or `"warning"`) and no `severity`, so no reader counts a weak deal as a
defective record. Format §4.17 stores those flags in `financial_validity[]`, but
each entry still names the band `severity`, with values `error | warning | info`.
This RFC renames the member to `band`, with the result's two values.

## Motivation

- **Two names for one fact.** A fresh `uwmd validate` reports
  `deal_flags[].band`; the stored section reports `financial_validity[].severity`.
  A consumer reading both maps them by hand, which RFC 0108 removed for every other
  member of the section.
- **The word RFC 0109 retired.** `severity` is the member every reader counts as a
  defect. Keeping it on a stored deal flag reintroduces the misreading RFC 0109
  was accepted to remove.
- **`info` is not a band.** Format §5.2 has warning and error columns only. The one
  corpus entry with `info` (Parkview, "LTV at 70.0% is at policy maximum but
  within range") records a value that crosses no band, so it is not a flag.

## Proposed change

1. **Format §4.17.** A `financial_validity[]` entry carries `band: "error" |
   "warning"` in place of `severity`, with RFC 0109's meaning: the §5.2 column
   crossed. The §4.17 vocabulary note says so. `overall_status` still excludes the
   entries (RFC 0108, RFC 0109).
2. **Metric vocabulary (D2).** The entry's `metric` list gains `ltc`, the band RFC
   0107 added.
3. **No other member changes.** `flag_id`, `value`, `threshold`, `message`,
   `suppressed` and `suppress_reason` keep their meaning.
4. **Corpus.** Every stored `financial_validity[]` entry renames `severity` to
   `band`. An entry whose value is `info` is not a deal flag and is removed (D3).
   The owner's same-evening ruling (3) regenerates the six stored sections from a
   fresh validate, so their entries already come from deal flags and none is
   `info`; the rename is then mechanical.

## Compatibility analysis

No compatibility path (prelaunch; no 5.0 before launch). No implementation reads
the section's contents, so nothing breaks at runtime. There is no section schema.
A retired `severity` member is not refused, as RFC 0108 D5 did for the section's
other retired spellings.

## Conformance impact

The examples and fixtures that state the section (the six RFC 0108 files) rename
the member. The `02-full-multifamily.parsed.json` baseline follows its fixture. No
other expected output changes.

## Reference implementation

- **Files:** `spec/UW_FORMAT_SPEC.md` §4.17 and the corpus files above.
- **API surface:** none.

## Alternatives considered

- **Keep `severity`, restrict it to `error | warning`.** Fixes `info` but keeps the
  word RFC 0109 removed from the result. Rejected.
- **Store `deal_flags` verbatim in a new member and drop `financial_validity[]`.**
  Cleaner mapping, but a larger change to a section whose other members are kept.
  Not proposed.

## Unresolved questions

- `thresholds_used` lists no debt-yield or LTC limits (`debt_yield_warning_below`,
  `ltc_warning_above`, `ltc_error_above`). Adding them is a natural follow-up, but
  it is not part of the ruling.

## Decisions (accepted 2026-10-21)

| # | Question | Proposal | Why |
|---|---|---|---|
| D1 | Member name and values | `band: "error" \| "warning"`, replacing `severity` | The ruling; matches `DealFlag.band` (RFC 0109 D2) |
| D2 | `metric` vocabulary | **Ruled: add `ltc`** | RFC 0107 gave LTC a band |
| D3 | Corpus entries with `info` | **Ruled: removed**; they cross no band | Not deal flags |
| D4 | Retired `severity` | Not refused | As RFC 0108 D5 |
| D5 | Versions | None allocated; prelaunch 4.x | RFC 0091 D6 |

## Prior art

- RFC 0109 (`DealFlag.band`) and RFC 0108 (the section speaks the result's words).
