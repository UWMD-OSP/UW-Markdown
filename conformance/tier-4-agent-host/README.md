# Tier-4 Agent Host conformance

Tier-4 Agent Hosts run the Bancroft layer DAG (or a module-contributed
equivalent) and apply the resulting `write_uw_section` / `write_multiple_sections`
tool calls back into the file. Hosts MUST:

- Honor the layer dependency graph in `BANCROFT_LAYERS` (`UW_PROTOCOL_v1.md`
  Part IX).
- Validate every agent tool call against the schemas in
  `WRITE_UW_SECTION_TOOL` and `WRITE_MULTIPLE_SECTIONS_TOOL`.
- Strip any `_meta` / `_notes` Claude includes inside `section_data` and
  apply the canonical `_meta` constructed from `buildMeta()`.
- Append a pipeline_log entry for every successful agent run.

## Why shape assertions

LLM nondeterminism makes byte-equality testing impractical at this tier.
Each fixture's expected output is a JSON Schema describing the shape an
acceptable result must have — required fields, value enums, plausible
ranges — not a literal expected file.

## Fixtures

```
fixtures/<scenario-id>/
├── before.uw.md                Input deal file
└── expected-after-shape.json   JSON Schema for the post-run file shape
```

## Provided scenarios

| Scenario | Layer | Validates |
|---|---|---|
| `l6-risk-rating` | L6 | Layer produces a `risk_assessment` section with `overall_rating`, `risk_score`, and `key_risks`; pipeline log gets a new entry; existing sections are unchanged. |

## Running

Tier 4 is **operator-driven**, not part of CI — LLM calls cost money and
are nondeterministic. The reference runner ships a lint-only pass that
parses each `before.uw.md` and validates each `expected-after-shape.json`
as a well-formed JSON Schema:

```bash
node scripts/run-conformance.mjs --tier=4
```

Live agent runs against the shape are out of scope for the reference runner;
hosts validate their own post-run files against the shape using `ajv` or
equivalent.
