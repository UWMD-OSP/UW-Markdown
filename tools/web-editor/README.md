# `@uwmd/web-editor` — Calc-Aware Editor (preview 0.4.0)

The single editor for `.uw.md` files. Embeds the [`@uwmd/core`](../../packages/uwmd-core/) parser, validator, Tier-2 dispatcher, Tier-3 calc engine, and the §7.1/§7.2 report renderer in the browser so derived values (NOI, DSCR, LTV, IRR, valuation) never drift from inputs — and the lender package is always one tab away.

> **Status:** preview 0.4.0 — extensive build-out (intelligence, provenance, transparency, full data entry) on the React + Tailwind base. Same edit chokepoint throughout.

## What it does

Five tabs:

- **Editor** — sidebar with per-section validation badges; an **edit-provenance
  bar** (actor/source/confidence/notes/human-review, and **replace vs. append
  (supersede)** mode); frontmatter form; ~30 curated numeric inputs; **editable
  rent-roll tables** with add/remove rows; an **NOI line-item editor**
  (wrapper-aware `{value,…}` editing that keeps rationale/source); an
  **assumptions editor** that captures override rationale; a **generic field
  editor** for every scalar (narrative strings → textareas); a **clickable
  metric strip** where each calc opens its formula + resolved inputs + result;
  block `_meta` chips, raw-JSON view, superseded-version history, pipeline log.
- **Intelligence** — **Scope** (every required input resolved through the
  fallback cascade, with where it came from and the published range) and
  **Refine** (value-of-information ranking — the missing/defaulted inputs that
  move the deal's metrics most, with suggested questions).
- **Report** — the §7.1 Lender Package / §7.2 Credit Memo, live in a sandboxed
  iframe, with tier toggle, Download HTML, Print/PDF.
- **Diff** — section + frontmatter changes since load / last save.
- **Source** — the current canonical bytes (exactly what Download writes).

Plus snapshot-based **undo/redo** (Ctrl+Z / Ctrl+Y), **Ctrl+S** download, and a
**New Deal** dialog (`generateBlankUWFile`).

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
