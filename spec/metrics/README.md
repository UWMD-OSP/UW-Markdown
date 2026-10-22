# UW metric dictionary

This directory is normative under [RFC 0078](../../docs/rfcs/0078-protocol-is-verification.md).
It defines the current builtin calculations and primary-size registry independently
of any starter engine, defaults, underwriting workflow, or Excel layout.

| Dictionary | Contents | Schema |
|---|---|---|
| [builtin.json](builtin.json) | 171 class-scoped calculations and eleven primary-size selectors | [metric-dictionary.schema.json](../schemas/metric-dictionary.schema.json) |

## Statement bindings (RFC 0099)

`statement_bindings` is the closed registry of where a document states each
metric, beyond frontmatter `quick_metrics.<id>`. A metric's own id at each
`output_sections` root is a statement of it, and so is each `section.path` in
`aliases[<id>]` (for example `valuation.going_in_cap_rate` for `cap_rate` and
`debt_structure.sizing_metrics.dscr_underwritten` for `dscr`). An alias applies
to every class whose entries carry that id. A Verifier checks every statement at
every bound address, each counted separately, so agreeing and disagreeing
copies both stay visible
([Protocol §II.2](../UW_PROTOCOL.md#ii-2-verifier)). No binding is inferred from
a field name; a new statement home is a dictionary change.

## Calculation entries

Select a `calculations` entry by **asset class and id**, never by id alone.
`asset_classes` states applicability. Each (class, id) MUST occur once within
that array. The extraction keeps one entry per pack declaration, including
mixed-use's component calculations; identical ids in different classes retain
their own formulas, inputs and labels.

`formula` uses [Protocol §VIII.1](../UW_PROTOCOL.md#viii-1-safe-expression-grammar-ebnf)
notation. `input_paths` enumerates every potential document read in expression
order, once each, including conditional branches. It is **not** a list of
inputs that must all be present: evaluate the stated expression, including its
null tests and lazy conditional selection. `section_roles` supplies the
expression's declared role preferences under §VIII.2 (RFC 0066); `{}` means
there is no declared role. It does not confer a senior preference implicitly.

`unit` is the existing unit token; `%` values are fractions. `round_to` is the
full §VIII.5 reporting precision: money (`$`) uses 2, rates (`%`) use 6 and ratios
(`x`) use 4. **`minimum_stated_decimals`** is each entry's minimum **comparison** precision,
in stored units, under [RFC 0079](../../docs/rfcs/0079-metric-precision.md).
It is an integer from zero through `round_to`, stated explicitly in each entry;
it does not change engine/Excel reporting.

Retain source decimal places, including trailing zeroes and exponent shifts:
`1.20` carries two; `1.2` carries one; `1.200e-2` carries five. Fractional
`0.0550` carries four (0.01%); an anchored Lite `5.50%` decodes to that same
precision. A derived display string carries none.

Evaluate unrounded in binary64. Quantize the **unrounded** expression once,
half away from zero, at `min(max(stated_decimals, minimum_stated_decimals), round_to)`.
Compare to the stated value, quantizing the statement only above `round_to`.
A coarse statement is checked at the minimum: `0.07` can equal 7.0%; LTC `0.6`
can verify `0.601852` at the 1% floor. DSCR `1.5` versus `1.7` fails, rather
than becoming unverifiable. Equality verifies and a finite disagreement fails;
unverifiable is for absent usable inputs, not inadequate spelling precision.
No additional tolerance or double rounding is allowed.
[Protocol §VIII.5.1](../UW_PROTOCOL.md#viii-5-1-stated-metric-precision-rfc-0079)
is normative. The reference API rejects unavailable/invalid source precision
as a typed caller error; preserve it before numeric parsing.

Minimums: `cap_rate`, `debt_yield` and `cash_on_cash` use 3 (0.1%); other `%`
entries and `x` entries use 2; dollar entries per SF/NRSF (ids containing `sqft`,
`psf`, or `nrsf`) use 2; other dollar entries use 0. Raw sizes use 0 and exact
finite-number equality. The RFC's Decisions table explains each group.

All twelve `ltv` entries divide loan amount by stated `valuation.underwritten_value`,
falling back to `valuation.purchase_price` only when the former is absent/null,
in agreement with CC-02 and capital-stack `ltv_through`.
Producers now need to state `sources_uses.equity_metrics.equity_total` for
non-multifamily cash-on-cash. A single sole non-debt source can be documented as
an identity of stated fields; neither the verifier nor the packs infer it.

`null_semantics: "expression"` means §VIII.2's expression semantics apply:
missing or null operands propagate null in arithmetic; explicit null tests and
conditional branches follow the formula. In particular, every income-class cash-on-cash
requires stated total equity and retains its stated-Y1 / NOI-minus-debt-service
fallback exactly as written. Zero divisors, invalid operand types and unresolved
section selection retain the existing calc refusals. A null or refused result
is **unverifiable**, not an inferred zero or a disagreement. A finite numeric
result that disagrees at the stated precision is **failed**.
`null_semantics: "positive_size_denominator"` (RFC 0100) is the same expression
semantics for a metric whose formula divides by a registered `property` size
(primary or secondary, Protocol §XIII) of its class: price, loan or NOI per unit,
square foot, key, bed, acre, site or kW, and the size-based ratios. When that size
is stated below zero the statement is **unverifiable**
(`negative_size_denominator`), so no Verifier confirms a figure against an
impossible size; zero already refuses as a division. Format §5.5 refuses the
negative size itself (`SIZE-01`).
`deterministic: true` preserves the existing declarations' deterministic contract.

RFC 0079 unifies all nine `cash_on_cash` definitions of its time, and RFC 0080's
`data_center` and `manufactured_housing` entries copy it exactly (eleven in
all); land has no such metric.
`loan_per_sqft`, `price_per_sqft`, `noi_per_sqft` and `occupancy` retain their
class-specific differences extracted under RFC 0078. Mixed-use `cap_rate` retains its different label
with the same formula. Changing these definitions requires a separate normative
change; selecting an entry does not authorize filling absent inputs.

| Asset class | Calculation entries |
|---|---|
| `multifamily` | 8 |
| `office` | 11 |
| `retail` | 12 |
| `industrial` | 12 |
| `self_storage` | 12 |
| `hospitality` | 18 |
| `senior_housing` | 14 |
| `student_housing` | 14 |
| `land` | 12 |
| `mixed_use` | 25 |
| `data_center` | 20 |
| `manufactured_housing` | 13 |

## Primary-size selection

`size_intensives` replaces the registry formerly printed in Protocol §XIII.
Each row's `path` is relative to the `property` section (Format §4.1), and its
`formula` / `input_paths` is the corresponding `property.<path>` selector.
`secondary` preserves the other legitimate size field paths, also relative to
`property`. It does not supply fallback denominators or conversion formulas.
A class MUST have at most one primary-size entry.

A conforming implementation displaying, exporting, or indexing deal size MUST
select the primary field through this dictionary and MUST NOT assume
`total_units`. The primary is the class's denominator for its per-unit value
metrics; labels and units come from the same entry.

These are **stated selectors**, not rounded calculations. `round_to: null` and
`null_semantics: "finite_stated_number"` preserve the raw finite number stated
in `property`. Missing, null, nonnumeric (including numeric strings), or nonfinite
quantities yield no size. No quantity, fallback size, or rounding precision is
inferred. This preserves `resolveDealSize()`'s existing behavior, including
fractional acres.

### Mixed-use and unknown classes

`mixed_use` has no property-level primary size. A consumer needing its size
MUST read per-component intensives from `components` (Format §4.23) and MUST NOT
synthesize a property total by summing across uses: a bed and a square foot do
not add. An asset class without an entry has no primary size; a consumer MUST
state no size rather than guess. The lookup is nullable. Future builtin classes
add their explicit entries through the normal RFC process.

## Executable mirrors and drift checks

The twelve builtin starter packs derive their definitions from this dictionary's
contract through exact, bidirectional parity tests. Packs are kept as TypeScript
mirrors, so existing Excel layouts and their expression-to-Excel bindings remain
unchanged. `builtin-packs/metric-dictionary.test.ts` compares every declaration, potential
input, effective precision, role, label, unit and null contract, and proves there
are no orphan dictionary entries. It also compares every `SIZE_INTENSIVES` row,
including secondary paths, against `size_intensives`. Both directions run in
`npm test`; `validate-schemas` compiles the dictionary schema.

The [verifier-only conformance fixture](../../conformance/metrics/README.md)
checks example statements from dictionary expressions without importing packs,
defaults or cascade. Known example disagreements are recorded as findings;
they do not change the dictionary or the examples.

## RFC 0081 hospitality addresses

The dictionary describes the final single-home hotel fields: `rent_roll.adr`, `rent_roll.occupancy`, `rent_roll.available_room_nights`, and `property.keys`. Since RFC 0103, `total_room_revenue` and `room_revenue_per_key` read the stated booked rooms revenue (`noi_model.income.rooms_revenue`) rather than ADR × occupancy × nights. The hospitality pack reads the same addresses, and the dictionary/pack parity test compares them directly.

## Definitions and authorities (RFC 0103)

Four definitions follow a published outside authority:

| Metric | Definition | Authority |
|---|---|---|
| `fb_gross_margin` | (F&B revenue − cost of sales) ÷ revenue; no labor | USALI (HFTP, AHLA and the Global Finance Committee), Food and Beverage Department schedule, Gross Profit; HFTP *USALI Frequently Asked Questions*, Food and Beverage Department |
| `mark_to_market` (data center) | (market − in-place rent) ÷ in-place; positive = under-rented upside | Broker and lender convention; no standard defines the percentage. EPRA *Best Practices Recommendations* (2024) §4.3 discloses its inputs (rent passing and ERV) |
| `annual_facility_kwh`, `annual_power_cost`, `power_cost_per_kw_month` | Metered kWh, else contracted kW × explicit draw × PUE (measured before design) × 8,760; zero landlord cost under metered pass-through; null with no draw | The Green Grid, *White Paper #49: PUE — A Comprehensive Examination of the Metric* (PUE over a year of measured energy; energy = power × time) |
| `total_room_revenue`, `room_revenue_per_key` | Stated booked rooms revenue, and ÷ keys; ADR × occupancy × nights only as the 1% `CC-HOSP-05` cross-check | OCC *Comptroller's Handbook: Commercial Real Estate Lending*, Hotels (ADR and RevPAR identities on paid rooms); HFTP USALI FAQ, Rooms Department (contents of rooms revenue) |

## Variants in use

Where practice computes a metric more than one way, these are the forms the
dictionary uses today. This section describes the existing definitions; it
changes none of them.

| Metric | UWMD computes | Practice and authority | What differs |
|---|---|---|---|
| `price_per_kw`, `price_per_commissioned_kw` (data center) | Price ÷ commissioned critical IT kW. `price_per_kw` reads `valuation.purchase_price` and `property.critical_it_load_kw`; `price_per_commissioned_kw` reads `quick_metrics.purchase_price` and `dc_capacity.critical_it_load_kw` | CMBS offering documents quote the same ratio per MW of critical IT load (BBCMS 2023-C20 prospectus, Annex A-3, comparable data-center sales) | Per kW, not per MW. The two kW fields must agree (`CC-DC-08`); the two price fields are not cross-checked |
| `revpar_index` (hospitality) | Property RevPAR, rounded to cents, ÷ `hotel_metrics.market_revpar` (comp-set RevPAR for the same period): a plain ratio, 1.00 = fair share | STR's RevPAR Index (RGI) is the same ratio × 100 | Scale (1.17 vs 117) and the inner cent rounding |
| `revpor` (senior housing) | EGI ÷ (occupied units on the rent-roll date × 12) | Operators report resident fees and services ÷ average occupied units over the period (for example Welltower's non-GAAP RevPOR definition, 8-K earnings release) | The numerator is all EGI, and the denominator is a point-in-time count |
| `adr`, `occupancy` (hospitality) | Rooms revenue ÷ `rent_roll.occupied_room_nights`; occupied ÷ available room nights | USALI and the OCC *Comptroller's Handbook: Commercial Real Estate Lending* (Hotels): paid rooms sold, excluding complimentary and house-use rooms | None: `occupied_room_nights` is defined as paid room nights sold, complimentary and house-use excluded (RFC 0113) |
| `gop_margin` (hospitality) | Gross operating profit ÷ `noi_model.income.effective_gross_income` | USALI: gross operating profit ÷ total operating revenue | None for a hotel, where EGI is total operating revenue (no vacancy deduction); a model whose EGI is net of anything drifts |
| `price_per_sqft`, `price_per_nrsf` and the other per-area ids | Purchase price ÷ the class's primary size: rentable SF (office, industrial), gross leasable area (retail), net rentable SF (self storage) | OCC *Comptroller's Handbook*, appraisal review units of comparison; CMBS documents quote appraised value per SF | Always purchase price, never appraised value; the measurement standard (BOMA, IPMS, REBNY, RICS) is recorded in `property.area_measurement` when stated (RFC 0114), and no metric converts between standards |
| `economic_occupancy` (self storage) | EGI ÷ gross potential rent | Economic occupancy is GPR less physical vacancy, concessions and credit loss, ÷ GPR (the complement of economic vacancy in the Fannie Mae DUS Guide, Part II, Ch. 2, §203.01) | EGI includes other income, so the ratio can exceed 1 |
| `cash_on_cash` (all income classes) | Year-1 levered net cash flow from the DCF ÷ total equity, falling back to NOI − annual debt service; `null` without stated equity | The equity dividend rate: (NOI − annual debt service) ÷ equity (California State Board of Equalization, *The Income Approach to Value*) | The primary path is after capital items and reserves; the fallback is the textbook form |

Open questions, for a decision before any change: whether to cross-check the two
data-center price fields (RFC 0086).
