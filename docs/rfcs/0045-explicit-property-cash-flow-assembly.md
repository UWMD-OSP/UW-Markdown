---
rfc: 0045
title: Assemble explicitly covered property cash flows
status: draft
author: codex
created: 2026-09-12
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0045: Explicit property cash-flow assembly

## Summary

Propose a candidate-only assembler that combines the RFC 0044 lease-up stream
with explicitly stated acquisition, operating, capital, reserve and disposition
cash flows. Its first scope is one property, one declared currency, unlevered
and pre-tax. Coverage declarations expose omissions and overlapping inputs;
existing RFC 0034 procedures remain responsible for dated metrics.

**Draft for owner review; no new API or normative behavior is implemented.**
Core/CLI 2.8.0 and Protocol 2.11.0 remain the released contract. This proposal
defines assembly of stated economics, not a lease forecast or an exit-value
calculator. Acceptance must resolve the review decisions below before coding.

## Motivation

RFC 0044 copies `rent_revenue + concessions + ti_lc_capex` as verified stated
`net_cash_flow`. It does not supply other income, operating expenses, nonleasing
capital, reserves, purchase price or sale proceeds. Discounting that partial
stream does not produce a full-property valuation or equity return.

The existing `deriveDCF` in `packages/uwmd-core/src/dcf.ts` intentionally checks
only identities over stored fields. It does not infer cash dates, capitalize
trailing NOI into an exit price or compute returns from annual row positions.
Format §4.9 has inputs for a DCF; §4.26 and Protocol VIII.9 have dated metrics.
The missing connection is a declared economic boundary and complete cash ledger.

## Proposed change

### 1. First scope and economic boundary

Add an opt-in Protocol VIII.9 subsection after VIII.9.5. The following MUST rules
are proposed requirements for that future subsection, not current requirements
on documents or hosts.

The plan MUST state `basis: "unlevered"` and `tax_basis: "pre_tax"`. Amounts
represent cash paid or received by a hypothetical owner funding the whole asset
without debt. Property taxes belong in operating expenses; investor income and
capital-gains taxes do not. Debt draws, principal, interest, financing fees,
refinancing proceeds and investor allocations MUST NOT enter this stream.
Existing debt sections may remain in the document; they are not assembly inputs.

The plan MUST identify one currency using an uppercase three-letter
`currency_code`, and MUST carry an explicit same-currency assertion for each
selected source variant. Exact string equality is required. This is an author
assertion of denomination, not validation against a new currency registry.
No display symbol, locale, property location, exchange rate or decimal count
establishes currency identity. No conversion or scaling is performed. A missing
or conflicting assertion refuses. Documentary evidence of currency remains a
host review responsibility; the assembler cannot infer it from bare numbers.

Amounts MUST already be signed cash amounts: receipts positive, payments
negative. The assembler copies values without negation, proration, rescaling,
netting or intermediate rounding. An accrual expense or amortization charge
is not an acceptable substitute for its cash payment.

### 2. Source contract

The proposed additive entry point is
`assemblePropertyCashFlows(parsed, plan): Promise<PropertyCashFlowAssembly>`.
It accepts one parsed document, one exact `lease_up_schedule` variant and one
distinctly selected supplemental `cash_flow_series` variant from that document.
There is no default variant, fallback role, cross-document input or override map.

The lease-up source MUST pass `projectLeaseUpCashFlows` under the caller's
complete explicit cash-date plan. Preserve its failed/unverifiable distinctions
and nested evidence. The assembler MUST invoke the adapter against the supplied
document rather than trust a previously serialized projection object.

The supplemental series MUST satisfy the existing §4.26 structural rules,
including finite amounts and real, nondecreasing dates. Its explicitly stated
day count MUST equal the plan's registered day count. If it states metrics,
their existing verifier MUST return `verified`; absent metrics make no claim
about completeness. A successful metric verifier alone is not a structural check.

Every supplemental row MUST be assigned exactly once by zero-based `row_index`
to one coverage cell. Indexes refer to that specific series in the digested
source snapshot. This is an assembly-plan binding, not new expression syntax
or an RFC 0041 date selector: same-date rows remain individually addressable.
Each binding carries its canonical source path, exact variant, date and amount
in the result. Unknown fields, invalid indexes, unused rows and repeated source
row identities refuse. Advisory `kind` labels cannot substitute for coverage.

