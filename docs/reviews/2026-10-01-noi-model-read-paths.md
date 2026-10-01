# `noi_model` read-path audit — 2026-10-01

Canonical `UWMD-OSP/UW-Markdown` `main` was
`182176c635ee5e33e60e21afa4dfa9c37829f5c6` at this review. PR #228, the office
GPR repair, is merged there at `3c49671`. This review audits the reference
implementation's **read-only** `noi_model` rendering and view-model paths
against Format §4.5. It repairs only those two read paths. It changes no
Format, Protocol, schema, calculation, package version or worked-example value.

## Normative contract

Format 2.0 is a delta specification. It incorporates `UW_FORMAT_SPEC_v1.md`
Part IV by reference and does not amend §4.5. Part IV says each entry gives the
section's "complete JSON schema". The §4.5 template
(`spec/UW_FORMAT_SPEC_v1.md:1211`) places the figures this audit concerns here:

| Figure | §4.5 path | Shape |
|---|---|---|
| Gross potential rent | `income.gross_potential_rent` | `{ value, source, per_unit_monthly, per_sqft_annually, rationale }` |
| Vacancy & credit loss | `income.vacancy_credit_loss` | `{ value, rate_applied, source, vs_t12_actual, vs_submarket_avg, rationale }` |
| Vacancy rate | `income.vacancy_credit_loss.rate_applied` | number (fraction) |
| Other income | `income.other_income` | `{ value, vs_t12, non_recurring_excluded, breakdown }` |
| Effective gross income | `income.effective_gross_income` | number |
| Total operating expenses | `expenses.total_operating_expenses` | number |
| Expense ratio | `expenses.expense_ratio` | number (fraction) |
| Net operating income | `net_operating_income` | number, section top level |

§4.5 states no top-level `gross_potential_rent`, `vacancy_loss`,
`vacancy_rate`, `other_income`, `effective_gross_income`,
`total_operating_expenses`, `opex_ratio` or `scheduled_gross_revenue`.

### Authority check

No normative surface contradicts these paths.

- **Schemas.** No schema in `spec/schemas/` constrains `noi_model` content.
  `section-gaps.schema.json` names `noi_model` only inside an `examples` entry
  (see "Owner decisions" below).
- **Conformance.** The tier-1 reader fixture `02-full-multifamily` and the #223
  tier-3 fixtures state `noi_model` in the §4.5 shape. No conformance fixture
  states any of the top-level keys above.
- **Rendered baselines are not obligations.** `conformance/tier-1-reader/README.md`
  says a conforming reader "does not need to match the `rendered-*` outputs
  byte-for-byte — different presentations are encouraged". Protocol §I.2
  permits any rendering "provided values resolve to the same display strings".
  The `02-full-multifamily` chat baseline pinned `GPR: n/a`, `EGI: n/a` and
  `Total OpEx: n/a` for a document that states all three. That baseline
  recorded the defect; it did not require it.
- **View models.** Protocol §IV defines the mechanism: a `FieldViewHint.path`
  is resolved by `parser.deepGet` and formatted by `kind`. §IV.2 assigns the
  registry's contents to `protocol.ts` and does not enumerate paths. Pointing
  a hint at the §4.5 location uses the existing mechanism unchanged.

## Read-path inventory and classification

### `packages/uwmd-core/src/renderer.ts`

Only the chat renderer's NOI block reads `noi_model` fields. `renderCsv` and
`renderSummary` fetch the block into an unused `_noi`.

| Line read before | Classification | Now reads |
|---|---|---|
| `gross_potential_rent ?? scheduled_gross_revenue` (top level) | implementation defect | `income.gross_potential_rent` → `.value` |
| `vacancy_loss` (top level) | implementation defect | `income.vacancy_credit_loss` → `.value` |
| `vacancy_rate` (top level) | implementation defect | `income.vacancy_credit_loss.rate_applied` |
| `other_income` (top level) | implementation defect | `income.other_income` → `.value` |
| `effective_gross_income` (top level) | implementation defect | `income.effective_gross_income` |
| `total_operating_expenses` (top level) | implementation defect | `expenses.total_operating_expenses` |
| `net_operating_income` | correct | unchanged |
| `opex_ratio`, else top-level opex ÷ EGI | implementation defect | `expenses.expense_ratio`, else the unchanged legacy expression |

