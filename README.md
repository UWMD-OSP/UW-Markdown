# UW Markdown

> An open standard for underwriting documents — readable by humans, AI tools, and software alike.

**`.uw.md`** is a Markdown-based file format for commercial real-estate underwriting deals. It pairs human-readable prose with structured JSON blocks, supports an append-only update history, validates against published consistency rules, and bundles cleanly into context for AI agents.

This repository is the home of the standard:

- [`spec/UW_FORMAT_SPEC_v1.md`](spec/UW_FORMAT_SPEC_v1.md) — the file format specification.
- [`spec/UW_PROTOCOL_v1.md`](spec/UW_PROTOCOL_v1.md) — the contract any conforming viewer, editor, calc host, or AI host must satisfy. *(in progress)*
- [`packages/uwmd-core/`](packages/uwmd-core/) — `@uwmd/core`, the reference TypeScript library and CLI.
- [`conformance/`](conformance/) — fixtures and expected outputs implementers self-certify against. *(in progress)*
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

```bash
git clone https://github.com/jaredmaxey/Underwriting-Markdown-Private-1.0.git
cd Underwriting-Markdown-Private-1.0
npm install
npm run build

# Parse and validate the example file
node packages/uwmd-core/dist/cli.js parse examples/Parkview-Apts-Glendale-AZ.uw.md
node packages/uwmd-core/dist/cli.js validate examples/Parkview-Apts-Glendale-AZ.uw.md
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

- **v1 release blockers** — Tier-2/3 implementation, conformance runner, JSON Schemas, governance scaffolding (this PR), npm publish.
- **v1 follow-on tools** — VS Code extension → docs site → web editor → Excel converter → standalone CLI.
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

## License

[MIT](./LICENSE) © UW Markdown contributors.
