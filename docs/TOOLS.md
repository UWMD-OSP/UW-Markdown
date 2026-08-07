# Which tool should I use?

Five tools ship with the UW Markdown reference stack. They overlap on
purpose: the format is the contract, the tools are interchangeable.
Pick the one that matches what you're trying to do.

## Decision tree

| If you want to... | Reach for | Tier |
|---|---|---|
| Open a `.uw.md` Lite summary or `.uwx.md` structured deal | [Web editor](#web-editor) | 2 + 3 |
| Author a deal file by hand | [VS Code extension](#vs-code-extension) | 1 + lint |
| Edit numeric fields and watch DSCR/LTV recompute | [Web editor](#web-editor) | 2 + 3 |
| Script validation, scaffolding, or rendering | [`uwmd` CLI](#uwmd-cli) | 1 + 2 |
| Hand the deal to a banker who lives in Excel | [Excel converter](#excel-converter) | 3 (export) |
| Run an LLM agent over the deal | `runBancroftAgent` from `@uwmd/core` | 4 |

If you're not sure what conformance tier means, see the
[protocol spec §II](../spec/UW_PROTOCOL_v1.md) or the
[tier overview in the conformance corpus](../conformance/README.md).

---

## Web viewer

**[`tools/web-viewer/`](../tools/web-viewer/) — single-file HTML, drag-and-drop.**

Open `index.html` in any browser. Drop a `.uw.md` on the page. See it
rendered.

Best for: sharing a deal with someone who doesn't have the toolchain.
Reading a deal you didn't write. Demoing the format.

Skip it for: editing (no edit UI), calc evaluation (no calc engine),
sections beyond the most-displayed eight (the inlined registry is
intentionally minimal).

Under 500 LOC of HTML/CSS/JS. Nothing to install.

---

## VS Code extension

**[`tools/vscode-uwmd/`](../tools/vscode-uwmd/) — authoring extension.**

Syntax highlighting, section folding, document outline, on-save
validation diagnostics tied to `BUILTIN_REMEDIATIONS`.

Best for: writing `.uw.md` files by hand. Reviewing a teammate's PR
that touches a deal file. Living in the spec while authoring.

Skip it for: numeric editing with live recalculation (the validator
flags issues; it doesn't recompute). Use the [web editor](#web-editor)
for that workflow.

Not yet on the marketplace; install via `vsce package` + `code
--install-extension`.

---

## Web editor

**[`tools/web-editor/`](../tools/web-editor/) — calc-aware browser editor.**

It opens readable .uw.md Lite summaries and complete .uwx.md structured records. Lite imports compile into UWX before editing; exporting back to Lite always shows any omitted advanced fields. See [UW Lite and UWX](UW_LITE_AND_UWX.md).

Single-page app. Embeds the `@uwmd/core` parser, validator, Tier-2
edit dispatcher, and Tier-3 calc engine in the browser. Every
numeric edit re-runs every dependent calc immediately, so the file
can never be left internally inconsistent.

Best for: working on a deal where you care about derived values (NOI,
DSCR, LTV, IRR, valuation). Demoing the calc engine to someone
unfamiliar with the format.

Skip it for: bulk authoring (the VS Code extension is faster for
keyboard-heavy work). Server-side workflows (use the CLI).

Static deploy — no backend needed.

---

## `uwmd` CLI

**[`packages/uwmd-cli`](../packages/uwmd-cli/) — programmatic entry point.**

```bash
npx uwmd init my-deal.uw.md           # scaffold
npx uwmd validate my-deal.uw.md       # check
npx uwmd parse my-deal.uw.md          # to JSON
npx uwmd render my-deal.uw.md --html  # to HTML
npx uwmd run my-deal.uw.md L6         # invoke a Bancroft layer
```

Best for: CI gates. Pre-commit hooks. Batch processing. Anything
where you need a script, not a UI.

Skip it for: interactive editing.

Thin wrapper over `@uwmd/core`. Not yet on npm — until it is, run it
from a clone with `npm run cli -- <cmd>`.

---

## Excel converter

**[`packages/uwmd-excel`](../packages/uwmd-excel/) — `.uw.md` → `.xlsx`.**

Emits a live underwriting workbook. Derived metrics ship as Excel
formulas, not pre-computed values, so the workbook stays in sync with
the calc engine by construction. The asset class's calc pack drives
both paths; a parity test asserts they agree to six decimals.

Best for: handing a deal to someone who lives in Excel. Producing
deliverables for credit committee. Bridging legacy review processes.

Skip it for: storing your data in. The `.uw.md` file remains the
source of truth — the workbook is an export, not a roundtrip target
in v1.

Supports multifamily, office, retail, and industrial (the asset
classes with a registered workbook layout); other classes land
alongside their calc packs.

---

## Programmatic agent host

Bancroft is UWMD optional reference suite of staged underwriting agents. It is not required to create, read, validate, edit, calculate, convert, or exchange a .uw.md file; other providers and application-specific agents can use the same format and Tier-4 host contract.

**[`packages/uwmd-core/src/agents/bancroft.ts`](../packages/uwmd-core/src/agents/bancroft.ts)
— Tier-4 reference implementation.**

`runBancroftAgent(file, layerId)` runs a single Bancroft layer
(`L1`–`L7`) over the deal using Claude as the LLM. Edits are dispatched
through the same `applyEdit` gate that the web editor uses, so an
agent can never violate an edit policy.

Best for: building a custom underwriting pipeline. Researching what
LLM-driven underwriting looks like end-to-end.

Skip it for: deterministic workflows. (The protocol §IX contract is
provider-neutral; a deterministic backend is on the v2 roadmap.)

Requires an `ANTHROPIC_API_KEY`.

---

## Where each tool lives

| Tool | Path | Conformance tier |
|---|---|---|
| Web viewer | `tools/web-viewer/` | 1 |
| VS Code extension | `tools/vscode-uwmd/` | 1 |
| Web editor | `tools/web-editor/` | 2 + 3 |
| `uwmd` CLI | `packages/uwmd-cli/` | 1 + 2 |
| Excel converter | `packages/uwmd-excel/` | 3 (export) |
| Bancroft agent host | `packages/uwmd-core/src/agents/` | 4 |