A `{ value }` object yields its number. A bare number stated at the same §4.5
path is read as stated. That tolerates the example drift below without hiding
it, and matches `report.ts`'s existing `num()`.

**Compatibility fallback.** Each line keeps the old top-level keys, in their
old order, as an explicitly named legacy fallback (`noiLegacyValue`). It is
consulted only when the §4.5 path states nothing, so it cannot override a §4.5
value. Legacy values reach the formatter exactly as before. The ratio line's
division still reads only the legacy top-level totals. A document that states
§4.5 totals but no `expense_ratio` therefore renders `OpEx Ratio: n/a`, as
before. The renderer derives no new figure.

### `packages/uwmd-core/src/protocol.ts` — `BUILTIN_VIEW_MODELS.noi_model`

| Hint | Path before | Classification | Path now |
|---|---|---|---|
| NOI | `net_operating_income` | correct | unchanged |
| EGI | `effective_gross_income` | implementation defect | `income.effective_gross_income` |
| OpEx | `total_operating_expenses` | implementation defect | `expenses.total_operating_expenses` |
| OpEx Ratio | `opex_ratio` | implementation defect | `expenses.expense_ratio` |
| GPR | `gross_potential_rent` | implementation defect | `income.gross_potential_rent.value` |
| Vacancy Loss | `vacancy_loss` | implementation defect | `income.vacancy_credit_loss.value` |
| Vacancy Rate | `vacancy_rate` | implementation defect | `income.vacancy_credit_loss.rate_applied` |
| Other Income | `other_income` | implementation defect | `income.other_income.value` |

Labels, kinds and order are unchanged. A hint on the money object itself would
format as `n/a` (`formatCurrency` of an object), which is why the money hints
read `.value`. `FieldViewHint` holds a single path, so the view model has no
compatibility fallback; adding one would change a public Protocol type. No tool
in this repository consumes `BUILTIN_VIEW_MODELS`; it is public API only.

## Worked-example inventory (not changed here)

Before this repair, no worked example stated any of the top-level keys the old
chat block and view model read. Every NOI line except `NOI` rendered `n/a` for
every example. After it, the chat NOI block renders:

| Example | GPR | Vacancy (rate) | Other | EGI | OpEx | NOI | Ratio |
|---|---|---|---|---|---|---|---|
| Agave-Court (multifamily) | $4,600,000 | $276,000 (n/a) | $234,000 | $4,420,000 | $1,820,000 | $2,600,000 | n/a |
| Parkview / parkview-after-L6 (multifamily) | $655,200 | $45,864 (7.00%) | $21,600 | $630,936 | $234,301 | $396,635 | 0.3713 |
| Riverside (office) | $935,000 | n/a (n/a) | $12,000 | $682,550 | $382,550 | $300,000 | n/a |
| Mill-Ave-Commons (student) | $6,480,000 | $356,400 (n/a) | $42,000 | $6,603,600 | $3,238,144 | $3,365,456 | n/a |
| Sonoran (self-storage) | $1,080,000 | n/a (n/a) | $18,000 | $1,053,000 | $381,000 | $672,000 | n/a |
| Cactus-Crossing (retail) | n/a | $48,900 (n/a) | $18,000 | $2,053,000 | $758,000 | $1,295,000 | n/a |
| Ironwood (industrial) | n/a | $63,450 (n/a) | $9,000 | $2,350,000 | $600,000 | $1,750,000 | n/a |
| Mesa-Gateway (data center module) | n/a | $0 (n/a) | $924,000 | $27,684,000 | $16,484,000 | $11,200,000 | n/a |
| Ocotillo (senior) | n/a | n/a (n/a) | $148,000 | $9,645,600 | $7,338,280 | $2,307,320 | n/a |
| Saguaro (hospitality) | n/a | n/a (n/a) | n/a | $6,900,000 | $4,938,400 | $1,961,600 | n/a |
| Sundance (land) | n/a | n/a (n/a) | n/a | $18,000 | $290,000 | $-272,000 | n/a |
| Roosevelt-Row (mixed use) | n/a | n/a (n/a) | n/a | n/a | n/a | $2,572,000 | n/a |

