---
rfc: 0086
title: One purchase-price authority for data-center metrics, with the summary cross-checked
status: draft
author: UWMD maintainers
created: 2026-10-15
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0086: One purchase-price authority for data-center metrics, with the summary cross-checked

> **Draft for owner acceptance, rewritten 2026-10-21** with a recommendation and
> its StackUW impact (owner request, 2026-10-21 night). Origin: issue #343
> finding M04 and bug bash finding #493. It changes a dictionary formula and adds
> a cross-check, so it is normative.

## Summary

A data-center record can state its purchase price in three places:
`valuation.purchase_price`, `sources_uses.uses.purchase_price` and frontmatter
`quick_metrics.purchase_price`. Two dictionary metrics price the same
commissioned load from different places:

| Metric | Formula today |
|---|---|
| `price_per_kw` | `valuation.purchase_price / property.critical_it_load_kw` |
| `price_per_commissioned_kw` | `quick_metrics.purchase_price / dc_capacity.critical_it_load_kw` |

CC-DC-08 already requires the two kW figures to agree exactly, so the metrics
differ only in their numerator. In the #343 repro, the frontmatter copy says
$12m and the valuation $10m, over 1,000 kW. The record then states two prices
per kW, $12,000 and $10,000, and both verify. CC-10 ties `sources_uses` to the
valuation, but nothing ties the frontmatter to it.

**Recommendation:** `valuation.purchase_price` is the one authority. Both
metrics read it, and a new `CC-17` checks the frontmatter summary against it,
the way CC-10 checks Sources & Uses.

## Motivation

- **One fact, two answers.** Price per commissioned kW is the headline
  data-center unit of comparison. A record should not be able to state two of
  them and pass.
