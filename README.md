# UW Markdown

> An open interoperability standard for AI- and code-driven underwriting systems.

> **Release status:** see [`VERSIONS.md`](VERSIONS.md) for the current format, protocol and package versions. Each release publishes `@uwmd/core`, `@uwmd/cli`, `@uwmd/signing`, `@uwmd/batch`, `@uwmd/excel`, `@uwmd/report` and `@uwmd/lake` to npm with provenance, and from 4.1.0 `@uwmd/verify` first. From 4.0.0 the reference implementation reads Format 3.0 only (RFC 0081) and carries a single Protocol version (4.1.0 from 4.2.0); 3.0.0 is the last release that reads older formats.

**Website:** [uwmd.org](https://uwmd.org) · **Source:** [github.com/UWMD-OSP/UW-Markdown](https://github.com/UWMD-OSP/UW-Markdown)

**UW Markdown** is a canonical underwriting record for commercial real-estate systems. It carries narrative, typed deal facts, deterministic calculations, validation, and append-only provenance in an open format that AI agents, services, editors, viewers, and internal platforms can all load.

A deal record is a **`.uwx.md`** file — the complete, lossless underwriting record. Colloquially it is "a UW Markdown document," much as a `.docx` is "a Word document." Its lossy sibling, **UW Lite** (`.uw.md`), is a constrained human-readable summary with its own [specification](spec/UW_LITE_SPEC.md) — not an older version, and not deprecated. UWX is what a deal *is*; Lite is one way of showing it.

This repository is the home of the standard:

- [`spec/UW_FORMAT_SPEC.md`](spec/UW_FORMAT_SPEC.md) — the file format specification.
- [`spec/UW_PROTOCOL.md`](spec/UW_PROTOCOL.md) — UW Protocol — verification: how any party checks that a document is well formed, internally consistent and reproducible (Reader and Verifier tiers).
- [`spec/metrics/`](spec/metrics/README.md) — the normative metric dictionary that defines every builtin metric.
- [`packages/uwmd-verify/`](packages/uwmd-verify/) — `@uwmd/verify`, the reference TypeScript implementation of the standard: read and verify a `.uw.md` with nothing else installed.
- [`packages/uwmd-core/`](packages/uwmd-core/) — `@uwmd/core`, the reference TypeScript library and CLI: the starter toolkit on top of `@uwmd/verify`, whose whole API it re-exports.
- [`conformance/`](conformance/) — fixtures and expected outputs implementers self-certify against.
- [`tools/`](tools/) — starter tools (single-file web viewer, VS Code extension, VitePress documentation site; more planned). The calc engine, editor, viewer, Excel exporter, defaults and AI agents are non-normative starter products ([`docs/starter/`](docs/starter/README.md)).
- [`examples/`](examples/) — sample deal files covering all twelve builtin asset classes in `.uwx.md` plus a UW Lite `.uw.md` summary. `Parkview-Apts-Glendale-AZ`
  exists in **both** representations, so the two can be read side by side.

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
npx @uwmd/cli init --output my-deal.uwx.md
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

# The same deal as a UW Lite summary, and what compiling it costs you
npm run cli -- validate examples/Parkview-Apts-Glendale-AZ.uw.md
npm run cli -- convert  examples/Parkview-Apts-Glendale-AZ.uw.md --to uwx --stdout
```

### Verify a document

Verifying means checking that a document is well formed, that its stated
figures recompute from its own inputs, and that its receipts and signatures
hold ([Protocol](spec/UW_PROTOCOL.md) §I). A party that only verifies needs
`@uwmd/verify` and nothing else:

```bash
npm install @uwmd/verify
```

[`examples/verification/`](examples/verification/README.md) has four
runnable scripts with their expected results: a valid document, a wrong
stated metric, a tampered receipt and a failed document signature. From the
CLI, `uwmd receipt issue <file>` and `uwmd receipt verify <file>
<receipt.json>` check that a record still produces its stated results (exit
0 verified, 1 failed, 3 unverifiable).

To open the reference web viewer, point any browser at
[`tools/web-viewer/index.html`](tools/web-viewer/) and drop in a `.uwx.md` file.

## What ships in v1

- The format spec (`UW_FORMAT_SPEC.md`) — 21 standard sections, validation rules, supersede semantics.
- The protocol spec (`UW_PROTOCOL.md`) - how any party verifies a document: two conformance tiers (Reader, Verifier) plus optional verification profiles, the provenance rules, and the module manifest (Protocol 4.1.0; RFCs 0078, 0081 and 0084). Display, editing, defaults and the AI agent host are non-normative starter-product guidance in [`docs/starter/`](docs/starter/README.md).
- `@uwmd/core` - parser, validator, renderer, runner, and an optional Claude-backed Bancroft reference agent suite.
- A conformance corpus per tier so third parties can self-certify.
- A single-file web viewer demonstrating a Reader in <500 LOC.

## Roadmap

The full, status-tracked roadmap lives in [ROADMAP.md](./ROADMAP.md). Highlights:

- **Shipped in v1** — Tier-1/2/3 implementation, the conformance runner, the JSON
  Schemas, and the tool set (VS Code extension, docs site, web editor, Excel
  converter, PDF report pipeline, standalone CLI).
- **Shipped in v1.1** — machine interchange: a shared document envelope with
  lossless JSON, XML, and normalized CSV-bundle codecs, plus HTTP/MCP companion
  bindings, under accepted [RFC 0014](./docs/rfcs/0014-multi-format-interchange.md).
- **Next** — additional asset-class calc packs, starting with hospitality.
- **v2 spec exploration** — locale negotiation, lease-up modeling, `_meta` v2, portfolio relationships. Each opens as an RFC under [`docs/rfcs/`](./docs/rfcs/). The signing chain shipped 2026-08-27: signed blocks ([RFC 0010](./docs/rfcs/0010-signed-blocks.md), protocol §V.11) and module signatures ([RFC 0002](./docs/rfcs/0002-module-signing.md), protocol §X.1), both on the optional [`@uwmd/signing`](./packages/uwmd-signing/) package; core stays crypto-free. A language-agnostic conformance driver ([RFC 0004](./docs/rfcs/0004-conformance-runner-v2.md), protocol §II.6a) shipped alongside, so an implementation in any language can self-certify against the same corpus — see [`conformance/runner/`](./conformance/runner/README.md). And [RFC 0006](./docs/rfcs/0006-hospitality-module.md) gave the module system its first real consumer, a hospitality module, plus the runtime that actually executes what a module declares; RFC 0080 later folded hospitality into core as a builtin. [RFC 0003](./docs/rfcs/0003-module-asset-classes.md) then let a module declare its own **asset class** — third-party classes have a namespaced space. [RFC 0080](./docs/rfcs/0080-official-classes-are-builtins.md) makes all official classes full builtins: twelve equal standard and starter surfaces, with future official additions by RFC.

## Who's building on it

- **[underwriter.cc](https://underwriter.cc)** — a customizable modular underwriting model builder, being rebuilt on top of UW Markdown. *(first public consumer)*

If you're building a tool on the format, open a PR to add yourself here.

## Contributing

Patches, spec proposals, conformance fixtures, and tools are all welcome.
See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to file a spec change, add a
conformance fixture, or propose a new tool. If you build on the format, see
[Reporting problems and feedback](./docs/FEEDBACK.md) for how to file a
reproducible report without exposing deal data.

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md).

## Project documents

- [ROADMAP.md](./ROADMAP.md) — what's planned, what's shipped, what's deferred.
- [GOVERNANCE.md](./GOVERNANCE.md) — decision-making model and RFC process.
- [MAINTAINERS.md](./MAINTAINERS.md) — current maintainers and areas of ownership.
- [SECURITY.md](./SECURITY.md) — how to report a vulnerability.
- [CHANGELOG.md](./CHANGELOG.md) — release-by-release history.
- [UW XML Mapping 1.0](./spec/UW_XML_MAPPING.md) — deterministic, lossless XML representation and secure decoding rules.
- [UW CSV Bundle 1.0](./spec/UW_CSV_BUNDLE.md) — normalized CSV tables, deterministic ZIP, safe extraction, and named views.
- [HTTP Binding 1.0](./spec/bindings/UW_HTTP_BINDING_v1.md) and [MCP Binding 1.0](./spec/bindings/UW_MCP_BINDING_v1.md) — API negotiation, semantic ETags, stable resources, and AI-friendly tool results.
- [1.1+ interchange release plan](./docs/releases/1.1-plus-interchange-plan.md) —
  governance gates and phased delivery for JSON, XML, CSV, API, and MCP.

## License

[MIT](./LICENSE) © UW Markdown contributors.