General `dcf`, NOI and valuation totals are not directly accepted sources in
this first adapter. The author must state separately covered cash rows in the
supplemental series, with provenance. In particular, never append NOI or a
levered/net terminal total to the lease-up bundle as another income component.

### 3. Coverage ledger

A coverage cell is the exact pair `(slot, category)`. `slot` is either an
absolute source period, `acquisition` or `disposition`. Required cells are:

| Slot | Required categories | Ownership |
|---|---|---|
| Every lease-up period | `rent`, `concessions`, `ti_lc` | Automatically owned together by that period's RFC 0044 row. |
| Every lease-up period | `other_income`, `operating_expenses`, `other_capex`, `reserve_net` | Supplemental rows or explicit zero declaration. |
| `acquisition` | `purchase_price`, `transaction_costs`, `reserve_net` | Supplemental rows or explicit zero declaration, subject to the purchase rule below. |
| `disposition` | `gross_sale`, `transaction_costs`, `reserve_net` | Supplemental rows or explicit zero declaration. |

For each cell not owned by lease-up, the plan MUST provide exactly one of:

- `rows`: a nonempty list of distinct supplemental row indexes; or
- `zero`: a nonempty author explanation that no cash flow applies to that cell.

A cell may contain multiple cash rows at different dates. A row cannot cover
multiple cells. Duplicate cell declarations, a row and zero declaration for the
same cell, unknown categories, missing cells or attempts to bind lease-up-owned
cells refuse. A numeric zero source row remains a real row; null or omission is
never zero. A zero declaration produces coverage evidence, not a synthetic row.

The purchase cell MUST contain at least one negative payment and MUST NOT be
declared zero. All purchase rows MUST be negative. `gross_sale` and
`other_income` rows MUST be nonnegative; `transaction_costs`,
`operating_expenses` and `other_capex` rows MUST be nonpositive. Refunds are
stated separately as `other_income`, with their category explained in provenance.
`reserve_net` may have either sign. The existing lease-up verifier governs the
mixed signed bundle; no new component-sign rule is retrofitted onto RFC 0044.

`other_income` MUST exclude rent and concessions. `other_capex` MUST exclude
TI/LC. `gross_sale` MUST exclude costs of sale, debt payoffs and separately
returned reserves. Transaction costs MUST be separately stated cash payments,
not recomputed from a percentage. Vacancy already reflected in stated rent is
not a second expense. None of these exclusions is inferred from row labels.

### 4. Reserve treatment and limits of double-count checks

The proposed reserve boundary is cash available to the hypothetical owner:
funding a restricted reserve is an outflow, and releasing cash to that owner is
an inflow. `reserve_net` contains those external transfers. Spending *inside*
the funded reserve is not another owner outflow. If reserve-funded work is also
included in lease-up TI/LC or a supplemental expense/capital row, the plan MUST
be refused; this first scope cannot split or adjust the lease-up bundle.

The plan MUST explicitly assert that reserve-funded spending is excluded from
all other selected cash amounts, and that gross sale excludes separately returned
reserves. It MUST also state that no restricted reserve remains after disposition.
If the author cannot make those assertions, assembly is unsupported; do not
assume a zero balance or estimate a release. Even when reserves do not apply,
the corresponding coverage cells need explicit zero explanations.

Structural checks catch duplicate identities and declared coverage overlaps.
They cannot prove that differently named rows do not contain the same economic
payment, or that an authored zero is true. The result MUST distinguish
`coverage: "declared_complete"` from financial verification. Source digests and
author assertions are audit evidence, not proof of economic completeness.

### 5. Dates, valuation anchor and terminal proceeds

The lease-up source supplies the complete, gap-free monthly or quarterly period
set. The plan MUST state an acquisition date inside the first source period and
a disposition date inside the last source period, with acquisition strictly
before disposition. The first implementation covers that full hold only.
Partial periods require explicitly authored cash amounts; no proration occurs.

All cash dates MUST lie within that closed acquisition/disposition interval.
Acquisition-slot rows MUST occur on the acquisition date, and disposition-slot
rows MUST occur on the disposition date. Period-slot rows retain explicitly
stated cash dates, which may differ from the period of accrual. The author MUST
assert that the stated amounts cover only the declared hold and include any
settlement of receivables/payables at exit. A cash lag beyond disposition refuses;
extending the post-sale settlement horizon requires a later contract.

