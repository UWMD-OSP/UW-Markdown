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
- [`tools/`](tools/) — starter tools (single-file web viewer, VS Code extension, VitePress documentation site; more planned). The calc engine, editor, viewer, Excel exporter, defaults and host integration guidance are non-normative starter products ([`docs/starter/`](docs/starter/README.md)).
- [`examples/`](examples/) — sample deal files covering all twelve builtin asset classes in `.uwx.md` plus a UW Lite `.uw.md` summary. `Parkview-Apts-Glendale-AZ`
  exists in **both** representations, so the two can be read side by side.

Read the [foundation](docs/FOUNDATION.md), [growth paths](docs/HOW-UWMD-GROWS.md),
[document types](docs/document-types.md) and [known limits](docs/KNOWN-LIMITS.md)
for the current boundary and how to extend it.

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

The npm quickstart exercises the published package. Main contains newer
unpublished work with the same prelaunch package numbers. For current source
contracts, use the source workflow below and record `git rev-parse HEAD`; a
version string alone does not identify that code.

**No clone needed** — install the scoped CLI package and scaffold or validate a deal file with:

```bash
npx @uwmd/cli init --output my-deal.uwx.md
npx @uwmd/cli validate my-deal.uwx.md
```

`init` writes a blank scaffold. Fill the stated facts before expecting clean
validation, including the matching address/class in frontmatter and `property`.
Choose a stage the inputs actually satisfy. When checking a figure, confirm its
named evidence entry is `verified`; a zero exit or zero failures does not prove
that a package checked that assertion. Current source and older registry
artifacts can have different coverage despite sharing a prelaunch version.


To work from source instead (Node.js 20 or later for development builds and tests):

```bash
git clone https://github.com/UWMD-OSP/UW-Markdown.git
cd UW-Markdown
npm ci
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

The optional RFC 0092 pro-forma profile is supported by the reference CLI and
public library, with independent proof frozen at source commit `e2bd0067`.
Read [the scope and tested runtimes](docs/wiki/03-core-library.md#rfc-0092-support-scope)
before using that claim; older npm code with the same package version is not
that frozen source. Pro-forma has no MCP or HTTP binding yet.

To open the reference web viewer, point any browser at
[`tools/web-viewer/index.html`](tools/web-viewer/) and drop in a `.uwx.md` file.

## What is built

- The format spec (`UW_FORMAT_SPEC.md`) — registered sections, validation rules and supersede semantics.
- The protocol spec (`UW_PROTOCOL.md`) - how any party verifies a document: two conformance tiers (Reader, Verifier) plus optional verification profiles, the provenance rules, and the module manifest (Protocol 4.1.0; RFCs 0078, 0081 and 0084). Display, editing, defaults, the agent writer conventions, the CLI and the renderers are non-normative starter-product guidance in [`docs/starter/`](docs/starter/README.md).
- `@uwmd/core` - parser, validator, renderer, the generic block writers and the context profiles. It runs no agent; a host runs its own and writes through the writers or the edit API.
- A conformance corpus per tier so third parties can self-certify.
- A single-file web viewer for inspecting records in a browser.

## Roadmap

The [roadmap](ROADMAP.md) separates published artifacts, current source and
future proposals. All twelve official asset classes already have full builtin
support, including hospitality. The base Python Verifier is complete; bounded
pro-forma support is scoped to the CLI/public library at the documented source.
New document families and optional procedures follow the
[growth playbooks](docs/HOW-UWMD-GROWS.md), with acceptance and conformance before
support is claimed. Planned types are not delivery promises. There is no
adoption target; maintenance after launch follows filed issues.

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

- [ROADMAP.md](./ROADMAP.md) — forward-looking growth paths and current boundaries.
- [GOVERNANCE.md](./GOVERNANCE.md) — decision-making model and RFC process.
- [MAINTAINERS.md](./MAINTAINERS.md) — current maintainers and areas of ownership.
- [SECURITY.md](./SECURITY.md) — how to report a vulnerability.
- [CHANGELOG.md](./CHANGELOG.md) — unreleased changes and the 4.x release summary; full release notes are on GitHub Releases.
- [UW XML Mapping 2.0](./spec/UW_XML_MAPPING.md) — deterministic, lossless XML representation and secure decoding rules.
- [UW Document Envelope 2.0](./spec/UW_ENVELOPE.md) — complete model, tagged extensions and coordinated subject identities.
- [UW CSV Bundle 2.0](./spec/UW_CSV_BUNDLE.md) — normalized CSV tables, deterministic ZIP, safe extraction, and named views.
- [HTTP Binding 1.0](./spec/bindings/UW_HTTP_BINDING_v1.md) and [MCP Binding 1.0](./spec/bindings/UW_MCP_BINDING_v1.md) — API negotiation, semantic ETags, stable resources, and AI-friendly tool results.

## License

[MIT](./LICENSE) © UW Markdown contributors.

### Identify a source build

After installing dependencies, build a clean committed checkout with
`node scripts/build-source.mjs`. `node packages/uwmd-cli/bin/uwmd.mjs --version`
then prints each declared library version plus `+source.<full-commit>`.
`node packages/uwmd-cli/bin/uwmd.mjs build-info` prints JSON containing both the
full source commit and source tree. The same metadata is available as
`BUILD_INFO`/`BUILD_VERSION` from core and
`VERIFY_BUILD_INFO`/`VERIFY_BUILD_VERSION` from verify, including browser entries.

Plain `npm run build` is still supported and deliberately prints
`+source.unknown`; a Gitless source archive is also unidentified. The identified
builder refuses uncommitted source or a source change during the build. No Git
lookup occurs when a consumer runs the CLI or imports a package. This metadata
does not change package manifests, dependency identities or receipt versions,
and does not authenticate a compiler invocation or label an artifact a release.
