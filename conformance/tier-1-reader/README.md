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
| `01-minimal-screening.uw.md` | Single-section minimal file at the screening stage |
| `02-full-multifamily.uw.md`  | Full multifamily deal across all 21 standard sections |
| `03-multi-variant-stress-tests.uw.md` | A stress_tests section with multiple variants |
| `04-with-extensions.uw.md` | Extension blocks (`x_*` namespaces) alongside standard sections |
| `05-superseded-blocks.uw.md` | A section with one current block + two superseded predecessors |

## Expected outputs

For each fixture `<id>.uw.md`, the corresponding `expected/` directory contains:

- `<id>.parsed.json` — the result of `cli parse --json` (the canonical JSON
  shape of `ParsedUWFile`).
- `<id>.rendered-summary.md` — output of `cli render --format summary`.
- `<id>.rendered-chat.txt` — output of `cli render --format chat`.

A conforming Tier-1 Reader does not need to match the `rendered-*` outputs
byte-for-byte (different presentations are encouraged), but its parse output
MUST canonicalize to the same `<id>.parsed.json`.
