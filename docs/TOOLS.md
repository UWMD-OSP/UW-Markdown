# Which tool should I use?

Six tools ship with the UW Markdown reference stack. They overlap on
purpose: the format is the contract, the tools are interchangeable.
Pick the one that matches what you're trying to do.

Two file extensions appear below. `.uwx.md` is the complete structured
record every tool works on; `.uw.md` is the UW Lite summary, which only
the editor, the CLI, and the VS Code extension read. See
[UW Lite and UWX](UW_LITE_AND_UWX.md).

For source-checkout calculation scenarios, see
[Calculation context files](CALCULATION_CONTEXT.md): select period variants
and exact overrides in calc, refinement and explicit Excel export.

For the next modeling step, the [lease-up cash-flow example](LEASE_UP_CASH_FLOW_WORKFLOW.md)
verifies an explicitly dated partial stream using existing APIs.

The source checkout's **unreleased** `verify-cash-flows` command checks stated
cash-flow metrics without a custom script; see the
[workflow](PROPERTY_CASH_FLOW_WORKFLOW.md#check-stated-cash-flow-metrics-from-the-cli-unreleased).
It checks mathematical consistency, not economic completeness.

## Decision tree

| If you want to... | Reach for | Tier |
|---|---|---|
| Open a `.uw.md` Lite summary or `.uwx.md` structured deal | [Web editor](#web-editor) | 2 + 3 |
| Author a deal file by hand | [VS Code extension](#vs-code-extension) | 1 + lint |
| Edit numeric fields and watch DSCR/LTV recompute | [Web editor](#web-editor) | 2 + 3 |
| Script validation, scaffolding, or rendering | [`uwmd` CLI](#uwmd-cli) | 1 + 2 |
| Hand the deal to a banker who lives in Excel | [Excel converter](#excel-converter) | 3 (export) |
| Index a folder of deals, or feed a data lake | [`@uwmd/batch`](#batch-indexer) | 1 + 3 (read-only) |
| Run an LLM agent over the deal | `runBancroftAgent` from `@uwmd/core` | 4 |
| Prove a deal's metrics follow from its inputs | [`uwmd receipt`](#uwmd-cli) or the [web editor](#web-editor) | 3 |
| Check a receipt a counterparty sent you | any of the [CLI](#uwmd-cli), [web editor](#web-editor), or [VS Code extension](#vs-code-extension) | 3 |

If you're not sure what conformance tier means, see the
[protocol spec §II](../spec/UW_PROTOCOL_v1.md) or the
[tier overview in the conformance corpus](../conformance/README.md).

---

## Web viewer

**[`tools/web-viewer/`](../tools/web-viewer/) — single-file HTML, drag-and-drop.**

Open `index.html` in any browser. Drop a `.uwx.md` record on the page.
See it rendered. (It does not read `.uw.md` Lite summaries — use the
web editor for those.)

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
validation diagnostics tied to `BUILTIN_REMEDIATIONS`, and a
**Verify Receipt for This Deal** command that checks the
`.receipt.json` sidecar beside the open file. It verifies but does not
issue — a receipt issued mid-authoring is stale on the next keystroke.
See [Verification receipts](UW_RECEIPTS.md).

It handles both representations: `.uw.md` Lite summaries and `.uwx.md`
structured records, choosing the parser from the file's content rather
than its extension.

Best for: writing deal files by hand. Reviewing a teammate's PR
that touches a deal file. Living in the spec while authoring.

Skip it for: numeric editing with live recalculation (the validator
flags issues; it doesn't recompute). Use the [web editor](#web-editor)
for that workflow.

Not yet on the marketplace; install via `vsce package` + `code
--install-extension`.

---

## Web editor

**[`tools/web-editor/`](../tools/web-editor/) — calc-aware browser editor.**

It opens readable `.uw.md` Lite summaries and complete `.uwx.md` structured records. Lite imports compile into UWX before editing; exporting back to Lite always shows any omitted advanced fields. See [UW Lite and UWX](UW_LITE_AND_UWX.md).

Single-page app. Embeds the `@uwmd/core` parser, validator, Tier-2
edit dispatcher, and Tier-3 calc engine in the browser. Every
numeric edit re-runs every dependent calc immediately, so the file
can never be left internally inconsistent.

The **Receipt** tab issues and verifies
[verification receipts](UW_RECEIPTS.md) client-side — nothing is uploaded.

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
npx uwmd init my-deal.uwx.md          # scaffold a format-2.0 record
npx uwmd validate my-deal.uwx.md      # check
npx uwmd parse my-deal.uwx.md         # to JSON
npx uwmd render my-deal.uwx.md --html # to HTML
npx uwmd run my-deal.uwx.md L6        # invoke a Bancroft layer
npx uwmd receipt issue my-deal.uwx.md # issue a verification receipt
npx uwmd receipt verify my-deal.uwx.md my-deal.receipt.json
```

`receipt verify` exits 0 for `verified`, 1 for `failed`, and **3 for
`unverifiable`** — "cannot decide" is a distinct outcome, not a pass
or a rejection. See [Verification receipts](UW_RECEIPTS.md).

Best for: CI gates. Pre-commit hooks. Batch processing. Anything
where you need a script, not a UI.

Skip it for: interactive editing.

Thin wrapper over `@uwmd/core`. Published on npm as `@uwmd/cli` —
`npx uwmd <cmd>` works with no clone; from a clone,
`npm run cli -- <cmd>` runs it from source.

---

## Excel converter

**[`packages/uwmd-excel`](../packages/uwmd-excel/) — `.uwx.md` → `.xlsx`.**

Emits a live underwriting workbook. Derived metrics ship as Excel
formulas, not pre-computed values, so the workbook stays in sync with
the calc engine by construction. The asset class's calc pack drives
both paths; a parity test asserts they agree to six decimals.

Best for: handing a deal to someone who lives in Excel. Producing
deliverables for credit committee. Bridging legacy review processes.

Skip it for: storing your data in. The `.uwx.md` record remains the
source of truth — the workbook is an export, not a roundtrip target
in v1.

Supports all ten asset classes. Mixed-use gets its own workbook shape
— one footing operating statement per component plus a consolidation
block that sums to the property NOI. A deal that states a
`capital_stack` section gains a Capital Stack sheet: one row per
tranche with live debt-service formulas, and a sizing block that
recomputes every stated figure beside its stated value at the same
quantum the core verifier compares at.

---

## Batch indexer

**[`packages/uwmd-batch`](../packages/uwmd-batch/) — a folder of deals → one index.**

```bash
npx @uwmd/batch deals --out batch-output          # collection index (JSON + CSV)
npx @uwmd/batch deals --out batch-output --facts  # plus the corpus fact table
```

Walks a directory of `.uwx.md` records, validates each, records its
semantic digest, and emits `uwmd-collection.json` plus a
spreadsheet-safe CSV. With `--facts` it also writes the corpus fact
table: one identity-pinned row per deal per metric, ready for DuckDB or
any warehouse. Invalid deals stay visible in the index rather than
disappearing. See [UW Markdown → data lake](DATA_LAKE.md).

Best for: screening a pipeline of deals. Feeding a data lake without
writing a loader. Answering "median exit cap across these fifty deals"
with a SQL query instead of a spreadsheet.

Skip it for: editing (it never writes a deal file). Semantic
find-similar retrieval (deferred; see RFC 0013).

Read-only by construction. Published on npm as `@uwmd/batch`.

---

## Programmatic agent host

Bancroft is UW Markdown's optional reference suite of staged underwriting agents. It is not required to create, read, validate, edit, calculate, convert, or exchange a deal file; other providers and application-specific agents can use the same format and Tier-4 host contract.

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
| Batch indexer | `packages/uwmd-batch/` | 1 + 3 (read-only) |
| Bancroft agent host | `packages/uwmd-core/src/agents/` | 4 |
