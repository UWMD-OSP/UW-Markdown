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

## Provided scenarios

| Scenario | Operation | What it tests |
|---|---|---|
| `frontmatter-set-recommendation` | `frontmatter_set` of `recommendation` | Frontmatter update + last_modified bump |

A conforming Tier-2 Editor's output for `before.uw.md + operation.json` MUST
match `after.uw.md` after both files are normalized (stripping trailing
whitespace and CRLF differences).
