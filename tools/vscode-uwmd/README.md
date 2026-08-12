# UW Markdown — VS Code extension

Syntax highlighting, section folding, document outline, on-save
validation, and receipt verification for `.uw.md` (UW Lite) and
`.uwx.md` (UWX) underwriting files.

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
- **Representation-aware validation** — on save (configurable to
  on-change), the extension picks the parser from the file's *content*,
  not its extension. UW Lite documents get Lite parse errors
  (`LITE_*`) plus deal-summary bridge errors (`LITE_COMPILE_*`);
  structured UWX documents get the full validator. Diagnostics point at
  the line they concern.
- **Verify a receipt** — the **UW Markdown: Verify Receipt for This
  Deal** command checks the `.receipt.json` sidecar beside the open
  deal and reports one of three results, with the full breakdown in the
  *UW Markdown Receipts* output channel.

## Verifying receipts

Run **UW Markdown: Verify Receipt for This Deal** from the command
palette with a `.uw.md` or `.uwx.md` file open. The extension looks for
`<deal>.receipt.json` next to it.

| Result | Meaning |
|---|---|
| **Verified** | The record is unchanged since the receipt was issued and its stated outputs recompute. |
| **Failed** | The digest, a result, or the signature disagrees. If the editor has unsaved changes, that is the likeliest cause — save and re-run. |
| **Unverifiable** | This build cannot decide: it lacks the pack, the pack version, or a signature backend. **Not a negative result.** |

A verified receipt attests two things: the record's canonical financial
content is unchanged, and its stated outputs follow deterministically
from that content under the named pack. It attests **nothing** about
whether the inputs are true. A deal with a fabricated NOI can carry a
perfectly valid receipt.

The extension verifies but does not issue. A receipt issued while you
are still editing is stale the moment you type again — issue one with
`uwmd receipt issue <deal>` when the deal is finished.

## Settings

| Setting | Default | What it does |
|---|---|---|
| `uwmd.validate.onSave` | `true` | Validate the file when it's saved. Turn off to silence diagnostics entirely. |
| `uwmd.validate.onChange` | `false` | Re-validate while typing. Off by default — parsing every keystroke can flicker on large files. |

## Which files, and which checks

Both `.uw.md` and `.uwx.md` are recognised. The representation is
decided by content, so a structured record still carrying the legacy
`.uw.md` extension is handled correctly and gets an informational nudge
to migrate.

| Representation | Checks |
|---|---|
| **UW Lite** (`.uw.md`) | Lite grammar errors (`LITE_*`) and deal-summary bridge errors (`LITE_COMPILE_*` — unsupported units, unknown field paths, non-base scenarios) |
| **UWX** (`.uwx.md`) | The full structured validator (`CC-*`, `FV-*`, `DQ-*`, `META_*`) |

Financial thresholds (DSCR, LTV, and friends) are **not** reported for
Lite documents. Those checks read `frontmatter.quick_metrics`, and the
deal-summary bridge does not populate it — so there is nothing for them
to read. Computing the metrics here instead would mean the extension
flags things `uwmd validate` does not, which is a promise this extension
deliberately keeps. Run the numbers through the CLI or the web editor.

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
