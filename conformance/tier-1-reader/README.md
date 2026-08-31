# Tier-1 Reader conformance

Tier-1 Readers parse `.uw.md` files and present their contents read-only.
They MUST:

- Parse all required frontmatter fields and surface them as structured data.
- Recognize all 21 standard sections defined in `UW_FORMAT_SPEC_v1.md` §4.
- Apply the display conventions in `UW_PROTOCOL_v1.md` Part III to render
  numbers, percents, ratios, and dates uniformly.
- Surface validation issues with the remediation copy from
  `BUILTIN_REMEDIATIONS` (Part III §3.6).
- Honor the `superseded` semantics: when multiple blocks share a `section_id`,
  display the most recent non-superseded block as canonical.

## Fixtures

| Fixture | Covers |
|---|---|
| `fixtures/01-minimal-screening.uw.md` | Single-section minimal file at the screening stage |
| `fixtures/02-full-multifamily.uw.md`  | Full multifamily deal across all 21 standard sections |
| `fixtures/04-scope-only.uw.md` | Back-of-napkin scope-stage file with provisional blocks + populated `gaps` section |

### Malformed fixtures

Each malformed fixture has a sibling `<id>.expected.json` declaring
the validator / integrity / policy codes the runner expects. Some
POL-* fixtures also have an optional `<id>.policies.json` sibling
containing custom `EditPolicy[]` entries (`verifyProvenance` is
default-passthrough for built-in actor sources, so non-trivial POL-*
coverage requires fixture-bound policies).

| Fixture | Expected code | Surface |
|---|---|---|
| `malformed/01-missing-section-meta` | `META_MISSING_REQUIRED_FIELD` | Validator |
| `malformed/02-low-confidence-no-review` | `META_LOW_CONFIDENCE_NO_REVIEW_FLAG` | Validator (info) |
| `malformed/03-sources-uses-mismatch` | `CC-04` | Validator (cross-section) |
| `malformed/04-broken-chain` | `INT-01` | `verifyChain` (parent_hash mismatch) |
| `malformed/06-wrong-actor` | `POL-01` | `verifyProvenance` + custom policy |
| `malformed/07-replace-where-supersede-required` | `POL-02` | `verifyProvenance` |
| `malformed/08-provisional-without-gap` | `DQ-01` | Validator (data quality) |
| `malformed/09-partial-without-overrides` | `DQ-03` | Validator (data quality) |
| `malformed/10-property-section-missing` | `CC-14`, `DQ-06` | Validator (RFC 0028: missing property warns; declared-stage section gaps report at info) |

## Expected outputs

For each fixture `<id>.uw.md`, the corresponding `expected/` directory contains:

- `<id>.parsed.json` — the result of `cli parse --json` (the canonical JSON
  shape of `ParsedUWFile`).
- `<id>.validation.json` — the frozen validation verdict: `overall_status`
  plus every distinct `(code, severity)` pair from `validateUWFile`, sorted.
  Valid fixtures previously asserted nothing about validation, so escalating
  a rule from warning to error could flip `uwmd validate` to exit 1 on a
  fixture while the suite stayed green (the gap RFC 0027 Appendix A
  documented). Both a new code and a severity flip are now visible diffs.
- `<id>.rendered-summary.md` — output of `cli render --format summary`.
- `<id>.rendered-chat.txt` — output of `cli render --format chat`.

A conforming Tier-1 Reader does not need to match the `rendered-*` outputs
byte-for-byte — different presentations are encouraged.

Its parse output MUST contain the **parse conformance projection** recorded in
`<id>.parsed.json`, and MAY contain more. The projection is specified in
protocol II.6a.6; it is deliberately smaller than any implementation's
in-memory model.

This file used to require the parse output to "canonicalize to the same
`<id>.parsed.json`", which made `@uwmd/core`'s `ParsedUWFile` type a protocol
surface by accident: `annotation`, `lineStart`/`lineEnd`, and optional `_meta`
fields serialized as explicit `null` are artifacts of one reader, and II.1
requires a reader to surface structured data without prescribing a shape. RFC
0030 replaced the requirement with a specified projection. A conformance
requirement stated only in a README, and stronger than the specification, was
the defect.

## Running

```bash
node scripts/run-conformance.mjs --tier=1
```

The reference runner compares a canonical projection of the parse output
(`{ frontmatter, sections, pipelineLog, customCalculations, customScenarios, extensions }`)
after stripping volatile fields (`last_modified`, `_meta.timestamp`).
