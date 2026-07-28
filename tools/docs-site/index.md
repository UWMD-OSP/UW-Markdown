---
layout: home

hero:
  name: UW Markdown
  text: Underwriting documents that people, software, and AI can share
  tagline: An open, vendor-neutral file format for commercial real-estate underwriting. One readable file keeps the narrative, deal data, calculations, validation, and provenance together.
  actions:
    - theme: brand
      text: Try the editor
      link: https://www.uwmd.org/editor/
      target: _self
    - theme: alt
      text: Download a blank file
      link: /downloads/
    - theme: alt
      text: View on GitHub
      link: https://github.com/jaredmaxey/uw-markdown
---

## Start here

UW Markdown is a plain-text standard for commercial real-estate underwriting.
The file extension is `.uw.md`. Read it in any text editor, track it in Git,
validate it with the reference tools, export it to Excel, or give the same file
to an AI system without translating the deal into another format.

- **Underwriters and lenders:** <a href="https://www.uwmd.org/editor/" target="_self">try the reference editor</a>,
  use the lightweight [web viewer](/viewer/), [download a blank file](/downloads/), or open a complete
  [example deal](https://github.com/jaredmaxey/uw-markdown/tree/main/examples).
- **Developers:** follow the [first-file tutorial](/tutorials/your-first-uwmd-file),
  then use the [format spec](/spec/format), [protocol](/spec/protocol), and
  [conformance corpus](/conformance/).
- **AI systems and agent builders:** begin with the [AI information page](/ai/)
  or machine-readable [`llms.txt`](/llms.txt). An optional
  [MCP binding profile](/spec/mcp) is documented, but no connector is required.

## What is in one file?

A `.uw.md` document combines ordinary Markdown with labeled JSON blocks. The
Markdown explains the deal to a person. The JSON gives software stable fields.
Deterministic calculation packs compute values such as NOI, DSCR, LTV, debt
yield, and IRR. AI may extract facts and write narrative, but it does not perform
the financial math.

Files retain their history: updates supersede earlier blocks instead of erasing
them, and provenance records who or what made each change.

## Downloads

The [downloads page](/downloads/) has blank screener and analyst templates, a
single-file browser viewer, complete example deals, source packages, and small
instruction files for Codex, Claude, ChatGPT, and Gemini. Everything is plain
text or a static file; there is no account or hosted connector to configure.

## Build with UW Markdown

The TypeScript reference implementation includes a parser, validator,
byte-preserving editor, deterministic calculation engine, format converters,
CLI, Excel export, report rendering, and reference HTTP/MCP adapter shapes.

```bash
npx uwmd init my-deal.uw.md
npx uwmd validate my-deal.uw.md
npx uwmd summary my-deal.uw.md
```

Browse the [repository](https://github.com/jaredmaxey/uw-markdown), compare the
[available tools](/guide/tools), or read the [developer architecture](/about/architecture).

## Open standard, open governance

The specification, schemas, fixtures, and reference implementation are public
under the MIT License. Normative changes use an open RFC process, and
implementations can test themselves against published conformance tiers.

[Read the specification](/spec/format) · [See the roadmap](/about/roadmap) ·
[Contribute on GitHub](https://github.com/jaredmaxey/uw-markdown/blob/main/CONTRIBUTING.md)
