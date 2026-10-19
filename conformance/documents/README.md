# Reader, Verifier and starter fixtures

Parse cases belong to Reader; Format-validation cases, and the `[validate]`
projections of `malformed/06` (`POL-01`) and `malformed/07` (`POL-02`), to
Verifier; integrity checks to Integrity. Render checks, and the mixed
`malformed/06`/`07` cases that pin policy beside edit behavior, are starter
products. Directories describe content;
[corpus-index.json](../corpus-index.json) determines each case’s single owner.

A Reader (Protocol §II.1) MUST:

- Parse all required frontmatter fields and surface them as structured data.
- Recognize all 21 standard sections defined in `UW_FORMAT_SPEC.md` §4.
- Treat unknown frontmatter keys, sections and `x_*` blocks as informative.
- Honor the `superseded` semantics: when multiple blocks share a `section_id`,
  the most recent non-superseded block is canonical.

How a Reader displays values, including the Part III display conventions and
`BUILTIN_REMEDIATIONS` copy, is starter-product guidance (RFC 0078 D11).

## Fixtures

| Fixture | Covers |
|---|---|
| `fixtures/01-minimal-screening.uwx.md` | Single-section minimal file at the screening stage |
| `fixtures/02-full-multifamily.uwx.md`  | Full multifamily deal across all 21 standard sections |
| `fixtures/04-scope-only.uwx.md` | Back-of-napkin scope-stage file with provisional blocks + populated `gaps` section |
| `fixtures/14-student-bed-counts.uwx.md` | Student-housing roll stating both bed counts with their dates (RFC 0069); no `BED-*` issue |
| `fixtures/15-student-bed-counts-inconsistent.uwx.md` | The same roll with `preleased_beds` above `total_beds` and `preleased_as_of` after `preleased_term_start`; `BED-02` and `BED-06` errors, nothing for the valid `occupied_beds` |
| `fixtures/16-frontmatter-yaml-scalars.uwx.md` | Format Appendix D scalar semantics: double-quoted `\"`, `\\` and `\u` escapes, single-quoted `''`, quoted `&` `*` `!` `#` `{}` `[]` as content, and trailing comments on plain, nested and sequence values. The baseline's frontmatter is a YAML 1.2 library's reading of the fixture, not this reader's |
| `fixtures/17-exit-proceeds-junior-capital.uwx.md` | Exit proceeds beside a senior, mezzanine, preferred and common stack (RFC 0077): `loan_balance_at_exit` repays both debts, `net_proceeds_to_equity` is the whole equity stack, and the stated `preferred_equity_redemption_at_exit` leaves `net_proceeds_to_common_equity`. Validates clean |
| `fixtures/18-content-member-is-payload.uwx.md` | A bare Format 3.0 block whose payload has a member named `content` (RFC 0081 §3): it is ordinary payload, never a wrapper, so the property states 48 units and the nested `content.total_units` (99) is not read as the property's |

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
| `malformed/06-wrong-actor` | `POL-01` | `verifyProvenance` + custom policy; Verifier `[validate]` baseline `06-wrong-actor.validation.json` |
| `malformed/07-replace-where-supersede-required` | `POL-02` | `verifyProvenance`; Verifier `[validate]` baseline `07-replace-where-supersede-required.validation.json` |
| `malformed/08-provisional-without-gap` | `DQ-01` | Validator (data quality) |
| `malformed/09-partial-without-overrides` | `DQ-03` | Validator (data quality) |
| `malformed/10-property-section-missing` | `CC-14`, `DQ-06` | Validator (RFC 0028: missing property warns; declared-stage section gaps report at info) |
| `malformed/11-yaml-flow-mapping` | `UNSUPPORTED_YAML_FEATURE` | Parser refusal (Appendix D.2 flow mapping) |
| `malformed/12-yaml-flow-sequence` | `UNSUPPORTED_YAML_FEATURE` | Parser refusal (Appendix D.2 non-empty flow sequence) |
| `malformed/13-yaml-invalid-escape` | `UNSUPPORTED_YAML_FEATURE` | Parser refusal (`\d` is not a YAML 1.2 escape) |
| `malformed/14-yaml-unquoted-anchor` | `UNSUPPORTED_YAML_FEATURE` | Parser refusal (an anchor outside quotes is still a YAML feature) |
| `malformed/15-uw-version-1-1` | `UNSUPPORTED_FORMAT_VERSION` | Parser refusal (Format 3.0 is the only format, RFC 0081 D1) |
| `malformed/16-uw-version-2-0` | `UNSUPPORTED_FORMAT_VERSION` | Parser refusal |
| `malformed/17-uw-version-2-1` | `UNSUPPORTED_FORMAT_VERSION` | Parser refusal |
| `malformed/18-uw-version-4-0` | `UNSUPPORTED_FORMAT_VERSION` | Parser refusal (a newer major is refused too) |
| `malformed/19-uw-version-absent` | `UNSUPPORTED_FORMAT_VERSION` | Parser refusal (no `uw_version` at all) |
| `malformed/20-flat-meta` | `META-01` | Validator (the retired flat `_meta` shape in a 3.0 file) |
| `malformed/21-section-id-wrapper` | `META-01` | Validator (the retired `{section_id, _meta, content}` wrapper) |
| `malformed/22-resolution-outside-vocabulary` | `SRC-03` | Validator (`provenance.resolution` outside the closed vocabulary) |
| `malformed/23-retired-official-alias` | `INVALID-ASSET-CLASS-002` | Validator (`org.uwmd.data_center` is refused like any namespaced builtin suffix) |

RFC0093 adds native Verifier controls `30-meta-placement`, `31-meta-section`,
`32-meta-quality` and `33-meta-pass-order`. Their `metadata_issues` rows pin exact
META-01/02/03 field attribution, multiplicity and complete-pass order; existing
wrapper findings retain their earlier attribution. The runner assesses the actual
structured source so numeric-key lexical placement is observed. Ordinary mutable
model and composed-source controls also live in the reference implementation's
focused tests. No existing fixture or expectation is rebaselined.

A fixture whose `expected.json` sets `"must_parse": false` must be refused by
the parser itself, with one of its `expected_codes`.

## Expected outputs

For each fixture `<id>.uwx.md`, the corresponding `expected/` directory contains:

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

A conforming Reader does not need to match the `rendered-*` outputs
byte-for-byte — those are starter-product checks, and different presentations
are encouraged.

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
node scripts/run-conformance.mjs --suite=documents
```

The reference runner compares a canonical projection of the parse output
(`{ frontmatter, sections, pipelineLog, customCalculations, customScenarios, extensions }`)
after stripping volatile fields (`last_modified`, `_meta.provenance.timestamp`).