Sort output by date, breaking ties by lease-up source order first, then
supplemental row index. Preserve every row separately and copy amounts exactly.
The required purchase payment makes acquisition the first actual cash date.
No synthetic zero is inserted to move the RFC 0034 anchor.

`gross_sale` is a stated cash receipt. The assembler MUST NOT derive it from
trailing or forward NOI, a cap rate or the existing `deriveDCF` helper. Net exit
cash emerges only from the separately stated rows; no extra net-proceeds row
may be appended. A zero exit recovery needs its own explicit zero explanation.

### 6. Candidate result and metric interpretation

Proposed new public types are `PropertyCashFlowPlan`,
`PropertyCashFlowAssembly` and `PropertyCashFlowAssemblyIssue`, exported with
the function from core and browser. Result fields MUST include:

- Whole-source semantic envelope digest using the existing digest contract.
- The explicit basis, tax basis, currency, acquisition/disposition dates and
  day count; a copy of the plan's economic assertions and zero explanations.
- A `CashFlowSeries`, labelled `Unlevered pre-tax property cash flow`, without
  `stated_metrics`; source bindings in output-row order and each cell's ownership.
- `coverage: "declared_complete"` and separate source verification evidence.

The wrapper carries economic meaning; the unchanged §4.26 series alone does not
encode currency or basis. Consumers MUST retain the wrapper when displaying or
comparing results. This RFC does not define persistence of that wrapper in a
standard section, a signature profile, or a way to label it equity cash flow.

Callers may evaluate existing metrics over the candidate using explicit
declarations. With acquisition included, `xnpv` is net present value of the
stated investment stream at acquisition, **not an appraisal value**. A discount
rate remains caller-supplied. Existing `xirr` bracket/convergence refusals and
boundary quantization remain unchanged. No IRR, growth, tax, amortization or
terminal-value formula is added. Same-day rows retain RFC 0041 selector ambiguity.

The operation MUST NOT write files, alter source blocks or `_meta`, accept
changed source values as overrides, or emit partial successful output on refusal.
Implementations MUST take a coherent source snapshot before asynchronous hashing.

### 7. Refusals

Propose `PropertyCashFlowAssemblyError extends CalcError` with a structured
`CALC-CF-ASSEMBLY` issue. Distinct reasons MUST identify plan shape, source
selection, source structure, source verification, coverage, basis/currency,
amount/sign or date/horizon failures. Include plan/source pointers and preserve
existing nested lease-up and cash-flow diagnostics. Exact reason enum, schema
and error registration must be pinned together in the accepted implementation
contract; implementers must not invent different wire shapes independently.

### Review example (mapping only)

The released synthetic workflow in `docs/examples/lease-up-dated-cash-flow.json`
supplies `base` periods `2026-Q3` and `2026-Q4`. RFC 0044 copies `118475` on
`2026-09-30` and `123425` on `2026-12-31`. Each row owns its period's three
lease-up cells. Those authored amounts are unchanged by this proposal.

For a proposed acquisition on `2026-07-01` and disposition on `2026-12-31`, the
author still owes supplemental purchase/exit rows and every remaining cell's
rows or zero declaration. The existing example supplies none of that evidence
and therefore **cannot pass assembly**. Adding an NOI row over those same rent
periods is not a remedy. No fabricated prices, expenses, reserve balances or
calculated return are presented as an adopter fixture.

## Compatibility analysis

Existing Lite/UWX files and Format §4.9/§4.26 data remain valid. Tier-1 readers,
Tier-2 editors, Tier-3 calc hosts and Tier-4 agent hosts retain their existing
requirements; this opt-in helper does not make full DCF assembly mandatory at
any stage. Module manifests, packs, expression grammar and validation meaning
are unchanged. No dependencies are proposed.

Implementation requires an additive protocol minor with types, prose and
plan/result/issue schemas in one commit. Format and package versions follow
their own surfaces at release; this draft changes none of them. Existing generic
cash-flow APIs remain available with their current, less restrictive contract.

## Conformance impact

This draft changes no existing fixture or baseline. Implementation should add
a named `property-cash-flow-assembly` suite with self-contained documents/plans:

