# UW Markdown — documentation site

[VitePress](https://vitepress.dev) build of the spec, protocol, schemas,
conformance corpus, and project documents. It is published at
[uwmd.org](https://www.uwmd.org) by the Cloudflare Worker `uwmd-org`
(static assets only; see [Hosting](#hosting-cloudflare-workers)).

## How it works

Repo-root markdown files (`spec/`, `conformance/`, `ROADMAP.md`, etc.) are
the single source of truth. `scripts/prebuild.mjs` copies them into this
site's tree on every dev/build, rewriting relative links to site URLs.

The copied trees (`spec/`, `conformance/`, `about/`) are gitignored — they
exist only at build time.

Generated Markdown carries its repository source path as site-only metadata.
The GitHub edit link uses that path; authored pages point into `tools/docs-site/`.
This keeps contribution links on the original files rather than generated copies.
`public/` is excluded from Markdown page discovery: its files remain downloads,
without duplicate HTML pages or search/sitemap entries for static asset inputs.

`.vitepress/discovery.mjs` adds canonical URLs and page-specific Open Graph and
Twitter metadata, including on client navigation. The 404 page is `noindex`;
the layout owns that tag's client lifecycle and removes it on normal pages.
`static/robots.txt` points crawlers at the sitemap; Cloudflare may prepend its
managed directives. `static/security.txt` mirrors the published Security Policy
at `/.well-known/security.txt`; review its expiry before 2027-10-01. Both are
copied by `prepare-public.mjs` with UTF-8 plain-text response headers. This is a
documentation site, without an installable-app manifest.

The homepage uses `theme/ReactiveBackdrop.vue` for its decorative gradient.
The bounded low-resolution canvas uses ordered dithering for a fine pixel
texture, with at most about 20 updates per second. It responds to pointer
movement and scroll position, pauses in hidden tabs,
and stays static for reduced motion. Its frame, listeners and theme observer are disposed when
leaving the homepage. The theme initially uses dark appearance and retains the
persisted appearance control; documentation body text stays sans-serif.

## Develop

```bash
cd tools/docs-site
npm ci
npm run dev       # localhost:5173
```

## Build

```bash
npm run build     # output: .vitepress/dist/
npm run preview   # serve the built site locally
```

## Update content

Edit copied content in its repository source file, and authored site pages in
this directory. Restart `npm run dev` after changing a copied source so prebuild
refreshes it.

Every `docs/rfcs/*.md` file is discovered automatically in sorted order, including
new drafts. `README.md` becomes the RFC index and `0000-template.md` keeps its
template URL. Add the RFC to `docs/rfcs/README.md` so readers can find it; no
prebuild edit is needed. `npm run verify-indexes` checks linked files and tests
discovery of a future RFC. RFC status banners still come from frontmatter.

For other new pages, add a `COPIES` entry in `scripts/prebuild.mjs` and a nav or
sidebar entry in `.vitepress/config.ts`. The home version line reads Format,
Protocol and Receipt versions through `scripts/docs-site-sources.mjs`; the
sidebar and generated titles use the same sources. Package details live on
Versions. The Downloads "on npm" list uses the newest CHANGELOG generation marked
`### Released`, through `scripts/release-packages.mjs`.

## Hosting (Cloudflare Workers)

uwmd.org is served by the Cloudflare Worker `uwmd-org`. The repository-root
`wrangler.jsonc` serves the VitePress output as static assets. There is no Worker
script or SPA fallback: unknown routes return VitePress's `404.html` with HTTP
404. Cloudflare is the only host; there is no other deployment configuration in
the repository.

To reproduce the production build and check routing locally, from the repository
root, use the Node version in `.nvmrc`:

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

### Project settings

The Workers Git project for `UWMD-OSP/UW-Markdown` is owner-managed: account
access, Git authorization, the custom domains and DNS are the owner's. Its
settings, which this table should mirror:

| Setting | Value |
| --- | --- |
| Worker name | `uwmd-org` (must match `wrangler.jsonc`) |
| Root directory | Repository root (`/`) |
| Production branch | `main` |
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
trigger it under the configured build policy; manually trigger a build when
those inputs need publishing.

`uwmd.org` and `www.uwmd.org` are attached to the Worker; canonical links use
`www.uwmd.org`. When checking a preview or a fresh deployment, cover `/`,
`/spec/format`, `/editor/`, the downloads, `/llms.txt`, and an unknown path
returning 404 (`test:cloudflare` checks the same routes locally).

Reference: [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/),
[watch paths](https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/),
[build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/),
[static routing](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/),
and [headers](https://developers.cloudflare.com/workers/static-assets/headers/).

## Roadmap

See the repository [roadmap](../../ROADMAP.md) for growth paths. The current
site includes a browser viewer, reference editor and local search. A build
generates `sitemap.xml` with the canonical `https://www.uwmd.org` hostname.
