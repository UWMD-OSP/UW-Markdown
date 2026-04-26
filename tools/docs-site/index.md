---
layout: home

hero:
  name: UW Markdown
  text: An open standard for underwriting documents
  tagline: Readable by humans, AI tools, and software alike. The same kind of move CommonMark made for prose, OpenAPI made for APIs, JSON Schema made for data — applied to commercial real-estate underwriting.
  actions:
    - theme: brand
      text: Read the spec
      link: /spec/format
    - theme: alt
      text: Browse on GitHub
      link: https://github.com/jaredmaxey/Underwriting-Markdown-Private-1.0
    - theme: alt
      text: View the protocol
      link: /spec/protocol

features:
  - icon: 📄
    title: One file, every audience
    details: A `.uw.md` deal pairs human-readable Markdown prose with structured JSON blocks. Open it in any editor; parse it with any tool; feed it to any AI agent. No proprietary container.

  - icon: 🧮
    title: Four conformance tiers
    details: Reader, Editor, Calc Host, Agent Host. Each tier is a published contract with a fixture corpus. Implementers self-certify against the tiers they support — no central body, no certification fees.

  - icon: 🔒
    title: Validation built in
    details: Every claim in the format — financial validity, cross-section consistency, supersede semantics — has a runnable check. The reference library `@uwmd/core` exposes the same validator the conformance gate uses.

  - icon: 🤖
    title: Agent-ready
    details: Sections, layers, and edit policies are first-class concepts. Agent hosts append updates with full provenance; the file remains a stable artifact across runs.

  - icon: 🧩
    title: Modular by design
    details: The base format covers the universals. Asset-class specifics (multifamily, office, hospitality) ship as modules — additional sections, calcs, validations, and agent layers, declared in a manifest the host can verify.

  - icon: 🏛
    title: Governed openly
    details: Normative changes go through a 14-day RFC window. The format spec, the protocol spec, and the JSON Schemas are all in this repo, all under MIT.
---

## Why a standard?

Underwriting is dominated by Excel models and Word credit memos that are
opaque to software, AI, and anyone outside the originator's firm. Every shop
reinvents the wheel. Every analyst rebuilds the same models. AI tools see
dollar signs as text and cap rates as `0.05`.

`.uw.md` is a published, versioned, vendor-neutral text format that lets every
tool — bank platforms, analyst spreadsheets, document parsers, AI assistants,
internal credit systems — read and write the same files without losing
fidelity.

## Quick start

```bash
npm install @uwmd/core

# Parse, validate, and render a deal file
npx uwmd parse path/to/deal.uw.md
npx uwmd validate path/to/deal.uw.md
npx uwmd summary path/to/deal.uw.md
```

## Get involved

- Read the [format spec](/spec/format) and [protocol spec](/spec/protocol).
- Browse the [conformance corpus](/conformance/) to see what each tier guarantees.
- File a normative change via the [RFC process](/about/rfcs/).
- Ship a tool — see [Contributing](/about/contributing) and add yourself to the implementers list.
