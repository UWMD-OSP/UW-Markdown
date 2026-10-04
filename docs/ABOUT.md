# About UW Markdown

UW Markdown is an open standard for commercial real-estate underwriting. Its
central artifact is the **`.uwx.md` record**: one plain-text file per deal that
holds the structured deal facts, the underwriting assumptions, the calculation
inputs, the credit narrative, and the provenance of each piece. Spreadsheets,
AI agents, underwriting applications, and data pipelines can all read the same
record and check one another's work.

## The problem

A typical deal passes through a rent roll in one spreadsheet, a T-12 in a PDF,
an underwriting model in another workbook, a credit memo in a word processor,
and eventually a row in someone's database. Each hand-off retypes numbers. Each
copy can disagree with the others. The reason behind an assumption, such as why
vacancy was normalized to 7% or why taxes were reassessed, lives in an email or
in the analyst's head, and it is lost on export.

AI makes this both better and worse. Models are good at reading documents and
drafting narrative. They are not a dependable source of financial arithmetic,
and a figure a model "calculated" cannot be audited.

UW Markdown makes the record itself the interface. Facts, reasoning, and
history travel together in one file. Every financial result is something any
conforming tool can recompute, rather than something you have to trust.

## What a UWX record contains

A `.uwx.md` file is Markdown with typed JSON blocks. A person can read it top
to bottom like a memo, and software can parse each block against a published
schema.

| Underwriting concept | Where it lives in the record |
|---|---|
| Property, ownership, rent roll, T-12 | Typed sections such as `property`, `rent_roll`, `operating_statement` |
| Market and underwritten assumptions | `noi_model`, `assumptions`, `market_analysis`, with a rationale beside each figure |
| Debt structure and sizing | `debt_structure`, `preliminary_sizing`, `capital_stack` |
| Cash flows and returns | `dcf`, `lease_up_schedule`, `distribution_waterfall` |
| Credit narrative | Ordinary Markdown prose between the blocks, plus `risk_assessment` |
| Who wrote what, when, from which source | The `_meta` object on every block, with append-only revisions |

The [format specification](/spec/format-v2) defines every section. The
[UWX and UW Lite guide](/guide/lite-and-uwx) explains how the complete record
relates to the compact Lite summary.

## Where it fits in an underwriting stack

```text
 Source documents ─┐
 Analyst or AI ────┼──▶  .uwx.md record  ──▶  Deterministic calculation  ──▶  Excel workbook
 Applications ─────┘    (facts, assumptions,   and verification               Credit memo / lender package
                         narrative, provenance)  (validate, compute,           Underwriting platform
                                                  issue receipts)              APIs and services
                                                                               Portfolio analytics / data lake
```

UW Markdown does not replace the spreadsheet, the underwriting platform, or the
warehouse. It is the record those systems exchange. An analyst can keep
modeling in Excel, an application can keep its own interface, and an agent can
keep its own prompts. What they share is the deal record and the rules for
computing from it.

## How deterministic calculation works

**AI never does the financial math.** Agents and parsers may extract facts,
classify them, flag gaps, and draft narrative. NOI, DSCR, LTV, debt yield, cap
rate, IRR, and waterfall splits are computed by deterministic code: a sandboxed
expression engine evaluating versioned **calculation packs**, one per asset
class.

The protocol pins the numeric model, including the rounding rule and the
precision each kind of figure is quantized to (Protocol §VIII.5). Any conforming
implementation that evaluates the same pack over the same inputs must produce
the same quantized values. The [conformance corpus](/conformance/) states those
expectations as fixture and expected-output pairs, and its language-agnostic
runner can test an implementation written in any language.

Complex structures such as capital stacks, lease-up schedules, dated cash-flow
series, and distribution waterfalls are *stated* in the record and *recomputed
in full* by verifiers that never trust the stated totals. The verdict is
`verified`, `failed`, or `unverifiable`.

The Excel exporter writes derived metrics as live workbook formulas driven by
the same pack. Where the export covers a metric, the recalculated workbook
matches the engine's quantized value exactly.

