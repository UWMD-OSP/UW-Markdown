# UW Markdown

> An open standard for underwriting documents — readable by humans, AI tools, and software alike.

> **Release status:** `@uwmd/core` is published; the CLI is distributed as `@uwmd/cli` — build
> from source using the quick start below. The spec, schemas, and conformance
> corpus are stable at format 1.1 / protocol 1.2.

**Website:** [uwmd.org](https://uwmd.org) · **Source:** [github.com/jaredmaxey/uw-markdown](https://github.com/jaredmaxey/uw-markdown)

**`.uw.md`** is a Markdown-based file format for commercial real-estate underwriting deals. It pairs human-readable prose with structured JSON blocks, supports an append-only update history, validates against published consistency rules, and bundles cleanly into context for AI agents.

This repository is the home of the standard:

- [`spec/UW_FORMAT_SPEC_v1.md`](spec/UW_FORMAT_SPEC_v1.md) — the file format specification.
- [`spec/UW_PROTOCOL_v1.md`](spec/UW_PROTOCOL_v1.md) — the contract any conforming viewer, editor, calc host, or AI host must satisfy.
- [`packages/uwmd-core/`](packages/uwmd-core/) — `@uwmd/core`, the reference TypeScript library and CLI.
- [`conformance/`](conformance/) — fixtures and expected outputs implementers self-certify against.
- [`tools/`](tools/) — starter tools (single-file web viewer, VS Code extension, VitePress documentation site; more planned).
- [`examples/`](examples/) — sample `.uw.md` deal files.

## Why a standard?

Underwriting is dominated by Excel models and Word credit memos that are
opaque to software, AI, and anyone outside the originator's firm. Every shop
reinvents the wheel. Every analyst rebuilds the same models. AI tools see
dollar signs as text and cap rates as 0.05.

`.uw.md` is the same kind of move CommonMark made for prose, OpenAPI made for
APIs, and JSON Schema made for data: a published, versioned, vendor-neutral
text format that lets every tool — bank platforms, analyst spreadsheets,
document parsers, AI assistants, internal credit systems — read and write the
same files without losing fidelity.

## Quick start

**No clone needed** — install the scoped CLI package and scaffold or validate a deal file with:

```bash
npx @uwmd/cli init my-deal.uw.md
npx @uwmd/cli validate my-deal.uw.md
```

To work from source instead:

```bash
git clone https://github.com/jaredmaxey/uw-markdown.git
cd uw-markdown
npm install
npm run build

# Parse and validate the example file
npm run cli -- parse examples/Parkview-Apts-Glendale-AZ.uw.md
npm run cli -- validate examples/Parkview-Apts-Glendale-AZ.uw.md
npm run cli -- convert examples/Parkview-Apts-Glendale-AZ.uw.md --to uw-xml
npm run cli -- convert examples/Parkview-Apts-Glendale-AZ.uw.xml --to uw-json
```

To open the reference web viewer, point any browser at
[`tools/web-viewer/index.html`](tools/web-viewer/) and drop in a `.uw.md` file.

## What ships in v1

- The format spec (`UW_FORMAT_SPEC_v1.md`) — 21 standard sections, validation rules, supersede semantics.
- The protocol spec (`UW_PROTOCOL_v1.md`) — four conformance tiers (Reader, Editor, Calc Host, Agent Host), display conventions, edit semantics, module manifest.
- `@uwmd/core` — parser, validator, renderer, runner, Claude-based agent host.
- A conformance corpus per tier so third parties can self-certify.
- A single-file web viewer demonstrating Tier-1 conformance in <500 LOC.

## Roadmap

The full, status-tracked roadmap lives in [ROADMAP.md](./ROADMAP.md). Highlights:

- **Shipped in v1** — Tier-1/2/3 implementation, the conformance runner, the JSON
  Schemas, and the tool set (VS Code extension, docs site, web editor, Excel
  converter, PDF report pipeline, standalone CLI).
- **Shipped in v1.1** — machine interchange: a shared document envelope with
  lossless JSON, XML, and normalized CSV-bundle codecs, plus HTTP/MCP companion
  bindings, under accepted [RFC 0014](./docs/rfcs/0014-multi-format-interchange.md).
- **Next** — npm publication of the `@uwmd/cli` command launcher, and additional
  asset-class calc packs.
- **v2 spec exploration** — locale negotiation, module signing, custom asset-class declarations, stochastic calcs, hospitality reference module. Each opens as an RFC under [`docs/rfcs/`](./docs/rfcs/).

## Who's building on it

- **[underwriter.cc](https://underwriter.cc)** — a customizable modular underwriting model builder, being rebuilt on top of `.uw.md`. *(first public consumer)*

If you're building a tool on the format, open a PR to add yourself here.

## Contributing

Patches, spec proposals, conformance fixtures, and tools are all welcome.
See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to file a spec change, add a
conformance fixture, or propose a new tool.

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md).

## Project documents

- [ROADMAP.md](./ROADMAP.md) — what's planned, what's shipped, what's deferred.
- [GOVERNANCE.md](./GOVERNANCE.md) — decision-making model and RFC process.
- [MAINTAINERS.md](./MAINTAINERS.md) — current maintainers and areas of ownership.
- [SECURITY.md](./SECURITY.md) — how to report a vulnerability.
- [CHANGELOG.md](./CHANGELOG.md) — release-by-release history.
- [UW XML Mapping 1.0](./spec/UW_XML_MAPPING_v1.md) — deterministic, lossless XML representation and secure decoding rules.
- [UW CSV Bundle 1.0](./spec/UW_CSV_BUNDLE_v1.md) — normalized CSV tables, deterministic ZIP, safe extraction, and named views.
- [HTTP Binding 1.0](./spec/bindings/UW_HTTP_BINDING_v1.md) and [MCP Binding 1.0](./spec/bindings/UW_MCP_BINDING_v1.md) — API negotiation, semantic ETags, stable resources, and AI-friendly tool results.
- [1.1+ interchange release plan](./docs/releases/1.1-plus-interchange-plan.md) —
  governance gates and phased delivery for JSON, XML, CSV, API, and MCP.

## License

[MIT](./LICENSE) © UW Markdown contributors.
