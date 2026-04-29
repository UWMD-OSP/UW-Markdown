# Glossary

Terms used throughout the UW Markdown spec, protocol, and reference
implementation. Domain (CRE) terms are defined here for adopters
without an underwriting background; format-specific terms are defined
here so they have a single canonical reference.

Each entry links to the spec section where the term is normatively
defined, where applicable.

---

## Format-specific terms

### `_meta` / provenance
Every block in a `.uw.md` file may carry a `_meta` object recording
who wrote it, with what confidence, and whether human review is
required. See [`UW_FORMAT_SPEC_v1.md` §V](../spec/UW_FORMAT_SPEC_v1.md).
Validation surfaces issues in the `META_*` family (protocol §III.6a).

### Append-only / supersede
The `.uw.md` update model. A block is never edited in place; a
*superseding* block is appended to the section, and the original is
marked `_meta.superseded: true` with a back-reference. The
[compactor](../packages/uwmd-core/src/compactor.ts) materializes the
"live view" by walking supersede chains. See protocol §V.

### Calc engine / safe expression
The sandboxed expression evaluator at
[`packages/uwmd-core/src/calc/`](../packages/uwmd-core/src/calc/).
Parses a constrained language (EBNF in protocol §VIII.1), evaluates
without globals or I/O, and is bounded at 4096 input characters.

### Calc pack
A declarative bundle of named formulas + asset-class-specific defaults
that a Tier-3 calc host evaluates against a deal. The canonical
`MULTIFAMILY_PACK` lives at
[`packages/uwmd-core/src/packs/multifamily.ts`](../packages/uwmd-core/src/packs/multifamily.ts).

### Conformance tier
One of four self-certification levels: Tier 1 Reader, Tier 2 Editor,
Tier 3 Calc Host, Tier 4 Agent Host. Defined in protocol §II.

### Edit policy
Declarative gate on which sections / fields a Tier-2 editor is
allowed to modify, and via which operation type. Registered in
`BUILTIN_EDIT_POLICIES` in
[`packages/uwmd-core/src/protocol.ts`](../packages/uwmd-core/src/protocol.ts).
See protocol §V.

### Fence annotation
The `uw:section=<id>` marker on a fenced JSON block that ties the
block to a registered section. Without it the parser treats the
fence as opaque markdown.

### Layer (L0–L7)
The Bancroft pipeline stages. L0 ingestion, L1 screening, L2
underwriting, L3 reserved, L4 structuring, L5 compliance, L6 risk,
L7 assembly. Definitions live in `BANCROFT_LAYERS`
([`packages/uwmd-core/src/context.ts`](../packages/uwmd-core/src/context.ts)).
See protocol §IX.

### Pipeline state
The frontmatter object recording each layer's status (`complete`,
`in_progress`, `pending`, `skipped`, `failed`). Drives routing in
multi-stage agent workflows. See format spec §III.

### Quick metrics
Denormalized financial summaries (purchase_price, dscr, ltv, etc.)
in frontmatter, mirrored from the canonical sections. Exists for
fast pipeline routing without full parse. See format spec §III.

### Section
A registered block in a `.uw.md` file (e.g. `rent_roll`,
`debt_structure`). Twenty-one are standard; a 22nd `x_*` namespace
holds extensions. See format spec §II.

### Stress test
A multi-variant section evaluating the deal under perturbed
assumptions (e.g. exit cap shocks). See format spec §IV. Stress
tables are framework-only in v1; richer sensitivity analysis is
queued for v2 (see [RFC 0007](/about/rfcs/0007-sensitivity-tables)).

### Supersede chain
The linked sequence formed when block B carries
`_meta.supersedes: <A.id>`. Cycles are forbidden; the validator
emits a `META_SUPERSEDE_CYCLE` issue when it detects one.

### View model
A declarative spec for how a section renders. Registered in
`BUILTIN_VIEW_MODELS` in
[`packages/uwmd-core/src/protocol.ts`](../packages/uwmd-core/src/protocol.ts).
See protocol §IV.

---

## Domain (CRE) terms

### Cap rate
Capitalization rate. `cap_rate = NOI / value`. Expressed as a
percent. The "going-in" cap rate uses purchase price; the "exit" cap
rate uses projected sale value.

### Cash-on-cash return
Annual pre-tax cash flow divided by total cash equity invested. A
liquidity-oriented return measure; doesn't account for principal
paydown or appreciation.

### Coverage ratio
See **DSCR**. "Coverage" without further qualification typically means
debt service coverage.

### Debt yield
`debt_yield = NOI / loan_amount`. Lender-side stress metric: the
unlevered yield to the lender if they had to take the property back.
Insensitive to interest rates.

### DSCR
Debt Service Coverage Ratio. `dscr = NOI / annual_debt_service`. The
canonical lender constraint. The current builtin is point-in-time;
deals with IO-burnoff structures should add a stress test for the
amortizing period.

### IRR
Internal Rate of Return. The discount rate at which a stream of cash
flows nets to zero. Computed by `irr()` in
[`packages/uwmd-core/src/calc/builtins.ts`](../packages/uwmd-core/src/calc/builtins.ts).

### Loss-to-lease
The gap between in-place rents and current market rents on the same
units. Captured in the `rent_roll` section.

### LTV
Loan-to-Value. `ltv = loan_amount / value`. Cross-checked against
`debt_structure` and `valuation` sections by validator code `CC-02`.

### NOI
Net Operating Income. Effective gross income minus operating expenses,
before debt service and capex. Computed in the `noi_model` section.

### NPV
Net Present Value. Sum of discounted cash flows. `npv()` in the
calc engine builtins.

### PMT / PV / FV / NPER
Time-value-of-money primitives, matching the Excel functions of the
same name. The reference engine uses the **unsigned convention**
(loan payments are positive numbers, not negative); see protocol
§VIII.3 for the contract.

### Stabilized
A property operating at expected long-run occupancy and rent levels.
Distinct from "in-place" (current snapshot) and "as-built" (initial).

### T-12
Trailing twelve months. Refers to the most recent twelve months of
operating data, used as the baseline for underwriting.

### Term sheet
The non-binding loan offer summarizing rate, term, amortization, and
covenants. Maps to the `debt_structure` section.

---

## Where each term is defined normatively

| Term | Spec ref |
|---|---|
| Conformance tiers | [protocol §II](../spec/UW_PROTOCOL_v1.md) |
| Cross-section codes (`CC-NN`) | [format §VI](../spec/UW_FORMAT_SPEC_v1.md), [protocol §III.6a](../spec/UW_PROTOCOL_v1.md) |
| Edit operations | [protocol §V](../spec/UW_PROTOCOL_v1.md) |
| Calc grammar (EBNF) | [protocol §VIII.1](../spec/UW_PROTOCOL_v1.md) |
| Calc builtins | [protocol §VIII.3](../spec/UW_PROTOCOL_v1.md) |
| Bancroft layers | [protocol §IX](../spec/UW_PROTOCOL_v1.md) |
| Module manifest | [protocol §X](../spec/UW_PROTOCOL_v1.md) |
| Frontmatter shape | [format §III](../spec/UW_FORMAT_SPEC_v1.md) |
| `_meta` / provenance | [format §V](../spec/UW_FORMAT_SPEC_v1.md) |
| Supersede semantics | [format §VII](../spec/UW_FORMAT_SPEC_v1.md) |
