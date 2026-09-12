# UW Markdown — documentation site

[VitePress](https://vitepress.dev) build of the spec, protocol, schemas,
conformance corpus, and project documents.

## How it works

Repo-root markdown files (`spec/`, `conformance/`, `ROADMAP.md`, etc.) are
the single source of truth. `scripts/prebuild.mjs` copies them into this
site's tree on every dev/build, rewriting relative links to site URLs.

The copied trees (`spec/`, `conformance/`, `about/`) are gitignored — they
exist only at build time.

## Develop

```bash
cd tools/docs-site
npm install
npm run dev       # localhost:5173
```

## Build

```bash
npm run build     # output: .vitepress/dist/
npm run preview   # serve the built site locally
```

## Update content

Edit the source files at the repo root. Re-run `npm run dev` (or just save
in dev mode — the prebuild step runs again automatically when you restart).

Every `docs/rfcs/*.md` file is discovered automatically in sorted order, including
new drafts. `README.md` becomes the RFC index and `0000-template.md` keeps its
template URL. Add the RFC to `docs/rfcs/README.md` so readers can find it; no
prebuild edit is needed. `npm run verify-indexes` checks linked files and tests
discovery of a future RFC. RFC status banners still come from frontmatter.

For other new pages, add a `COPIES` entry in `scripts/prebuild.mjs` and a nav or
sidebar entry in `.vitepress/config.ts`. The home release card, protocol sidebar
label, and generated protocol title read the package manifest and protocol
constants through `scripts/docs-site-sources.mjs`; they do not carry version pins.

## Deploy

The repository-root `vercel.json` builds this package and serves
`.vitepress/dist/` as a static site. The canonical hostname is `uwmd.org`.

## Roadmap

- Interactive playground — drop a `.uw.md`, see parse + render output.
  Requires bundling `@uwmd/core` for the browser.
- Versioned spec navigation — once v2 RFCs land.
- Search backed by Algolia DocSearch (currently uses local search).
