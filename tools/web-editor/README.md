# `@uwmd/web-editor` — Calc-Aware Editor (preview 0.1.0)

The single editor for `.uw.md` files. Embeds the [`@uwmd/core`](../../packages/uwmd-core/) parser, validator, Tier-2 dispatcher, and Tier-3 calc engine in the browser so derived values (NOI, DSCR, LTV, IRR, valuation) never drift from inputs.

> **Status:** all 5 stages live (preview 0.1.0). Bundle, read-only viewer, frontmatter editing, numeric section editing with live multifamily calc dashboard, and a validation footer wired to `validateUWFile()`.

## Why this and not a separate "narrative" editor?

The originally-planned Tier-2 web editor would have separated "safe" narrative edits from "unsafe" numeric edits. We rejected that design: it creates two paths into the same file and a wrong incentive to use the easier one. The calc-aware editor is the only editor that ever touches a `.uw.md` file, so every numeric edit re-runs every dependent calc immediately — there is no way to leave the file in an internally inconsistent state.

## Stack

- Single-page app, no backend.
- [Vite](https://vitejs.dev/) + plain TypeScript. No React/Vue.
- Imports `@uwmd/core/browser` — a node-free subset of the library that excludes the agent runner.
- Static deploy: drop `dist/` on any static host (GitHub Pages, Netlify, Cloudflare Pages, S3+CloudFront).

## Develop

From the repo root:

```bash
npm install              # one-time, registers the workspace
npm run build -w @uwmd/core
npm --prefix tools/web-editor run dev
```

Open <http://localhost:5173>, then drag `examples/Parkview-Apts-Glendale-AZ.uw.md` onto the page.

## Build

```bash
npm --prefix tools/web-editor run build
```

Output lands in `tools/web-editor/dist/`.

## Roadmap (stages)

1. ✅ Bundle stand-up + drag-drop file load
2. ✅ Read-only viewer for every section + frontmatter + pipeline log
3. ✅ Frontmatter editing via `applyEdit()` round-trip
4. ✅ Numeric section editing + live multifamily calc starter pack (cap rate, LTV, DSCR, debt yield, $/unit, $/sqft, price/unit, cash-on-cash)
5. ✅ Validation panel (every `ValidationMessage` from `validateUWFile()`, with remediation copy from `BUILTIN_REMEDIATIONS` when registered) + save/load polish (download preserves original filename, fallback uses `frontmatter.deal_id`)