The remaining `n/a` cells trace to example shapes, classified below. Every
cell is a stated figure or `n/a`; none is derived.

| Finding | Examples | Classification |
|---|---|---|
| Multifamily `noi_model` matches §4.5 | Parkview, parkview-after-L6, Agave-Court | conforming (Agave omits optional `rate_applied` and `expense_ratio`) |
| A §4.5-named line stated as a bare number where §4.5 states an object (`vacancy_credit_loss`, `other_income`, and expense lines such as `insurance`, `utilities`, `repairs_maintenance`) | every non-multifamily example except Roosevelt-Row | worked-example drift |
| `noi_per_sf` where §4.5 names `noi_per_sqft` | Riverside, Cactus-Crossing, Ironwood, Mesa-Gateway | worked-example drift |
| A §4.5 line under another name: `vacancy_loss`, `economic_vacancy_loss` (§4.5 `vacancy_credit_loss`); `property_taxes` (`real_estate_taxes`); `management_fee` (`management_fees`); `general_admin` (`administrative`) | all non-multifamily classes | ambiguous: drift or class vocabulary (owner decision 1) |
| Class-specific lines with no §4.5 counterpart: `base_rent`, `expense_reimbursements`, `percentage_rent`, `rooms_revenue`, `care_revenue`, `gross_potential_revenue`, `grazing_lease`, and others | retail, industrial, data center, hospitality, senior, land, student, storage | ambiguous (owner decision 1) |
| Top-level `expense_ratio` where §4.5 states `expenses.expense_ratio` | Mill-Ave, Sonoran, Ocotillo, Saguaro | ambiguous (owner decision 2) |
| `noi_model` states only `net_operating_income`; component detail lives in `components` | Roosevelt-Row | legitimate alternate contract (§4.23: property NOI foots from components, CC-12) |

Several packs read class-specific `noi_model` paths:
`packs/hospitality.ts:108` (`income.rooms_revenue`) and `:123`
(`gross_operating_profit`), `packs/senior-housing.ts:117`
(`total_labor_expense`) and `:124` (`income.care_revenue`), and
`packs/retail.ts:101` / `packs/industrial.ts:101`
(`income.expense_reimbursements`). This is implementation precedent, not
normative text; no spec or RFC names these fields. No example was edited here.
Rewriting them before the owner decisions below would choose a side.

## Adjacent defect not fixed here

`validator.ts:288-311` reads top-level `vacancy_rate`, `effective_gross_income`
and `total_operating_expenses` from `noi_model`. So `FV_VACANCY_BELOW_MIN`,
`FV_VACANCY_ABOVE_MAX`, `FV_OPEX_BELOW_MIN` and `FV_OPEX_ABOVE_MAX` never
evaluate on a §4.5-shaped document. It is the same defect class, but fixing it
changes validation verdicts and the frozen `*.validation.json` baselines, which
is a different surface from this read-only repair. It is recommended as a
separate change with its own baseline review.

## Owner decisions remaining

1. **Non-multifamily `noi_model` vocabulary.** The §4.5 template is
   multifamily-shaped. Part IV does not say whether another class may add
   income or expense lines that §4.5 does not name, whether such lines take
   §4.5's `{ value }` form, or whether `property_taxes` / `management_fee` /
   `vacancy_loss` are acceptable for `real_estate_taxes` / `management_fees` /
   `vacancy_credit_loss`. The examples and four packs assume the class
   vocabulary. Resolving this decides whether those examples are drift to
   repair or a contract the spec should state, and the latter is an RFC.