| Case | Expected result |
|---|---|
| Complete monthly/quarterly hold, exact variants and declared currency | Candidate with exact copied rows, evidence and acquisition anchor. |
| Nonempty reserves with explicit external transfers; all-zero reserve coverage | Both accepted under their explicit assertions; no invented cash row. |
| Missing/null amount, malformed source, failed vs unverifiable source | Refuse, preserving the actual source diagnosis. |
| Missing/duplicate cells, repeated/unused source row, bundled NOI assigned to lease-up cells | Coverage refusal. |
| False hidden economic content under otherwise legal labels | Not claimed detectable; output must still say declared completeness. |
| Zero vs missing; wrong signs; unknown fields/categories | Accept real zero under allowed categories; refuse the invalid cases. |
| Currency conflict, absent assertions, levered or after-tax plan | Refuse without conversions or basis inference. |
| Reserve-funded TI/LC, unknown terminal reserve, cash after disposal | Unsupported/refused without economic repairs. |
| Gap/partial source horizon, invalid dates, acquisition outside first period | Refuse; never derive dates from row position. |
| Same-day rows and fractional values | Stable order, no netting/rounding; ambiguous date selectors still refuse. |
| Existing dated metric success and xirr refusal | Existing engine results/errors and existing quantization, not a second solver. |
| Source mutation/digest, browser import, CLI success/refusal | Immutable source, coherent digest, identical evidence and typed errors. |

Any protocol-version-only receipt baseline changes must be separately reviewed.
Numerical expectations must be generated and pinned through the existing engine;
no handwritten return claims. A concrete adopter-owned supplemental ledger is
required before this proposal advances to implementation.

## Reference implementation

Follow-up after acceptance: `packages/uwmd-core/src/property-cash-flows.ts` and
sibling tests; shared source validation only where it preserves existing rules.
Reuse `projectLeaseUpCashFlows`, existing date validation, cash-flow verification,
semantic envelope hashing and metric evaluation. Do not change `deriveDCF`.
Export from `index.ts` and `browser.ts`; synchronize protocol/types/schemas.

An eventual `uwmd assemble-property <file> <plan.json> [--json]` command should
be a read-only wrapper over the approved core contract. Its plan must have an
exact schema before CLI work starts. Add independent conformance fixtures and
an end-to-end example with reviewed economic inputs. Run all repository gates,
including test typechecking, schema/index/package checks and docs-site build.
Excel metric formulas, document writes and publishing are separate stages.

## Alternatives considered

- Automatically turn `dcf.annual_cash_flows` into dated amounts: holding-year
  labels do not establish cash dates, economic coverage or terminal proceeds.
- Append NOI and net sale proceeds to RFC 0044: overlaps rent/TI-LC and hides
  expense, debt and reserve coverage inside unrelated totals.
- Start with levered/after-tax economics: needs debt schedules, financing costs,
  tax ownership and allocation rules not supplied by the released adapter.
- Require new generic AST iteration: changes evaluator scope without deciding
  which payments belong in the investment stream.
- Merge same-day rows: loses source identity and changes the established series
  representation without helping completeness review.
- Infer missing categories as zero: produces a plausible return despite absent
  economics; explicit author assertions make the limitation visible.

## Unresolved questions

The owner must accept or revise these concrete first-scope choices: unlevered
pre-tax basis; one declared currency; complete lease-up hold anchored by a real
purchase payment; stated gross exit; external reserve-transfer boundary; and a
supplemental series with exhaustive coverage assertions. Review must supply an
adopter ledger demonstrating those choices, especially reserve-funded work and
sale settlements. The current synthetic partial stream is not that ledger.

Before implementation, pin the exact plan/result/error JSON shapes against that
ledger and approve the normative triad. These are remaining design tasks, not
permission for a builder to fill gaps with defaults. Levered and after-tax
assembly, multi-property/currency flows, reserve-account rollforwards, partial
windows, post-sale settlements, source splitting, speculative leasing, terminal
valuation, persistent coverage evidence and workbook metrics remain deferred.

## Prior art

Repository precedents supply the technical contract:
[RFC 0034](0034-calendar-anchored-cash-flows.md) for dated metrics,
[RFC 0038](0038-return-metric-tax-basis.md) for tax-basis distinctions,
[RFC 0041](0041-period-indexed-addressing.md) for explicit identities, and
[RFC 0044](0044-explicit-lease-up-cash-flow-projection.md) for the bounded
projection and source evidence. No external market convention is adopted by
implication.
