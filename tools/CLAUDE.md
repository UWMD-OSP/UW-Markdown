# CLAUDE.md — `tools/`

User-facing tools built on `@uwmd/core`. Deep reference:
[`docs/wiki/08-tools.md`](../docs/wiki/08-tools.md). Root: [`CLAUDE.md`](../CLAUDE.md).

## The tools

- `web-viewer/` — single-file `index.html` (<500 LOC), no build. Tier-1 drag-drop
  reader. Embeds a minimal parser + renderer.
- `web-editor/` — Vite + TypeScript (no framework). Tier-2/3 calc-aware editor;
  `src/main.ts` (state), `src/edits.ts` (edit dispatch), `src/ui.ts` (render).
  Build: `npm run build` (vite).
- `vscode-uwmd/` — authoring extension (syntax, folding, on-save validation).
  Entry `src/extension.ts`; grammar in `syntaxes/`; bundled with esbuild; package
  via `vsce package`.
- `docs-site/` — **published** VitePress site. `scripts/prebuild.mjs` copies
  repo-root markdown in and rewrites links (repo root is the source of truth).
  Dev: `npm run dev`; build: `npm run build`.

## Rules for tool code

- **Tools depend on `@uwmd/core` only** — never import another tool's code.
- **Browser tools import from `@uwmd/core/browser`** (not `@uwmd/core`) so the
  Anthropic SDK stays out of the bundle.
- TypeScript, ESM, `Bundler` resolution for web tools (`vscode`/`web-editor`).
- `docs/wiki/` is internal dev docs — **do not** add it to the docs-site nav.

## Don't confuse the two doc systems

- `tools/docs-site/` = the **published, human-facing** standard docs.
- `docs/wiki/` = **internal** dev/agent knowledge base (this file points there).
