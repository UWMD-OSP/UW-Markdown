# `@uwmd/web-editor` — Calc-Aware Editor (preview 0.3.0)

The single editor for `.uw.md` files. Embeds the [`@uwmd/core`](../../packages/uwmd-core/) parser, validator, Tier-2 dispatcher, Tier-3 calc engine, and the §7.1/§7.2 report renderer in the browser so derived values (NOI, DSCR, LTV, IRR, valuation) never drift from inputs — and the lender package is always one tab away.

> **Status:** preview 0.3.0 — richer editing surfaces on the 0.2.0 React + Tailwind rebuild. Same edit chokepoint throughout.

## What it does

- **Editor tab** — sidebar with per-section validation badges, frontmatter form,
  ~30 numeric inputs (hand-curated allow-list, `src/catalog.ts`), **editable
  rent-roll tables** (unit mix / tenants), an **NOI line-item editor**
  (wrapper-aware: editing a `{value, …}` field updates `.value` and keeps
  rationale/source), block `_meta` provenance chips, collapsible raw-JSON view,
  **superseded-version history**, pipeline-log table, and a pinned metric strip
  that re-evaluates the asset class's full calc pack
  (`getPackForAssetClass` — all five shipped classes) after **every** edit.
- **Report Preview tab** — the spec's §7.1 Lender Package / §7.2 Credit Memo
  (`renderReportHtml` from core), re-rendered live in a sandboxed iframe on
  every edit. Tier toggle, Download HTML, Print/PDF (the print stylesheet is
  embedded, so browser print matches `uwmd-report`'s PDF output exactly).
- **Source tab** — the current canonical byte string (exactly what Download
  writes), for eyeballing Tier-2 byte preservation.
- **Undo/redo** — snapshot-based (Ctrl+Z / Ctrl+Y); restores a prior canonical
  source verbatim, so it can never desync from the file. **Ctrl+S** downloads.
- **New Deal** — scaffolds a blank `.uw.md` via core's `generateBlankUWFile`
  (canonical section order, empty stubs, initial pipeline-log entry).

## Why one editor and not a separate "narrative" editor?

The originally-planned Tier-2 web editor would have separated "safe" narrative edits from "unsafe" numeric edits. We rejected that design: it creates two paths into the same file and a wrong incentive to use the easier one. The calc-aware editor is the only editor that ever touches a `.uw.md` file, so every numeric edit re-runs every dependent calc immediately — there is no way to leave the file in an internally inconsistent state.

Every mutation flows through `src/edits.ts` → `applyEdit()` → re-parse. React state (`src/state.ts`) only holds the result; nothing edits `ParsedUWFile` or the source string by hand.

## Stack

- Single-page app, no backend.
- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + [Tailwind CSS 4](https://tailwindcss.com/).
- Imports `@uwmd/core/browser` — a node-free subset of the library that excludes the agent runner.
- Static deploy: drop `dist/` on any static host (GitHub Pages, Netlify, Cloudflare Pages, S3+CloudFront).

## Develop

From the repo root:

```bash
npm install              # one-time, registers the workspace
npm run build -w @uwmd/core
npm --prefix tools/web-editor install
npm --prefix tools/web-editor run dev
```

Open <http://localhost:5173>, then drag `examples/Parkview-Apts-Glendale-AZ.uw.md` onto the page.

## Build

```bash
npm --prefix tools/web-editor run build
```

Type-checks (`tsc --noEmit`) then bundles; output lands in `tools/web-editor/dist/`.
