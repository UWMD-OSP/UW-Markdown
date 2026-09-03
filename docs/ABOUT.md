# About UW Markdown

UW Markdown is an open standard for commercial real-estate underwriting
data: one canonical, human-readable record per deal that AI agents,
deterministic calculation engines, spreadsheets, and underwriting platforms
can all read, verify, and extend without losing provenance. The format is
Markdown with typed JSON sections (`.uwx.md`, plus a minimal `.uw.md` Lite),
governed by a normative format spec, a protocol for conforming tools, JSON
Schemas, and a conformance corpus that pins behavior with hundreds of
executable assertions.

## The problem it solves

Underwriting data today lives in spreadsheets, PDFs, and proprietary
platforms that cannot check each other's work. Numbers get retyped, models
disagree, and the reasoning behind an assumption is lost the moment a file
is exported. UW Markdown makes the *record itself* the interface: facts,
narrative, and provenance in one portable file, with math that any
conforming engine reproduces exactly.

## Three design commitments

**AI never does financial math.** Agents extract data and write narrative;
every NOI, DSCR, LTV, IRR, and waterfall number is computed by
deterministic calculation packs that the protocol pins to the digit. Two
independent implementations produce identical results — including
iterative ones like IRR and XIRR, whose bisection procedures are specified
normatively.

**State and verify, don't trust.** Complex structures — capital stacks,
lease-up schedules, dated cash-flow series, distribution waterfalls — are
*stated* in the document and *recomputed in full* by verifiers that never
trust the stated aggregates. A verdict is `verified`, `failed`, or
`unverifiable`; a promote split or an XIRR either reproduces or the
document says so.

**Provenance is append-only.** Edits supersede prior blocks rather than
destroying them; every block carries its `_meta` history. Verification
receipts attest that a deal's outputs follow from its inputs under a named,
versioned calculation pack, and blocks and receipts can be
cryptographically signed.

## What ships today

- **Format 2.0** and **Protocol 2.3.0** — the normative specs, with JSON
  Schemas for every cross-boundary type.
- **`@uwmd/core`** — the reference TypeScript library: parser, validator,
  renderer, byte-preserving editor, sandboxed calc engine, and every
  verifier. **`@uwmd/cli`** wraps it as the `uwmd` command.
  **`@uwmd/signing`** adds block and receipt signing.
  **`@uwmd/batch`** indexes a directory of deals and emits a corpus-level
  fact table for data-lake ingestion. All four are on npm.
- **Representations** — the same record round-trips through UW JSON,
  UW XML, and a CSV bundle, each with semantic digests; HTTP and MCP
  bindings define how services and AI agents exchange it.
- **Portfolio profiles** — a sidecar that relates deals, borrowers, loans,
  and properties across files, with registry-validated edges.
- **A conformance corpus** of executable fixture/expected pairs (377
  assertions and growing) that any implementation, in any language, can run
  through the language-agnostic conformance driver.

## The backbone, not the lake

UW Markdown deliberately stops at the record. It defines no storage
contract, no warehouse loaders, and no lake-layer aggregate math — those
belong to the platforms that consume the standard. What it contributes is
exactly what a data lake cannot retrofit later: canonical facts, stable
identity (semantic digests), and a verifiable trust chain (receipts) for
every row. The [data-lake guide](/guide/data-lake) shows the full pipeline
with nothing but the published CLI and DuckDB.

Commercial products build on the standard — [underwriter.cc](https://underwriter.cc)
is the first — but the standard itself is MIT-licensed and
vendor-neutral: no part of it depends on any vendor SDK, service, or
model provider.

## How it's governed

Changes to the specs go through an RFC process ([process and index](/about/rfcs/)),
currently under owner-led governance with a published
[roadmap](/about/roadmap) and [governance rules](/about/governance) that
define the path to collaborative governance. Every accepted RFC is
implemented against the conformance corpus before it is called done — and
when implementation contradicts the RFC, the RFC records the erratum.

## Start here

- [Build your first file](/tutorials/your-first-uwmd-file) — the hands-on
  introduction.
- [Format spec](/spec/format) and [protocol](/spec/protocol) — the
  normative contracts.
- [For AI and agents](/ai/) — prompts, skills, and the MCP binding.
- [Version matrix](/about/versions) — what version of what is current.
- [Source on GitHub](https://github.com/UWMD-OSP/UW-Markdown).
