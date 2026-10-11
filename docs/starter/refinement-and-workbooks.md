# Starter products: Refinement and workbook bindings

> **Non-normative starter-product guidance (RFC 0078). Not part of the standard.**
>
> This page moved verbatim from [UW Protocol](../../spec/UW_PROTOCOL.md)
> §VIII.2b and §VIII.2c
> under [RFC 0078](../rfcs/0078-protocol-is-verification.md) (D4 and D6). Section
> numbers and headings are kept so existing references still find the text;
> relative links were re-based to this directory and nothing else changed.
> The requirement keywords below (MUST, SHOULD, MAY) describe how the
> reference starter products behave and what a tool must do to stay
> compatible with them. They are not conformance requirements of the
> standard, and a conforming Reader or Verifier owes none of them.

### VIII.2b Stated period inputs in refinement (RFC 0042)

Refinement is an optional consumer; no tier requires it. A consumer implementing
this extension MUST resolve period AST dependencies with §VIII.2a and preserve
the complete selector identity. `RankGapsOptions.periodContext` MAY supply
`sectionVariants` and full-path `overrides` under CalcEvaluationContext semantics.
Its overrides apply to period dependencies only. Its `sectionVariants` also select
the block that scalar dependencies are read from (§VIII.2). Validate the
registry/selector before an own-key override; null is explicit, and an override
bypasses document lookup. Unrelated override keys do not alter scalar cascade
resolution.

**Section selection for scalar inputs (RFC 0066).** The scalar cascade holds one
value per path, so each section a selected target reads is read from one block.
That block is the §VIII.2 selection under the role the section's reading targets
declare. A target MUST be excluded from numeric ranking when:

- targets declare different roles for one section; or
- the target's own §VIII.2 selection refuses; or
- the target's own selection names a different block.

Report each excluded target in `diagnostics.section_inputs`, in target order, as
a `SectionRefinementIssue`. It carries `output_id`, `section`,
`code: CALC-RESOLVE-002` and `message`; see the
[schema](../../spec/schemas/section-refinement-issue.schema.json). Include the member
whenever a selected target reads a variant-map section or a section named by an
explicit variant, and leave it empty when nothing is excluded; omit it
otherwise. Unaffected targets are ranked as before.

Finite numeric period inputs MUST remain fixed during ordinary gap perturbation.
Period dependencies MUST NOT enter the default cascade or acquire inferred ranges,
including from profile, inheritance or market providers. A missing value is not
zero. Scalar resolution, range arithmetic and normalization remain unchanged.

For each selected output and distinct unresolved period dependency, return a
`PeriodRefinementIssue` with `output_id`, canonical `field_path`, `code`, and
human-readable `message`. Null/absent/kind-mismatched or blocked values use
`REFINE-PERIOD-MISSING`; strings, booleans, objects, arrays and nonfinite numbers
use `REFINE-PERIOD-NONNUMERIC`. Resolver failures retain `CALC-PERIOD-001`,
`CALC-PERIOD-002` or `CALC-PERIOD-003`. Do not suppress unexpected internal errors.
The type, [schema](../../spec/schemas/period-refinement-issue.schema.json), and these codes
describe the same contract; message wording is not stable machine data.

Expose these issues as `diagnostics.period_inputs`, in target order and first
reference occurrence order, including when there are no rankable ordinary gaps.
Omit the member when selected formulas contain no period references; otherwise
include an array, empty on successful resolution. Exclude affected outputs from
numeric ranking while preserving unaffected outputs. An empty ranking with
issues MUST NOT be represented as proof of complete inputs. The historical
`diagnostics.resolved` count remains the number of distinct dependency entries
processed, not the number of finite values.

A period leaf is supported by the numeric interpreter; other unsupported AST
operations retain their existing diagnostics and behavior. This extension does
not improve the existing perturbation approximation, define period defaults or
stochastic VOI, or change evaluateCalc's quantization boundary.

### VIII.2c Contextual workbook bindings (RFC 0043)

The optional numeric workbook consumer binds a canonical period reference to a
`PeriodExcelBinding`. A `series` binding names aligned key/value ranges and a
whole-series validity cell; an `override` binding names an explicit override
input. A normal namedRanges entry alone is insufficient. Hosts MUST validate
the reference registry and selector before emission, including overrides.
Names MUST be workbook-scoped identifiers rather than cell addresses, formulas,
or external links. The binding is a trusted host assertion about this workbook;
the string emitter cannot inspect or authenticate workbook contents.

Series bindings MUST use canonical identities and exact lookup, independent of
row order. Before lookup, the validity cell MUST reject duplicate, blank or
changed identities across the complete bound series. This stage exports a closed
identity set: editing values and reordering rows is supported; adding/removing
periods requires editing the source document and re-exporting. A protected or
hidden registry is not a security boundary; deliberate workbook tampering is
outside this edit contract. Blank source series are valid empty sets.

`resolvePeriodColumn` returns a `PeriodColumnSnapshot` using §VIII.2a role selection
and full-series validation, projecting one literal leaf without rounding values.
Missing sections yield an empty set. Generic/explicit variants are preserved;
malformed/duplicate/unresolvable source series raise the existing CALC-PERIOD
errors. Safe traversal and literal key rules remain unchanged.

Missing periods and blank values MUST yield #N/A in Excel. Invalid identity sets
and nonnumeric inputs MUST yield #VALUE!, never coerced zero. Finite numeric zero
is valid. Explicit own-key overrides bypass source lookup after reference
validation, including null-as-missing, under §VIII.2a semantics. Numeric expression
results MUST be rounded once at the existing §VIII.5 boundary.

The reference converter exports only explicitly requested custom-calculation IDs
through `toWorkbook(parsed, { calculations, calculationContext })`. The context
selects variants for period inputs and supplies exact full-path overrides. It
does not alter existing pack sheets. The first custom exporter supports numeric
literals, paths, period paths, unary minus and arithmetic +, -, *, /; other AST
nodes explicitly refuse. Ordinary input snapshots use calc resolution without
default inference or boundary rounding. Under §VIII.2 that includes variant
selection: an ordinary input whose section refuses raises `CALC-RESOLVE-002`,
as an unresolvable period selection raises `CALC-PERIOD-003`. Shared inputs are written once and
referenced by formulas. No general calc-result chaining is implied.

**Pack sheets over variant-map sections (RFC 0066).** The converter reads each of
a pack's named inputs from the block §VIII.2 selects under the role the pack's
calculations declare for that section.

- **Disagreeing roles.** Calculations declaring different roles for one section
  refuse the export.
- **Refused input.** An input whose section refuses MUST be written as `#VALUE!`,
  the invalid-identity value above, and never blank, because Excel reads a blank
  as zero.
- **Refused metric.** A metric whose own §VIII.2 selection refuses MUST show
  `#VALUE!` exactly where the calc engine reports `ok: false`. Every other metric
  keeps exact parity.
- **Different block.** A metric whose own selection names a different block than
  the one its named input holds refuses the export. One input cannot stand for
  two blocks.

Default toWorkbook output is otherwise unchanged. Additional period/custom input edits are
export-only in this stage: reverse import MUST refuse marked extended workbooks,
rather than silently discarding those edits. Excel 2016-compatible functions
(IF, INDEX/MATCH exact, COUNTIF, SUMPRODUCT/EXACT, ISBLANK, ISNUMBER, VALUE, NA,
ROUND) implement the reference bindings. Native recalculation tests are required
to establish supported-case parity; formula snapshots alone are insufficient.
