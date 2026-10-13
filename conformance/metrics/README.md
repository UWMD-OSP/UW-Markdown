# Metric dictionary conformance — a lender with only the standard

`verifier.mjs` verifies through core's `verifyStatedMetrics`
(`metric-verification.ts`, RFC 0083 §2), which uses only the UWX reader,
section resolver, safe-expression evaluator and shared §VIII.5 quantizer. The
fixture keeps the plumbing: example discovery, the Lite anchor view and the
statement bindings, and it passes the normative
[metric dictionary](../../spec/metrics/README.md) read from `spec/`. It imports
no packs, defaults, cascade or public core barrel; there are no prior results,
overrides, inferred financial inputs or underwriting workflow. The source-token
precision readers in `numeric-tokens.mjs` re-export the library's.

It discovers every `.uw.md` / `.uwx.md` below `examples/` whose stated class has
dictionary calculations (19 documents, including Lite, market-data and the
standalone package record). The builtin Mesa Gateway data-center and Desert
Palms manufactured-housing examples are included. Standalone non-deal records
without a builtin dictionary class are excluded explicitly.
Current active section blocks and frontmatter `quick_metrics` are checked;
superseded blocks, prose, scenarios, forecasts and market observations are not
current metric claims. A numeric statement is counted separately at each address,
so agreeing/disagreeing copies in frontmatter and sections remain visible.

`statement-bindings.json` enumerates fixture-only aliases such as
`valuation.going_in_cap_rate`, `valuation.price_per_sf` and
`debt_structure.sizing_metrics.dscr_underwritten`. Canonical metric ids at the
listed current output section roots are also found automatically. These are
bindings to existing example fields, not a new normative alias contract. Lite
anchors map only their explicitly stated input sections, using the published
bridge's section mapping without any bridge defaults. Primary-size statements
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

There are **187 verified, 0 failed, 0 unverifiable** numeric statements.
All 35 former precision disagreements now verify. Riverside LTC remains the
literal `0.6`; it verifies at the 1% leverage minimum. No tokens were padded to
clear findings. Agave's original `0.4938` verifies against its stated $48.6M
underwritten value; validator CC-02 evaluates clean. Every other example's LTV
is unchanged. Missing-input/type/refusal cases remain controls.

| Example (relative to examples/) | Verified | Failed | Unverifiable |
|---|---|---|---|
| `Agave-Court-Apts-Scottsdale-AZ.uwx.md` | 9 | 0 | 0 |
| `Cactus-Crossing-Retail-Mesa-AZ.uwx.md` | 14 | 0 | 0 |
| `Desert-Palms-MHC-Apache-Junction-AZ.uwx.md` | 14 | 0 | 0 |
| `Ironwood-Logistics-Industrial-Tolleson-AZ.uwx.md` | 14 | 0 | 0 |
| `Mesa-Gateway-Data-Center-Mesa-AZ.uwx.md` | 30 | 0 | 0 |
| `Mill-Ave-Commons-Student-Tempe-AZ.uwx.md` | 14 | 0 | 0 |
| `Ocotillo-Senior-Living-Chandler-AZ.uwx.md` | 15 | 0 | 0 |
| `Parkview-Apts-Glendale-AZ.uw.md` | 2 | 0 | 0 |
| `Parkview-Apts-Glendale-AZ.uwx.md` | 9 | 0 | 0 |
| `Riverside-Office-Phoenix-AZ.uwx.md` | 14 | 0 | 0 |
| `Roosevelt-Row-MixedUse-Phoenix-AZ.uwx.md` | 5 | 0 | 0 |
| `Saguaro-Select-Hotel-Tempe-AZ.uwx.md` | 15 | 0 | 0 |
| `Sonoran-Self-Storage-Peoria-AZ.uwx.md` | 13 | 0 | 0 |
| `Sundance-Ranch-Land-Buckeye-AZ.uwx.md` | 7 | 0 | 0 |
| `market-data/Phoenix-Multifamily-2026-Q2.uwx.md` | 0 | 0 | 0 |
| `parkview-after-L6.uwx.md` | 9 | 0 | 0 |
| `standalone/externalized-deal.uwx.md` | 1 | 0 | 0 |
| `standalone/inline-deal.uwx.md` | 1 | 0 | 0 |
| `standalone/package/records/externalized-deal.uwx.md` | 1 | 0 | 0 |

The only value corrections authorized by the examples' own inputs are:

| Example | Address | Before | After | Evidence |
|---|---|---|---|---|
| Sonoran Self-Storage | `quick_metrics.dscr` | `1.3153` | `1.3161` | Stated NOI 672,000 / stated annual debt service 510,606, quantized at 4 dp. |
| Sonoran Self-Storage | `debt_structure.dscr` | `1.3153` | `1.3161` | Same inputs and quantization. |

The original RFC 0079 examples do not state numeric cash-on-cash claims;
the two RFC 0080 examples do, and all verify. The original eight
examples with a sole sponsor-equity non-debt source now explicitly state
`sources_uses.equity_metrics.equity_total`, equal to that source line. Each
`_notes` identifies this as an identity of stated fields; the verifier never
infers equity. Their cash-on-cash values stay unchanged under the common
formula. Agave stays null because mezzanine and preferred equity make the total
ambiguous. Non-multifamily producers now need an explicit `equity_total` for
cash-on-cash. The [RFC's audit](../../docs/rfcs/0079-metric-precision.md#example-evidence)
lists each source identity and computed value.

## Controls

The independent controls verify the import graph excludes packs, defaults,
cascade and the core barrel. They cover statement tampering; missing/null/type-invalid
inputs; zero division; dictionary formula selection; cent-level quantization of
a noisy binary64 amount over $100k and a one-cent negative; negative half cents;
common cash-on-cash across all eleven income classes; lazy stated-year-1 selection (including
zero); senior debt selection and unresolved equity debt service; stated mixed-use
allocation; fractional raw sizes with missing, string and nonfinite controls;
immutability; source-token trailing zeroes, exponents, escaped/nested keys,
a payload member named `content`, YAML comments; coarse exact/wrong statements, all twelve LTV denominators and lazy fallbacks,
minimum precision, output ceilings and
no double rounding. Dictionary/pack/size completeness is separately enforced by
`packages/uwmd-core/src/builtin-packs/metric-dictionary.test.ts`.