2. **Where `expense_ratio` lives.** §4.5 states `expenses.expense_ratio`. The
   Protocol §V.8 asset-class default tables (`defaults.ts`) key it at the
   section top level, as `noi_model.expense_ratio` in eight class tables
   (first at line 53). All 34 of that file's `noi_model` keys are top-level. So do the
   `BUILTIN_INCOMPLETE_DATA_POLICIES` entry (`protocol.ts:525`), the §4.22 gaps
   example (`UW_FORMAT_SPEC_v1.md:2807`) and the `section-gaps.schema.json`
   `examples` entry. The tier-1 `04-scope-only` fixture states a defaulted
   top-level `expense_ratio`. The spec example and the schema `examples` entry
   are illustrative, not constraints, so this is not a contradiction among
   normative surfaces. But the published default table addresses a path §4.5
   does not define. This repair reads only §4.5's `expenses.expense_ratio`, so
   a defaulted top-level ratio renders `n/a`, exactly as before.
3. **View-model compatibility.** `BUILTIN_VIEW_MODELS.noi_model` now resolves
   §4.5 objects only. A document stating a bare number at a §4.5 object path
   (for example retail's bare `vacancy_credit_loss`) resolves to nothing at
   `.value`. Accepting both encodings would need either example repair or a
   `FieldViewHint` alternate-path field, which is a Protocol type change.

## Unrelated observation

`formatCurrency` renders a negative amount as `$-272,000`, and the existing
`05-land-stage-overlay` baseline already pins `$-120,000`. The Protocol states
no negative-currency convention. It is untouched here.

## Changes in this repair

- `packages/uwmd-core/src/renderer.ts`: the chat NOI block reads §4.5 paths,
  with the explicit legacy fallback described above.
- `packages/uwmd-core/src/protocol.ts`: `BUILTIN_VIEW_MODELS.noi_model` hints
  point at §4.5 paths.
- `conformance/tier-1-reader/expected/02-full-multifamily.rendered-chat.txt`:
  regenerated. Six NOI lines change from `n/a` to the fixture's stated
  figures. The other 135 lines are byte-identical, and every other tier-1
  baseline is unchanged.
- Tests in `renderer.test.ts` and `protocol.test.ts`, below.

### Tests

- The chat NOI block renders exact lines for a §4.5-shaped model and for the
  tier-1 `02-full-multifamily` fixture. Structured money lines never render
  `[object Object]` or `n/a`. An unstated `expense_ratio` renders `n/a`, so no
  ratio is derived. A bare number at a §4.5 object path is read as stated.
- The legacy fallback is pinned separately. A legacy-only document renders the
  pre-repair bytes, `scheduled_gross_revenue` stays the last GPR key, and a §4.5
  value wins over a conflicting legacy key on every line.
- The view-model hints are parsed against the §4.5 JSON template in the spec,
  pinned to their §4.5 paths, and must resolve and format on the tier-1
  fixture.

Against the pre-repair source, the nine §4.5 tests fail. The two legacy-only
tests pass, which shows the fallback reproduces the old output exactly.

## Verification

Node 22.22.0 / npm 10.9.4 (CI pins Node 20 and 22), on `main` `182176c`.

| Gate | Result |
|---|---|
| `npm run build`, `typecheck:tests`, `lint` | pass |
| `npm test` | core 2166 (2153 + 13 new), excel 121, cli 92, signing 80, lake 64, data-center 26, hospitality 15, batch 6, report 3: all pass |
| `npm run conformance` | 652 / 652. Before regeneration the only failure was `tier-1/02-full-multifamily [render-chat]` |
| `python3 conformance/runner/runner.py --no-skip` | 78 / 78 |
| `node scripts/gen-conformance-cases.mjs --check` | 78 case files current |
| `conformance:profiles`, `validate-schemas` | 3 / 3; 46 / 46 |
| `verify-indexes`, `verify-codes` (221), `verify-versions`, `verify-packages`, `verify-lockfile`, `verify-release` | pass |
| `docs:build`, `release:check` | pass |