## How provenance and verification work

**Provenance is append-only.** Each block's `_meta` records the source, the
actor (a person, the system, or an agent), the timestamp, and the confidence. An
edit supersedes the earlier block instead of overwriting it, so the history
stays in the file.

**Verification receipts** are detached JSON files issued on request. A receipt
binds the record's financial content to the outputs of a named, versioned
calculation pack. Anyone can recompute it offline. A verified receipt shows two
things: the financial content is unchanged since issuance, and the stated
metrics follow from it. It does not show that the inputs are true, complete, or
reasonable; whether the rent roll is real is still a diligence question. Editing
a record never issues a receipt automatically. See
[verification receipts](/guide/receipts).

**Signing** is a separate capability. The optional `@uwmd/signing` package signs
individual blocks and receipts so a recipient can check who issued them.

## UWX and UW Lite

`.uwx.md` is the complete structured record and the working file for
underwriting. `.uw.md` (**UW Lite**) is a compact, readable deal summary with a
small set of anchored fields, suited to hand authoring and quick review. Both
are current representations with their own specifications. A Lite file compiles
into UWX. A UWX record projects into Lite, and that projection reports any
detail it leaves out.

## What is available today

- **The normative contract.** The [format specification](/spec/format-v2), the
  [protocol](/spec/protocol) for readers, editors, calculation hosts, and agent
  hosts, [JSON Schemas](/spec/schemas/) for every cross-boundary type, and the
  [conformance corpus](/conformance/).
- **The reference library and CLI.** `@uwmd/core` parses, validates, renders,
  edits byte-for-byte, calculates, converts, and verifies. `@uwmd/cli` wraps it
  as the `uwmd` command. Both are on npm.
- **Companion packages on npm.** `@uwmd/signing` for block and receipt
  signatures, and `@uwmd/batch`, which indexes a folder of deals into a corpus
  fact table.
- **Open-source packages not yet published to npm.** The Excel exporter, the
  report renderer, the PostgreSQL lake adapter, and the hospitality and
  data-center modules all build from source in the repository.
- **Representations and bindings.** The same record round-trips through UW
  JSON, UW XML, and a CSV bundle, each with a semantic digest. Optional HTTP and
  MCP profiles describe how services and AI agents exchange it.
- **Tools.** A [browser viewer](/viewer/), a calculation-aware
  [reference editor](https://www.uwmd.org/editor/), and a VS Code extension.

The [version matrix](/about/versions) is the authoritative list of current
versions and of which packages are published.

## The record, not the warehouse

The standard stops at the record. It defines no storage contract and no
lake-level aggregate math; those belong to the platforms that consume it. What
it contributes is what a data lake cannot retrofit later: canonical facts,
stable identity through semantic digests, and a verifiable trust chain through
receipts. The [data-lake guide](/guide/data-lake) runs the whole pipeline with
the published CLI and DuckDB. A source-only reference adapter, `@uwmd/lake`,
shows one way to project records into PostgreSQL.

Commercial products build on the standard, and
[underwriter.cc](https://underwriter.cc) is the first. The standard itself is
MIT-licensed and vendor-neutral. No part of it depends on a vendor SDK,
service, or model provider.

## Start here

- [Quickstart](/tutorials/quickstart): create, validate, and verify a record in
  a few commands.
- [Open a complete deal](/viewer/) in the browser viewer.
- [Building with AI](/ai/): the rules an agent follows, plus ready-made
  instruction files.
- [Tools and packages](/guide/tools): the integrator's reference.

## How it is governed

Changes to the specifications go through an [RFC process](/about/rfcs/). The
project is currently under owner-led governance, with published
[governance rules](/about/governance) that define the path to collaborative
governance. An accepted RFC is implemented against the conformance corpus
before it is called done. When implementation contradicts an RFC, the RFC
records the erratum. Direction is tracked in the [roadmap](/about/roadmap) and
releases in the [changelog](/about/changelog).
