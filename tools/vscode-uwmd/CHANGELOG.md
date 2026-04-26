# vscode-uwmd changelog

## [0.1.0] — initial preview

### Added
- Syntax highlighting for `.uw.md` (YAML frontmatter, Markdown prose, JSON inside `uwmd json` fenced blocks).
- Folding ranges for frontmatter, fenced blocks, and heading sections.
- Document outline (symbol provider) for headings.
- On-save validation via `@uwmd/core` `parseUWFile` + `validateUWFile`. Diagnostics carry the validation `code`, `title`, `message`, `remediation`, and `spec_ref`.
- Configuration: `uwmd.validate.onSave`, `uwmd.validate.onChange`.
