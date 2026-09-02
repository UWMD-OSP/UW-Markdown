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
├── before.uwx.md                Input deal file
└── expected-after-shape.json   JSON Schema for the post-run file shape
```

## Provided scenarios

| Scenario | Layer | Validates |
|---|---|---|
| `fixtures/l6-risk-rating` | L6 | Layer produces a `risk_assessment` section with `overall_rating`, `risk_score`, and `key_risks`; pipeline log gets a new entry; existing sections are unchanged. |
| `fixtures/l0a-scope-deterministic` | L0a (Scope) | Scope agent walks the asset-class fallback cascade for every required input and stamps results provisional. Shape contract: `must_write_sections` (`noi_model`, `debt_structure`, `valuation`, `market_analysis`, `gaps`), `must_stamp_meta` (`source: asset_class_default`, `actor: agent/L0a`, `provisional: true`), `must_advance_stage_to: scope`. |

### Profile contract

A separate `profile/` subdirectory asserts that every entry in
`BANCROFT_LAYERS` declares the right `consumed_profile`. This is a
lightweight contract test — not LLM-driven — that catches accidental
profile-policy drift introduced by future layer additions.

```
profile/<scenario-id>/
└── expected-layer-profiles.json   { layer_id: consumed_profile, … }
```

| Scenario | Validates |
|---|---|
| `profile/consumer-profile-contract` | Sorted `(layer_id → consumed_profile)` map matches the recorded baseline. Update only when intentionally changing a layer's profile. |

## Running

Tier 4 is **operator-driven**, not part of CI — LLM calls cost money and
are nondeterministic. The reference runner ships a lint-only pass that
parses each `before.uwx.md`, validates each `expected-after-shape.json`
as a well-formed JSON Schema, and runs the profile-contract assertion:

```bash
node scripts/run-conformance.mjs --tier=4
```

Live agent runs against the shape are out of scope for the reference runner;
hosts validate their own post-run files against the shape using `ajv` or
equivalent.
