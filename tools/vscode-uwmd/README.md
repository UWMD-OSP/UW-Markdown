# UW Markdown — VS Code extension

Syntax highlighting, section folding, document outline, and on-save
validation for `.uw.md` underwriting files.

Backed by the same parser and validator as `@uwmd/core`, so what the
extension flags is exactly what `uwmd validate` flags on the command line
and what CI gates with.

## Features

- **Syntax highlighting** — YAML frontmatter, Markdown prose, and
  embedded JSON inside ` ```uwmd json ` blocks all get appropriate
  scopes.
- **Section folding** — fold the frontmatter, any heading section, and
  any fenced code block.
- **Document outline** — VS Code's outline panel shows a nested view of
  the file's `##`/`###` sections.
- **Validation diagnostics** — on save (configurable to on-change), the
  extension parses the file with `@uwmd/core` and surfaces every
  validation issue as a diagnostic with the spec reference and
  remediation copy.

## Settings

| Setting | Default | What it does |
|---|---|---|
| `uwmd.validate.onSave` | `true` | Validate the file when it's saved. Turn off to silence diagnostics entirely. |
| `uwmd.validate.onChange` | `false` | Re-validate while typing. Off by default — parsing every keystroke can flicker on large files. |

## Install (development)

This package is not yet on the marketplace. To install locally:

```bash
cd tools/vscode-uwmd
npm install
npm run build
npx vsce package
code --install-extension vscode-uwmd-0.1.0.vsix
```

## Roadmap

- Hover tooltips for `_meta.source` badges.
- Quick-fix actions tied to `BUILTIN_REMEDIATIONS` codes.
- "Apply edit operation" command using `applyEdit()` from `@uwmd/core`.
- Inline calc expression evaluation via `evaluateCalc()`.

## License

MIT — see the repo root [LICENSE](../../LICENSE).
