# Reference Tier-1 Viewer

A single static HTML file that demonstrates a fully conformant
[Tier-1 Reader](../../spec/UW_PROTOCOL_v1.md) of the UW Markdown protocol
in under 500 lines of code.

**This is a reference, not a product.** It exists to prove that a
conforming reader is implementable in a weekend and to show the
shape of the Reader contract end-to-end. For a production-grade
viewer or editor, see the planned starter tools in the top-level
[`README.md`](../../README.md#roadmap), or build your own — that's
the whole point of an open standard.

## Run it

Open `index.html` in any modern browser. No build step, no install,
no network calls — everything runs locally.

```bash
# from repo root
open tools/web-viewer/index.html       # macOS
start tools/web-viewer/index.html      # Windows
xdg-open tools/web-viewer/index.html   # Linux
```

Drop any `.uw.md` file onto the drop zone (try
[`examples/Parkview-Apts-Glendale-AZ.uwx.md`](../../examples/Parkview-Apts-Glendale-AZ.uwx.md)).

## What it demonstrates

- Frontmatter parsing (deal name, address, asset class, recommendation, flags).
- Quick-metrics panel with canonical display formatting:
  currency `$1,234,567`, percent `5.51%`, ratio `1.234x`, null `n/a`.
- Section cards driven by `BUILTIN_VIEW_MODELS` from
  [`packages/uwmd-core/src/protocol.ts`](../../packages/uwmd-core/src/protocol.ts).
- Click-to-expand detail rows.
- Pipeline state timeline.
- Active and blocking flag panels with severity styling.
- Supersede-history summary count per section.

## What it deliberately omits

This is the minimum bar. It does not:

- Validate cross-section consistency (CC-01..CC-10) — see `validateUWFile`
  in `@uwmd/core` for that.
- Render every standard section — only the eight most-displayed ones have
  view models inlined here. The full registry is in `protocol.ts`.
- Edit. That requires Tier-2.
- Evaluate `custom_calculations`. That requires Tier-3.
- Run agents. That requires Tier-4.
