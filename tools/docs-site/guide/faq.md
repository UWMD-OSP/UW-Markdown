---
title: "FAQ and troubleshooting"
---

# FAQ and troubleshooting

## Which source file is canonical?

The source UWX/structured record is canonical for complete underwriting data.
Lite `.uw.md` is a readable deal summary and may omit advanced paths during a
projection. Excel and reports are derived deliverables, not a second system of
record.

## Why did validation find a rule code?

Each validation result includes a code, a field where applicable, and canonical
remediation text. Common families are:

| Code family | Meaning | What to do |
|---|---|---|
| `CC-01`–`CC-10` | Two deal surfaces disagree. | Reconcile the named section fields; do not choose a value by intuition. |
| `FV-01`–`FV-14` | A financial input crosses a configured threshold. | Confirm the source and assumption; use an institution threshold override only when authorized. |
| `DQ-01`–`DQ-05` | Provisional, partial, or stale information needs tracking. | Add a precise gap or field override, then resolve it from evidence. |
| `INT-01`–`INT-04` | A supersede hash/provenance chain cannot be verified. | Preserve prior blocks and write a proper superseding block. |
| `POL-01`–`POL-02` | The actor or edit method violates policy. | Use the authorized actor/source and the required supersede operation. |

## A calc command reports an error

| Code | Fix |
|---|---|
| `CALC-PARSE-001` | Check formula punctuation, supported operators, and parentheses. |
| `CALC-RESOLVE-001` | Use a supported builtin or a field path that exists in the record. |
| `CALC-TYPE-001` | Check argument count and types; rates and periods must be numeric. |
| `CALC-DIV-ZERO` | Guard the denominator with a conditional or supply the missing input. |
| `CALC-IRR-DIVERGE` | Check that cash flows contain a meaningful sign change and use realistic inputs. |
| `CALC-LIMIT-001` | Reduce a formula longer than the parser or AST safety limits. |

## Excel export rejects a pack formula

| Code | Fix |
|---|---|
| `EXCEL-EMIT-PATH` | Add a named workbook input for the referenced section path. |
| `EXCEL-EMIT-FN` | Replace `coalesce` or null-aware `avg` with Excel-mappable formula logic. |
| `EXCEL-EMIT-OP` | Use a supported expression operator. |

## Lite parsing or compilation fails

| Code | Fix |
|---|---|
| `LITE_UNCLOSED_FRONTMATTER` | Add the closing `---` delimiter. |
| `LITE_FRONTMATTER_REQUIRED`, `LITE_VERSION_REQUIRED`, `LITE_VERSION_UNSUPPORTED` | Add top-level Lite frontmatter with `uw_lite_version: 1.0`. |
| `LITE_FRONTMATTER_NESTING_UNSUPPORTED`, `LITE_FRONTMATTER_SYNTAX`, `LITE_FRONTMATTER_DUPLICATE` | Use unique top-level `key: value` entries only. |
| `LITE_FIELD_SYNTAX`, `LITE_FIELD_DUPLICATE`, `LITE_VALUE_INVALID` | Repair the anchored field line, its identity, or its display value. |
| `LITE_ATTRIBUTE_SYNTAX`, `LITE_ATTRIBUTE_DUPLICATE` | Use one `key=value` pair for each field attribute. |
| `LITE_CANONICALIZATION_BLOCKED` | Resolve the preceding Lite syntax errors before canonicalizing or issuing a receipt. |
| `LITE_COMPILE_PERIOD_UNSUPPORTED`, `LITE_COMPILE_SCENARIO_UNSUPPORTED`, `LITE_COMPILE_UNIT_MISMATCH` | Keep the field within the bridge profile's supported period, scenario, and unit rules. |
| `LITE_COMPILE_FIELD_UNKNOWN`, `LITE_COMPILE_TARGET_CONFLICT`, `LITE_COMPILE_FRONTMATTER_REQUIRED` | Use a mapped field once, avoid conflicting target values, and supply required bridge identity fields. |

## Source representation cannot be detected

`SOURCE_REPRESENTATION_AMBIGUOUS` means one source contains both Lite markers
and UWX section fences; split the representations rather than guessing. For
`SOURCE_CONTENT_MISMATCH`, ensure a `.uwx.md` file contains structured fences
and a `.uw.md` Lite file contains Lite content. `SOURCE_REPRESENTATION_UNKNOWN`
means neither the content nor extension identifies a supported source.

## Receipt verification says `failed` or `unverifiable`

`failed` means the document digest or recomputed results disagree. Use the exact
deal version that issued the sidecar, then reissue after an authorized edit.
`unverifiable` means the verifier lacks a required pack/version or signature
backend, so it cannot decide. Neither verdict is a pass. A receipt only attests
that stated outputs follow from the unchanged record, not input truth.

The receipt issue codes are specific: `RCP-01` digest mismatch, `RCP-02`
missing or extra result, `RCP-03` recomputation disagreement, `RCP-04` corrupt
results digest, `RCP-05` unknown pack, `RCP-06` pack-version mismatch, `RCP-07`
engine-version disagreement, `RCP-08` unavailable signature backend, and
`RCP-09` uncanonicalizable document. Restore the exact record and compatible
pack first; do not change the receipt to make a verifier pass.

## Why is a workbook edit not reflected in the deal?

Workbooks are exports. The reference converter does not yet import workbook
edits into a UWX record. Apply source-backed edits to the deal via a Tier-2
editor workflow, then regenerate the workbook.

## The command cannot find my file

Use a path relative to the checkout or an absolute path. The CLI reports the
resolved location in its error output. For available representations, run:

```bash
npm run cli -- formats --json
```
