# `@uwmd/web-editor` — Calc-Aware Editor (preview 0.2.0)

The single editor for `.uw.md` files. Embeds the [`@uwmd/core`](../../packages/uwmd-core/) parser, validator, Tier-2 dispatcher, Tier-3 calc engine, and the §7.1/§7.2 report renderer in the browser so derived values (NOI, DSCR, LTV, IRR, valuation) never drift from inputs — and the lender package is always one tab away.

> **Status:** preview 0.2.0 — full React + Tailwind rebuild of the 0.1.0 vanilla-TS editor. Same edit chokepoint, richer UI, live report preview.

## What it does

- **Editor tab** — sidebar with per-section validation badges, frontmatter form,
  per-section numeric inputs (hand-curated allow-list, `src/catalog.ts`), block
  `_meta` provenance chips, collapsible raw-JSON view, pipeline-log table, and a
  pinned metric strip that re-evaluates the asset class's full calc pack
  (`getPackForAssetClass` — all five shipped classes) after **every** edit.
- **Report Preview tab** — the spec's §7.1 Lender Package / §7.2 Credit Memo
  (`renderReportHtml` from core), re-rendered live in a sandboxed iframe on
  every edit. Tier toggle, Download HTML, Print/PDF (the print stylesheet is
  embedded, so browser print matches `uwmd-report`'s PDF output exactly).

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
