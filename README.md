# UW Markdown

> An open interoperability standard for AI- and code-driven underwriting systems.

> **Release status:** `@uwmd/core@1.1.2` and `@uwmd/cli@1.1.3` are published on npm. The spec, schemas, and conformance corpus are stable at format 1.1 / protocol 1.2.

**Website:** [uwmd.org](https://uwmd.org) · **Source:** [github.com/UWMD-OSP/UW-Markdown](https://github.com/UWMD-OSP/UW-Markdown)

**UW Markdown** is a canonical underwriting record for commercial real-estate systems. It carries narrative, typed deal facts, deterministic calculations, validation, and append-only provenance in an open format that AI agents, services, editors, viewers, and internal platforms can all load.

A deal record is a **`.uwx.md`** file — the complete, lossless underwriting record. Colloquially it is "a UW Markdown document," much as a `.docx` is "a Word document." Its lossy sibling, **UW Lite** (`.uw.md`), is a constrained human-readable summary with its own [specification](spec/UW_LITE_SPEC_v1.md) — not an older version, and not deprecated. UWX is what a deal *is*; Lite is one way of showing it.

This repository is the home of the standard:

- [`spec/UW_FORMAT_SPEC_v1.md`](spec/UW_FORMAT_SPEC_v1.md) — the file format specification.
- [`spec/UW_PROTOCOL_v1.md`](spec/UW_PROTOCOL_v1.md) — the contract any conforming viewer, editor, calc host, or AI host must satisfy.
- [`packages/uwmd-core/`](packages/uwmd-core/) — `@uwmd/core`, the reference TypeScript library and CLI.
- [`conformance/`](conformance/) — fixtures and expected outputs implementers self-certify against.
- [`tools/`](tools/) — starter tools (single-file web viewer, VS Code extension, VitePress documentation site; more planned).
- [`examples/`](examples/) — sample `.uwx.md` deal files.

## Why a standard?

Underwriting is dominated by Excel models and Word credit memos that are
opaque to software, AI, and anyone outside the originator's firm. Every shop
reinvents the wheel. Every analyst rebuilds the same models. AI tools see
dollar signs as text and cap rates as 0.05.

UW Markdown is the same kind of move OpenAPI made for APIs and JSON Schema made
for data: a published, versioned, vendor-neutral underwriting contract. It lets
AI agents, calculation services, bank platforms, analyst tools, document
parsers, and internal credit systems load and exchange the same record without
losing fidelity. Its text form is a portability property, not the product
constraint.

## Quick start

**No clone needed** — install the scoped CLI package and scaffold or validate a deal file with:

```bash
npx @uwmd/cli init my-deal.uwx.md
npx @uwmd/cli validate my-deal.uwx.md
```

To work from source instead:

```bash
git clone https://github.com/UWMD-OSP/UW-Markdown.git
cd UW-Markdown
npm install
npm run build

# Parse and validate the example file
npm run cli -- parse examples/Parkview-Apts-Glendale-AZ.uwx.md
npm run cli -- validate examples/Parkview-Apts-Glendale-AZ.uwx.md
npm run cli -- convert examples/Parkview-Apts-Glendale-AZ.uwx.md --to uw-xml
npm run cli -- convert examples/Parkview-Apts-Glendale-AZ.uw.xml --to uw-json
```

To open the reference web viewer, point any browser at
[`tools/web-viewer/index.html`](tools/web-viewer/) and drop in a `.uwx.md` file.

## What ships in v1

- The format spec (`UW_FORMAT_SPEC_v1.md`) — 21 standard sections, validation rules, supersede semantics.
- The protocol spec (`UW_PROTOCOL_v1.md`) - four conformance tiers (Reader, Editor, Calc Host, Agent Host), display conventions, edit semantics, and module manifest. Tier 4 describes a host capability; it does not require Bancroft.
- `@uwmd/core` - parser, validator, renderer, runner, and an optional Claude-backed Bancroft reference agent suite.
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
- **Next** — additional asset-class calc packs, starting with hospitality.
- **v2 spec exploration** — locale negotiation, module signing, custom asset-class declarations, stochastic calcs, hospitality reference module. Each opens as an RFC under [`docs/rfcs/`](./docs/rfcs/).

## Who's building on it

- **[underwriter.cc](https://underwriter.cc)** — a customizable modular underwriting model builder, being rebuilt on top of UW Markdown. *(first public consumer)*

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
