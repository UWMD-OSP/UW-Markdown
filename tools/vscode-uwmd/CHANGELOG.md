# vscode-uwmd changelog

## [Unreleased]

### Added
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
