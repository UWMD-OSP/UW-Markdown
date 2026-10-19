# Malformed fixtures (documents)

Negative-test counterpart to `../fixtures/`. Each `.uw.md` here is
intentionally malformed in a way that the **validator** must catch.

## Contract

For every `<id>.uw.md` in this directory there is a sibling
`<id>.expected.json` of shape:

```json
{
  "description": "human-readable explanation of what's wrong",
  "must_parse": true,
  "expected_codes": ["VALIDATOR_CODE_1", "VALIDATOR_CODE_2"],
  "spec_ref": "spec/UW_PROTOCOL.md §III.6a"
}
```

The conformance runner asserts that:

1. `parseUWFile(content)` succeeds (or throws, if `must_parse: false`).
2. `validateUWFile(parsed)` returns a result whose `issues[].code`
   includes **every** code in `expected_codes`.

A fixture passes when the actual issue codes are a superset of the
expected codes. Extra codes are tolerated — the contract is "the
validator must surface this problem," not "the validator must surface
*only* this problem."

## Catalog

| Fixture | Code(s) | What's wrong |
| ------- | ------- | ------------ |
| `01-missing-section-meta.uw.md` | `META_MISSING` | Section block has `content` but no `_meta` object. |
| `02-low-confidence-no-review.uw.md` | `META_LOW_CONFIDENCE_NO_REVIEW_FLAG` | `_meta.quality.confidence: "low"` without `human_review_required: true`. |
| `03-sources-uses-mismatch.uw.md` | `CC-04` | `sources_uses.total_sources != total_uses` (cross-section consistency). |

## Adding a fixture

1. Pick a validator code from `BUILTIN_REMEDIATIONS` in
   [`packages/uwmd-verify/src/validator.ts`](../../../packages/uwmd-verify/src/validator.ts)
   that is not already exercised here.
2. Hand-craft the smallest `.uw.md` that triggers it — frontmatter
   plus one offending section block is usually enough.
3. Write the matching `<id>.expected.json` declaring the codes the
   validator must emit.
4. Add its owner row to `conformance/corpus-index.json`, then run
   `node scripts/run-conformance.mjs --suite=documents` from the repo root
   and confirm the new fixture passes.

## RFC0090 actor controls

Fixtures24–29 pin absent, null, exact-empty and non-string actor rejection,
retained history/overwritten extension/append coverage and wrapper precedence.
The existing malformed-corpus contract asserts code presence; focused
`validator.block-shape.test.ts` and the cited actor inventory additionally pin
field paths, multiplicity, ordering, arbitrary nonempty strings, mutable-model
authority and no duplicate actor cascade. These are the governed expectations accepted with RFC0090; historical sources
and original expectation evidence remain unchanged.


## RFC0096 payload controls

Authored controls44–49 cover lease-up, recovery, capital-stack sizing, waterfall,
lawful boundaries and current-peer authority. Their `payload_issues` arrays pin
37 ordered rows of LU-05/REC-11/CS-03/WF-16, including exact severity, section and
field. This projection does not assert whole-document financial validity; other
registered findings remain visible. Empty arrays explicitly test absence of the
four new codes. All examples declare their own canonical metadata.

Two additional controls under `conformance/recoveries/` distinguish a missing
cash-flow variant named `toString`, `valueOf` or `hasOwnProperty` (REC-09) from
an actual own variant with such a name. The only existing expectation adjusted
for RFC0096 is `reject-member-without-method`: its original source is unchanged,
and the accepted M/P table requires one REC-02 rather than two. No portable case
or unrelated expectation is changed.
