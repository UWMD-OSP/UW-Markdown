# Tier-2 Editor conformance

Tier-2 Editors apply structured edits to a `.uw.md` file and produce a new
`.uw.md` that:

- Round-trips formatting for unrelated regions (untouched bytes stay
  identical, ignoring trailing whitespace).
- Honors the supersede vs replace policy from `BUILTIN_EDIT_POLICIES`
  (`UW_PROTOCOL_v1.md` Part V).
- Updates `_meta` provenance correctly (new `version`, `timestamp`,
  `actor`, etc.).
- Updates frontmatter `last_modified` on every write.

## Fixtures

Each scenario lives in its own subdirectory:

```
fixtures/<scenario-id>/
├── before.uw.md      Input file
├── operation.json    The EditOperation to apply
└── after.uw.md       Expected output
```

Each scenario also includes a `context.json` describing the actor invoking
the edit (source, agent_id, agent_version, actor) — required by the
reference runner to populate `_meta` provenance.

## Provided scenarios

| Scenario | Operation | What it tests |
|---|---|---|
| `frontmatter-set-recommendation` | `frontmatter_set` of `recommendation` | Frontmatter update + `last_modified` bump |
| `section-replace-property` | `section_replace` of `property` (manual source) | In-place section replace per `BUILTIN_EDIT_POLICIES` (no supersede) |
| `section-supersede-risk-rating` | `section_replace` of `risk_assessment` (agent source) | Supersede chain: prior version flagged `superseded: true`, new version appended |

A conforming Tier-2 Editor's output for `before.uw.md + operation.json` MUST
match `after.uw.md` after both files are normalized (stripping trailing
whitespace, CRLF differences, and volatile fields: `last_modified`,
`_meta.timestamp`, `ts=` fence attributes).

Run via:

```bash
node scripts/run-conformance.mjs --tier=2
```