- **The precedents already pick an authority.**
  - `noi_per_commissioned_kw` reads `noi_model`, not frontmatter.
  - Every other dictionary formula reads a section; `price_per_commissioned_kw`
    is the only one that reads `quick_metrics` (#493).
  - Format §2.2 describes the frontmatter key metrics as a denormalized mirror
    "for fast lookup".
  - RFC 0103 made stated section values the authority and derived copies
    cross-checks.
- **A summary should be checked, not trusted.** RFC 0099 verifies a metric
  wherever a record states it, frontmatter included. A frontmatter restatement of
  an input, like `purchase_price`, gets no check today.

## Proposed change

1. **Dictionary (D1).** `price_per_commissioned_kw` becomes
   `valuation.purchase_price / dc_capacity.critical_it_load_kw`, and its
   `input_paths` follow. `round_to`, unit, null semantics and
   `positive_size_denominator` are unchanged. `price_per_kw` is unchanged. Both
   ids stay (D2).
2. **New cross-check `CC-17` (D3).** `quick_metrics.purchase_price` must match
   `valuation.purchase_price`.
   - Tolerance and severity are CC-10's: an absolute difference over $100 is an
     `error`.
   - It applies to every asset class, because every class has the frontmatter
     summary.
   - Coverage follows CC-10 (§5.3): `skipped` / `field_absent` when either value
     is absent, and CC-16 handling when valuation variants do not resolve.
3. **Variant selection (D4).** The formula and CC-17 read the valuation block
   the existing rules select: the §5.3 preference order for cross-checks, and
   Protocol §VIII.2 / RFC 0066 for calculations. There is no binding field and
   no frontmatter routing; descriptive `scenario` never selects behaviour
   (Format §2.2b).
4. **No substitution (D5).** If `valuation.purchase_price` is absent, the metrics
   are null (unverifiable), as `price_per_kw` is today. They do not fall back to
   the frontmatter copy, `sources_uses`, or appraised or underwritten value.
5. **Docs.** The M04 row in the `spec/metrics/README.md` variants table says
   the price fields are now cross-checked, and its open question is removed.

## Compatibility analysis

No compatibility path (prelaunch; the owner rule). A record whose frontmatter
price differs from its valuation by more than $100 changes outcome:
- it gains a `CC-17` error;
- its stated `price_per_commissioned_kw` is now checked against the valuation
  price, so it can fail.

## StackUW impact

StackUW exports data-center records, and its records carry frontmatter
`quick_metrics` and a `valuation` section. I have not re-checked StackUW's
export code; this is from the CoS integration ledger and the shipped
data-center example, which states both per-kW metrics. At its next UWMD
upgrade:

- **No change where both prices agree.** This is the expected case when StackUW
  writes the frontmatter from the model. `price_per_commissioned_kw` then equals
  `price_per_kw`, and both verify as they do today.
- **A new `CC-17` error where they differ by more than $100**, in any asset
  class. That is a stale summary against the model: a real defect, fixed in
  StackUW's frontmatter writer.
- **A failed `price_per_commissioned_kw` statement**, in that same case, if
  StackUW states the metric. The figure was computed from the stale frontmatter
  price.
- **Multifamily and other classes** see only `CC-17`, and only when their
  summary drifts.

The check to run at the upgrade: verify one fresh export per StackUW preset and
look for `CC-17`.

## Conformance impact

The data-center fixtures (`calc/fixtures/data_center-price_per_kw` and the
builtin-class cases) state equal prices, so their expected values do not change.

New cases:
- the frontmatter price equals the valuation (CC-17 evaluated, clean);
- the frontmatter is $101 off (CC-17 error) and $100 off (clean, at the
  boundary);
- the frontmatter price is absent (skipped / `field_absent`);
- the valuation is absent (skipped; both metrics unverifiable);
- two unresolved valuation variants (CC-16);
- a `price_per_commissioned_kw` statement computed from a drifted frontmatter
  price, which now fails.

The Python implementation adds CC-17.

## Reference implementation

- `spec/metrics/builtin.json` (one entry) and its generated mirror;
- the data-center pack;
- the CC-17 row in Format §5.3, the validator and the code registry;
- the Excel data-center layout, which reads the dictionary formula;
- Python;
- the cases above and the variants table.

## Alternatives considered

- **Keep both formulas and disclose the lineage.** This is the status quo. It
  leaves #343 M04 open, with two verified prices per kW. Rejected.
- **Retire `price_per_commissioned_kw`** as a duplicate of `price_per_kw` once
  both read the valuation. This is cleaner, but the shipped records and the
  variants doc state both ids, and removing one gains a reader nothing. Not
  proposed; see D2.
- **Bind the summary to a named valuation variant** (the 2026-10-15 draft's
  recommendation). This adds a binding member, a lifecycle and refusal rules for
  one input, when the existing variant selection already answers "which
  valuation". Not proposed.
- **Opt-in reconciliation through a profile.** A summary that contradicts its
  own record is wrong for every reader, not only for those who opt in. Rejected.
- **A new tolerance for CC-17.** CC-10 already pins how two stated purchase
  prices are compared, so a second rule for the same comparison would be a new
  convention. Not proposed.

## Decisions proposed for owner review

| # | Question | Recommendation | Alternative |
|---|---|---|---|
| D1 | Authority for the data-center price numerators | `valuation.purchase_price` for both | Keep the frontmatter numerator and disclose it |
| D2 | `price_per_commissioned_kw` id | Keep, with the new formula | Retire it as a duplicate of `price_per_kw` |
| D3 | Frontmatter price cross-check | New `CC-17`, every class, CC-10's $100 / error rule | Data-center only, or no check |
| D4 | Which valuation | The existing variant selection; no binding field | A binding to a named variant (the earlier draft) |
| D5 | Valuation price absent | Metrics null / unverifiable; no fallback | Fall back to the frontmatter copy |
| D6 | Versions | None allocated; prelaunch 4.x | RFC 0091 D6 |

## Prior art

- Issue #343 (M04); #493; `spec/metrics/README.md` "Variants in use" (#451).
- CC-10 (Format §5.3), CC-DC-08 (RFC 0080).
- RFC 0099 (verify every statement home); RFC 0103 (the stated section value is
  the authority, and derived copies are cross-checks).
- Protocol §VIII.2 and RFC 0066 (variant selection); Format §2.2b (descriptive
  scenario never selects behaviour).
