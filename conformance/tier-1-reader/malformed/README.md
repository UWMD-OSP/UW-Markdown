# Tier 1 — Malformed fixtures

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
  "spec_ref": "spec/UW_PROTOCOL_v1.md §III.6a"
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
| `02-low-confidence-no-review.uw.md` | `META_LOW_CONFIDENCE_NO_REVIEW_FLAG` | `_meta.confidence: "low"` without `human_review_required: true`. |
| `03-sources-uses-mismatch.uw.md` | `CC-04` | `sources_uses.total_sources != total_uses` (cross-section consistency). |

## Adding a fixture

1. Pick a validator code from `BUILTIN_REMEDIATIONS` in
   [`packages/uwmd-core/src/validator.ts`](../../../packages/uwmd-core/src/validator.ts)
   that is not already exercised here.
2. Hand-craft the smallest `.uw.md` that triggers it — frontmatter
   plus one offending section block is usually enough.
3. Write the matching `<id>.expected.json` declaring the codes the
   validator must emit.
4. Run `node scripts/run-conformance.mjs --tier=1` from the repo root
   and confirm the new fixture passes.
