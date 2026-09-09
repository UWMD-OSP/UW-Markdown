---
rfc: 0038
title: Tax basis on stated return metrics
status: implemented
author: jaredmaxey
created: 2026-09-09
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC 0038: Tax basis on stated return metrics

> **Status note.** Accepted and implemented 2026-09-09 under owner-led
> governance, in the same change as this document. Raised by underwriter.cc
> as UPSTREAM-006 (2026-09-02) while repairing an app bug in which a levered
> IRR that was after-tax sat beside an unlevered IRR that was pre-tax, and
> the difference read as leverage.

## Summary

The `returns` object of the `dcf` section (format §4.9) gains one optional
closed field, `tax_basis: "pre_tax" | "after_tax"`, declaring the basis of
every return metric stated in that object — `levered_irr`, `unlevered_irr`,
`equity_multiple`, `avg_cash_on_cash`, `npv`, `payback_period_years`,
`total_equity_distributions`. When absent the basis is **`pre_tax`**. A
stated value outside the closed set is an error, `RT-01`, in a new
`RT-NN` validator family (return-metric declarations). Nothing else changes:
no metric is recomputed, no threshold moves.

## Motivation

Neither the `returns` fields nor the §4.16 leaf semantics say whether an
IRR or equity multiple is pre- or post-tax. Two conforming producers can
state the same deal's `levered_irr` eight points apart with both documents
valid, and a reader — or a benchmark aggregator over a corpus of documents
(`docs/DATA_LAKE.md`, the RFC 0022 market-data path) — cannot tell that the
values are incomparable. The defect is not that after-tax returns are
wrong; it is that the document cannot say which it means. A one-field
closed declaration with a spec default makes comparability checkable and
costs a producer nothing when it already reports pre-tax, which is the
common LP-reporting convention and therefore the default.

## Proposed change

### Format spec §4.9

In the `returns` sample object, add `"tax_basis": "pre_tax"`. After the
sample, add:

> **`returns.tax_basis` (RFC 0038).** Declares the tax basis of every
> metric stated in `returns`: `pre_tax` (default when absent) or
> `after_tax`. The declaration is per section, not per metric — a `returns`
> object MUST NOT mix bases; a producer that has both states one and carries
> the other in an extension or a separate document. Any other value is
> `RT-01` (error). Readers that compare return metrics across documents MUST
> treat differing bases as incomparable rather than as a spread.
> `frontmatter.quick_metrics.irr_projected` inherits the `dcf` declaration.

### Protocol spec §III.6a

Register the family:

| Prefix | Family | Owning capability | Default severity |
|---|---|---|---|
| `RT-NN` | Return-metric declarations — the `dcf.returns` basis fields (format §4.9, RFC 0038). | `validate` | `error` |

### `@uwmd/core`

- `RETURN_TAX_BASES` (`['pre_tax', 'after_tax']`), `DEFAULT_RETURN_TAX_BASIS`
  (`'pre_tax'`) and the `ReturnTaxBasis` type are exported from `protocol.ts`
  / `types.ts`.
- `getReturnTaxBasis(parsed)` returns the declared basis or the default, so
  consumers never re-implement the default.
- The validator emits `RT-01` on a `dcf.returns.tax_basis` outside the closed
  set; `BUILTIN_REMEDIATIONS` carries it; `VALIDATOR_CODE_FAMILIES` registers
  `RT`.

## Compatibility

- **Format:** additive. Every existing document is `pre_tax` by default,
  which is what every existing consumer already assumed.
- **Protocol:** additive — one new family, one new code. Candidate for the
  next protocol minor; not cut here.
- **Renderers and Excel:** unchanged by this RFC. Labelling the basis beside
  a rendered IRR is a display follow-on (it would move rendered baselines)
  and is left to the tools that own those surfaces.

## Conformance

- `tier-1-reader/fixtures/09-returns-tax-basis.uwx.md`: a `dcf` block whose
  `returns.tax_basis` is `post_tax` (a plausible misspelling) — the frozen
  verdict pins `RT-01` as an error.
- Unit coverage in `validator.returns.test.ts`: absent → default, both
  registered values accepted, an unregistered value → `RT-01` with registry
  copy, `getReturnTaxBasis` on each.

## Implementation

Landed with this RFC: `validator.ts` (`checkReturnsTaxBasis`), `protocol.ts`,
`types.ts`, `index.ts`, the fixture and its baselines, and the two spec
edits above.

## Alternatives considered

- **Per-metric basis** (`levered_irr_tax_basis`, …). Rejected: it multiplies
  fields for a distinction that is a property of the model run, not of one
  output, and it would allow the exact mixed-basis document this RFC exists
  to make expressible-as-wrong.
- **Ride the units registry** (UPSTREAM-004 ask 6). Deferred, not rejected:
  a basis is a property of a value, like a unit, and a future vocabulary
  artifact may absorb it. The field name and values here are chosen to
  survive that move unchanged.
- **Default `after_tax`.** Rejected: LP reporting, lender sizing, and every
  `MULTIFAMILY_STARTER_PACK` output are pre-tax; defaulting the other way
  would re-label every existing document.

## Unresolved questions

- Whether `stress_tests` scenario returns and `distribution_waterfall`
  outcomes should carry the same declaration. Both are computed from the
  same flows and inherit `dcf`'s basis in practice; a later RFC can make
  that inheritance normative if a producer ever needs to state otherwise.
