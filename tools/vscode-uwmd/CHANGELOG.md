# vscode-uwmd changelog

## [0.2.0]

### Fixed
- **UW Lite files are actually validated now.** The extension ran the
  *structured* parser over every `.uw.md`. Post-RFC-0017 that extension means
  UW Lite, where the structured parser finds no fenced sections — so it
  reported zero issues and a `clean` status for a document nothing had parsed.
  A silent false pass. The parser is now chosen from the content, the way
  core's `detectUWSourceRepresentation` does it.
- **Diagnostics point at the line they concern.** Every diagnostic was pinned
  to line 1. Lite issues carry source ranges and structured blocks carry
  `lineStart`, so both are now anchored properly.

### Added
- **`.uwx.md` is registered.** Structured records on the new extension get
  highlighting, folding, outline, and validation; previously they got nothing.
- Structured content still on the legacy `.uw.md` extension is detected and
  gets an informational nudge to migrate.
- Unit tests for the analysis path, including a regression guard on the silent
  false pass.

### Added (receipts)
- **`UW Markdown: Verify Receipt for This Deal`** — verifies the
  `<deal>.receipt.json` sidecar beside the open file (RFC 0016). Reports
  `verified` / `failed` / `unverifiable` as an information, error, or warning
  notification respectively, with the full breakdown in a *UW Markdown
  Receipts* output channel. Unsaved editor changes are offered as the likely
  explanation for a failure. Per `UW_RECEIPT_v1.md` §1 the verified
  notification is never a bare checkmark — it states inline that the receipt
  does not attest the inputs are true.
- Unit tests (`vitest`) over the verification logic, which lives in a
  `vscode`-free module so it runs without an editor harness.

## [0.1.0] — initial preview

### Added
- Syntax highlighting for `.uw.md` (YAML frontmatter, Markdown prose, JSON inside `uwmd json` fenced blocks).
- Folding ranges for frontmatter, fenced blocks, and heading sections.
- Document outline (symbol provider) for headings.
- On-save validation via `@uwmd/core` `parseUWFile` + `validateUWFile`. Diagnostics carry the validation `code`, `title`, `message`, `remediation`, and `spec_ref`.
- Configuration: `uwmd.validate.onSave`, `uwmd.validate.onChange`.
