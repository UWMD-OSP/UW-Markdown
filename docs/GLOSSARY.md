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
Every block in a `.uwx.md` record may carry a `_meta` object recording
who wrote it, with what confidence, and whether human review is
required. See [`UW_FORMAT_SPEC.md` §V](../spec/UW_FORMAT_SPEC.md).
Validation surfaces issues in the `META_*` family (protocol §III.6a).

### Append-only / supersede
The `.uwx.md` update model. A block is never edited in place; a
*superseding* block is appended to the section, and the original is
marked `_meta.lifecycle.superseded: true`. The
[parser](../packages/uwmd-verify/src/parser.ts) selects current sections while
retaining superseded blocks. See protocol §V and Format §2.7.

### Calc engine / safe expression
The sandboxed expression evaluator at
[`packages/uwmd-verify/src/calc/`](../packages/uwmd-verify/src/calc/).
Parses a constrained language (EBNF in protocol §VIII.1), evaluates
without globals or I/O, and is bounded at 4096 input characters.

### Calc pack
A declarative bundle of named formulas + asset-class-specific defaults
that the starter calc engine evaluates against a deal; each pack mirrors the
normative metric dictionary (`spec/metrics/`). The canonical
`MULTIFAMILY_PACK` lives at
[`packages/uwmd-verify/src/builtin-packs/multifamily.ts`](../packages/uwmd-verify/src/builtin-packs/multifamily.ts).

### Conformance tier
One of two self-certification levels, Reader and Verifier (a Verifier
includes Reader), plus optional profiles (Module, Integrity, Representations,
Portfolio, Sensitivity, Stochastic, Pro-forma and Document facts).
Defined in protocol §II; individual bindings may support a smaller scope.
The four Protocol 2.x tiers (Reader, Editor, Calc Host, Agent Host) are
retired; editing and agent hosting are starter-product claims (RFC 0078).

### Edit policy
Declarative gate on which sections / fields an editor is
allowed to modify, and via which operation type. Registered in
`BUILTIN_EDIT_POLICIES` in
[`packages/uwmd-verify/src/protocol.ts`](../packages/uwmd-verify/src/protocol.ts).
See protocol §V.

### Fence annotation
The `uw:section=<id>` marker on a fenced JSON block that ties the
block to a registered section. Without it the parser treats the
fence as opaque markdown.

### Quick metrics
Denormalized financial summaries (purchase_price, dscr, ltv, etc.)
in frontmatter, mirrored from the canonical sections. Exists for
fast pipeline routing without full parse. See format spec §III.

### Section
A registered block in a `.uwx.md` record (e.g. `rent_roll`,
`debt_structure`). Thirty-five are registered (`STANDARD_SECTION_IDS`);
an `x_*` namespace holds extensions. See format spec §II.

### Stress test
A multi-variant section evaluating the deal under perturbed
assumptions (e.g. exit cap shocks). See format spec §IV. Stress
tables and the optional sensitivity profile have their own stated-input and
comparison contracts (see [RFC 0007](rfcs/0007-sensitivity-tables.md)).

### UW Lite (`.uw.md`)
The human-readable **summary** representation: a short Markdown deal
sheet with a fixed grammar of labeled values, meant to be written and
read by people. It compiles deterministically into a `.uwx.md` record
(the `deal-summary-v1` bridge) and a record projects back to Lite with
an explicit report of everything omitted. Lite is not the working
record; it is the on-ramp. See [UW Lite and UWX](UW_LITE_AND_UWX.md)
and [`UW_LITE_SPEC.md`](../spec/UW_LITE_SPEC.md).

### UWX (`.uwx.md`)
The complete, lossless **working record**: Markdown narrative plus
typed JSON sections, provenance, supersede history, and calc results.
Everything in the format spec, the protocol, the calc packs, and the
conformance corpus is stated over UWX. When a page or tool says "a deal
file" without qualification, it means this. See
[UW Lite and UWX](UW_LITE_AND_UWX.md).

### Supersede chain
The retained sequence of section revisions, with current and superseded blocks
identified by `_meta.lifecycle`. Optional integrity fields bind each revision
to the prior block; see [Protocol §V](../spec/UW_PROTOCOL.md#v-edit-semantics).

### Verification receipt
A detached JSON file binding a digest of a deal's canonical
financial content to the outputs a named calc pack produced from
it, so a third party can confirm offline that the numbers follow
from the record. It attests **nothing** about whether the inputs
are true. Verification returns one of three states — `verified`,
`failed`, or `unverifiable` — and never collapses the third into
either of the others. See
[Verification receipts](UW_RECEIPTS.md) and
[the spec](../spec/UW_RECEIPT.md).

### View model
A declarative spec for how a section renders. Registered in
`BUILTIN_VIEW_MODELS` in
[`packages/uwmd-core/src/starter-protocol.ts`](../packages/uwmd-core/src/starter-protocol.ts).
See [starter guide §IV](starter/view-models.md#iv-view-models).

---

## Domain (CRE) terms

### Cap rate
Capitalization rate. The builtin `cap_rate` is the going-in purchase yield:
`noi_model.net_operating_income / valuation.purchase_price`, as defined in the
[metric dictionary](../spec/metrics/README.md). It is stored as a fraction and
usually displayed as a percentage. Underwritten value and exit-cap assumptions
are separate fields; they do not replace this metric's purchase-price basis.

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
Debt Service Coverage Ratio. `dscr = NOI / annual_debt_service`. This
builtin is point-in-time. Financial threshold bands describe the deal separately
from record validity;
deals with IO-burnoff structures should add a stress test for the
amortizing period.

### IRR
Internal Rate of Return. The discount rate at which a stream of cash
flows nets to zero. Computed by `irr()` in
[`packages/uwmd-verify/src/calc/builtins.ts`](../packages/uwmd-verify/src/calc/builtins.ts).

### Loss-to-lease
The gap between in-place rents and current market rents on the same
units. Captured in the `rent_roll` section.

### LTV
Loan-to-Value. The builtin uses the selected loan's explicit `ltv_basis`:
purchase price, underwritten value or total project cost selects its named
denominator. An absent/unknown basis or missing denominator is unavailable;
there is no fallback. See the [dictionary](../spec/metrics/README.md) and
RFC 0092; native capital-stack `ltv_through` has its separate underwritten-value basis.

### NOI
Net Operating Income. Effective gross income minus operating expenses,
before debt service and capex. The record states it in `noi_model`; deterministic
producer code performs the computation.

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
| Conformance tiers | [protocol §II](../spec/UW_PROTOCOL.md) |
| Cross-section codes (`CC-NN`) | [format §VI](../spec/UW_FORMAT_SPEC.md), [protocol §III.6a](../spec/UW_PROTOCOL.md) |
| Edit operations | [protocol §V](../spec/UW_PROTOCOL.md) |
| Calc grammar (EBNF) | [protocol §VIII.1](../spec/UW_PROTOCOL.md) |
| Calc builtins | [protocol §VIII.3](../spec/UW_PROTOCOL.md) |
| Module manifest | [protocol §X](../spec/UW_PROTOCOL.md) |
| Frontmatter shape | [format §2.2](../spec/UW_FORMAT_SPEC.md#22-frontmatter-schema) |
| `_meta` / provenance | [format §V](../spec/UW_FORMAT_SPEC.md) |
| Supersede semantics | [format §VII](../spec/UW_FORMAT_SPEC.md) |
