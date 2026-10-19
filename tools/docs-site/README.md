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
sidebar entry in `.vitepress/config.ts`. The home standard card reads Format,
Protocol and Receipt versions through `scripts/docs-site-sources.mjs`; the
sidebar and generated titles use the same sources. Package details live on
Versions. The Downloads "on npm" list uses the newest CHANGELOG generation marked
`### Released`, through `scripts/release-packages.mjs`.

## Cloudflare Workers static hosting

The repository-root `wrangler.jsonc` serves the VitePress output as static assets.
There is no Worker script or SPA fallback: unknown routes return VitePress's
`404.html` with HTTP 404. Existing Vercel configuration stays in place until the
owner cuts over the host; adding this configuration does not deploy anything.

From the repository root, use the Node version in `.nvmrc`:

```bash
npm ci
npm --prefix tools/docs-site ci
npm --prefix tools/web-editor ci
npm --prefix tools/docs-site run build:cloudflare
npx --yes wrangler@4.151.1 deploy --dry-run
npx --yes wrangler@4.151.1 dev --local
# In another terminal: npm --prefix tools/docs-site run test:cloudflare
```

The build includes the reference verifier, core, editor, viewer, templates and
other downloads before rendering the site. `static/_headers` is copied through
`public/` into the asset directory, preserving the text and download headers.
Wrangler is an explicitly pinned CLI command; no new application dependency or
package version is introduced. The docs-site GitHub workflow builds and tests
local Workers routing without credentials or a deployment.

### Owner project setup and cutover

Create a Workers Git project for `UWMD-OSP/UW-Markdown` with these settings:

| Setting | Value |
| --- | --- |
| Worker name | `uwmd-org` (must match `wrangler.jsonc`) |
| Root directory | Repository root (`/`) |
| Initial build branch | `codex/site-cloudflare-migration` |
| Build variable | `SKIP_DEPENDENCY_INSTALL=1` |
| Build command | `npm ci && npm --prefix tools/docs-site ci && npm --prefix tools/web-editor ci && npm --prefix tools/docs-site run build:cloudflare` |
| Deploy command | `npx --yes wrangler@4.151.1 deploy` |
| Build watch paths — includes | `tools/docs-site/*`, `docs/*` |
| Build watch paths — excludes | Empty |

Set the watch paths under **Settings → Build → Build watch paths**. These are
Workers Builds project settings, not `build.watch_dir` in Wrangler (that field
only watches local development). Ordinary pushes with no matching changed file
skip the site build. Cloudflare bypasses this filter for empty pushes and pushes
containing at least 3,000 files or 20 commits. Other build inputs, including
`spec/`, `packages/`, root Markdown and build configuration, intentionally do not
trigger it under the owner's selected policy; manually trigger a build when
those inputs need publishing.

The owner supplies account/Git authorization and creates the project. Validate
the provided preview URL, including `/`, `/spec/format`, `/editor/`, downloads,
`/llms.txt`, and an unknown path returning 404, before attaching `uwmd.org` and
`www.uwmd.org` and changing DNS. The existing canonical `www.uwmd.org` links stay
unchanged. The owner controls the final build branch and DNS/cutover timing;
Vercel configuration and deployment remain until that cutover is complete.

Reference: [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/),
[watch paths](https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/),
[build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/),
[static routing](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/),
and [headers](https://developers.cloudflare.com/workers/static-assets/headers/).

## Roadmap

- Interactive playground — drop a `.uwx.md`, see parse + render output.
  Requires bundling `@uwmd/core` for the browser.
- Versioned spec navigation — once v2 RFCs land.
- Search backed by Algolia DocSearch (currently uses local search).
