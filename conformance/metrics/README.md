# Metric dictionary conformance — a lender with only the standard

`verifier.mjs` verifies through `@uwmd/verify`'s `verifyStatedMetrics`
(`metric-verification.ts`, RFC 0083 §2), which uses only the UWX reader,
section resolver, safe-expression evaluator and shared §VIII.5 quantizer. The
fixture keeps the plumbing: example discovery and the Lite anchor view, and
it passes the normative
[metric dictionary](../../spec/metrics/README.md) read from `spec/`. It imports
`@uwmd/verify`'s built package entry (and, for the single-metric comparison,
the same build's `metric-verification.js`) and nothing of `@uwmd/core`: no
defaults, cascade, display formatting or core barrel; there are no prior results,
overrides, inferred financial inputs or underwriting workflow. The source-token
precision readers in `numeric-tokens.mjs` re-export the library's.

It discovers every `.uw.md` / `.uwx.md` below `examples/` whose stated class has
dictionary calculations (26 documents, including Lite, market-data, the
standalone package record and the two `examples/verification/` documents, one
of which states a cap rate that fails by design). The builtin Mesa Gateway data-center and Desert
Palms manufactured-housing examples are included. Standalone non-deal records
without a builtin dictionary class are excluded explicitly.
Current active section blocks and frontmatter `quick_metrics` are checked;
superseded blocks, prose, scenarios, forecasts and market observations are not
current metric claims. A numeric statement is counted separately at each address,
so agreeing/disagreeing copies in frontmatter and sections remain visible.

Where a document states each metric is the dictionary's normative
`statement_bindings` (RFC 0099): canonical ids at the output section roots, plus
aliases such as `valuation.going_in_cap_rate`, `valuation.price_per_sf` and
`debt_structure.sizing_metrics.dscr_underwritten`. `verifyStatedMetrics` reads
it from the dictionary, so the fixture holds no copy. `statement-homes/cases.json`
proves each alias: a +10% tamper at a section home fails at that address while
its `quick_metrics` copy keeps its own outcome, and an unbound look-alike field
is no statement. Two data-center cases edit the frontmatter (RFC 0086): a
drifted `quick_metrics.purchase_price` alone leaves `price_per_commissioned_kw`
verified, because the metric reads `valuation.purchase_price`, and a statement
computed from the drifted price fails. Lite anchors map only their explicitly stated input sections
(`lite-input-sections.json`), using the published bridge's section mapping
without any bridge defaults. Primary-size statements
are also checked as unrounded raw finite selectors. The two new builtin examples state cash-on-cash outputs; controls exercise the
shared definition in every income class.

`expected.json` records every selected address, stated value, quantized computed
value, source decimals, comparison decimals and state. RFC 0079 compares the
unrounded result at `min(max(source decimals, minimum), round_to)`. Coarse
statements are checked at the minimum: exact `0.07` verifies and DSCR `1.5`
versus `1.7` fails. Missing/null inputs, invalid operands, nonfinite results and
resolution refusals are **unverifiable**. Missing precision passed to the
comparison API (`verifyStatedMetric`) is a typed caller error; at document level
`verifyStatedMetrics` reports a statement whose source token it cannot read
(an envelope-decoded document, for example) as unverifiable
`missing_stated_precision`. Every fixture statement has its source token. Definitions or inputs not stated are not invented or counted
as numeric claims. The market-data example therefore has zero claims; standalone
deal examples each state one primary size.

Run after building core:

```sh
node --test conformance/metrics/verifier.test.mjs
npm run conformance -- --suite=metrics
```

The named `metrics` suite also runs by default in `npm run conformance`. Its pass
means the complete evidence matches the recorded findings and all negative
controls pass; it does **not** mean every example metric verifies. New, removed
or changed claims fail the gate until reviewed. `--update` does not silently
replace this baseline.

## Current example findings

`expected.json` records 26 selected documents:
**189 verified, 1 failed and 21 unverifiable** numeric statements.
The deliberately wrong-cap-rate fixture supplies the expected failure.
Unavailable inputs or an absent explicit LTV basis remain unverifiable; a
successful corpus run matches these stated outcomes, not an all-metrics-pass claim.
Stated financial figures are unchanged; LTV expectations follow the explicitly authored loan bases.

| Example (relative to examples/) | Verified | Failed | Unverifiable |
|---|---|---|---|
| `Agave-Court-Apts-Scottsdale-AZ.uwx.md` | 9 | 0 | 0 |
| `Cactus-Crossing-Retail-Mesa-AZ.uwx.md` | 12 | 0 | 2 |
| `Desert-Palms-MHC-Apache-Junction-AZ.uwx.md` | 13 | 0 | 1 |
| `Ironwood-Logistics-Industrial-Tolleson-AZ.uwx.md` | 12 | 0 | 2 |
| `Mesa-Gateway-Data-Center-Mesa-AZ.uwx.md` | 28 | 0 | 3 |
| `Mill-Ave-Commons-Student-Tempe-AZ.uwx.md` | 12 | 0 | 2 |
| `Ocotillo-Senior-Living-Chandler-AZ.uwx.md` | 13 | 0 | 2 |
| `Parkview-Apts-Glendale-AZ.uw.md` | 2 | 0 | 0 |
| `Parkview-Apts-Glendale-AZ.uwx.md` | 9 | 0 | 0 |
| `Riverside-Office-Phoenix-AZ.uwx.md` | 12 | 0 | 2 |
| `Roosevelt-Row-MixedUse-Phoenix-AZ.uwx.md` | 4 | 0 | 1 |
| `Saguaro-Select-Hotel-Tempe-AZ.uwx.md` | 13 | 0 | 2 |
| `Sonoran-Self-Storage-Peoria-AZ.uwx.md` | 11 | 0 | 2 |
| `Sundance-Ranch-Land-Buckeye-AZ.uwx.md` | 6 | 0 | 2 |
| `document-facts/target.uwx.md` | 0 | 0 | 0 |
| `market-data/Phoenix-Multifamily-2026-Q2.uwx.md` | 0 | 0 | 0 |
| `parkview-reviewed.uwx.md` | 9 | 0 | 0 |
| `standalone/authored-2026-10-17/externalized-deal.uwx.md` | 1 | 0 | 0 |
| `standalone/authored-2026-10-17/inline-deal.uwx.md` | 1 | 0 | 0 |
| `standalone/authored-2026-10-17/package/records/externalized-deal.uwx.md` | 1 | 0 | 0 |
| `standalone/authored-2026-10-17/package/records/inline-deal.uwx.md` | 1 | 0 | 0 |
| `standalone/externalized-deal.uwx.md` | 1 | 0 | 0 |
| `standalone/inline-deal.uwx.md` | 1 | 0 | 0 |
| `standalone/package/records/externalized-deal.uwx.md` | 1 | 0 | 0 |
| `verification/deal.uwx.md` | 9 | 0 | 0 |
| `verification/deal.wrong-cap-rate.uwx.md` | 8 | 1 | 0 |

## Controls

The independent controls verify the import graph reaches no `@uwmd/core`
module at all (and no starter packs, defaults or cascade), and that it does
reach `@uwmd/verify`'s entry and evaluator. They cover statement tampering; missing/null/type-invalid
inputs; zero division; dictionary formula selection; cent-level quantization of
a noisy binary64 amount over $100k and a one-cent negative; negative half cents;
common cash-on-cash across all eleven income classes; lazy stated-year-1 selection (including
zero); senior debt selection and unresolved equity debt service; stated mixed-use
allocation; fractional raw sizes with missing, string and nonfinite controls;
immutability; source-token trailing zeroes, exponents, escaped/nested keys,
a payload member named `content`, YAML comments; coarse exact/wrong statements, all twelve LTV denominators and lazy fallbacks,
minimum precision, output ceilings and
no double rounding. Dictionary/pack/size completeness is separately enforced by
`packages/uwmd-verify/src/builtin-packs/metric-dictionary.test.ts`.
