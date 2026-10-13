# Starter products guide

> **Non-normative starter-product guidance (RFC 0078). Not part of the standard.**

UW Markdown is two things. **The standard** is the document format plus
the rules any party uses to *verify* a document: the
[Format specification](../../spec/UW_FORMAT_SPEC.md), the verification
[Protocol](../../spec/UW_PROTOCOL.md), receipts, the module system and
the representation specs. **The starter products** are the tools the
project gives away so the standard spreads: a calc engine, a web editor, a
report viewer, an Excel exporter, default assumptions and AI agents.

[RFC 0078](../rfcs/0078-protocol-is-verification.md) separated the two.
The test for the boundary: *if Argus, an Excel model or StackUW exported a
`.uw.md`, a lender could verify it using only the standard, with none of
the project's tools.* Anything a verifier needs stays in the Protocol.
Anything only a producing, editing or displaying tool needs is described
here.

## What this guide is

- **Not normative.** A conforming Reader or Verifier owes none of it. The
  MUST, SHOULD and MAY in these pages describe how the reference starter
  products behave and what another tool must do to stay compatible with
  them.
- **Moved, not rewritten.** Each page holds Protocol text moved verbatim
  under RFC 0078, with its section numbers and headings kept. The Protocol
  keeps a stub at each old heading that links here, so existing references
  still resolve. The only edits are relative links re-based to this
  directory.
- **Versioned with the packages.** Starter products change with their
  package versions only. There is no starter-guide version, and a change
  here does not move the Protocol version (RFC 0078 D13).
- **Still tested.** Starter checks remain blocking CI checks, owned by this
  guide and tagged `starter-products` in the [runtime corpus index](../../conformance/corpus-index.json).
  Legacy fixture paths are retained; `starter/editor/`, `starter/agent/`,
  refinement, rendering, defaults/cascade and other product assertions carry
  no Protocol conformance claim. Run `npm run conformance -- --starter-products`
  after building. Reports keep these outcomes separate from Reader, Verifier
  and profile claims.

## Pages

| Former Protocol section | Page | Owner decision |
|---|---|---|
| §III.1 Number formatting, §III.1a Display locales, §III.2 Date/time, §III.3 Section display hierarchy, §III.4 Badge system, §III.5 Supersede UX, §III.6 Validation issue display | [Display conventions](display.md) | D11 |
| §IV View models | [View models](view-models.md) | disposition table |
| Former §II.2 Tier 2 — Editor, §V.1 Round-trip preservation, §V.5 Multi-variant edits, §V.6 Frontmatter update rules | [Editing](editing.md) | D3 |
| §V.7 Fallback cascade (with §V.7.1), §V.8 Asset-class default tables | [Defaults and the fallback cascade](defaults-and-cascade.md) | D4 |
| §VIII.2b Stated period inputs in refinement, §VIII.2c Contextual workbook bindings | [Refinement and workbook bindings](refinement-and-workbooks.md) | D4, D6 |
| Former §II.4 Tier 4 — Agent Host, §IX AI Host Contract | [AI agent host](ai-host.md) | D3 |
| §XIV Capability tokens | [Capability tokens](capability-tokens.md) | D10 |

## What stayed in the Protocol

The rules that protect verification stay normative even where only a
writer can break them: replace vs supersede (§V.2), source authority
(§V.3), `_meta` authorship (§V.4), canonical block JSON (§V.9), integrity
chains (§V.10), signatures (§V.11) and replacement-funding verification
(§V.12). Document currency identity (§III.1b) and the validator code
taxonomy (§III.6a) also stay. Invariant 1 still binds every tool: AI never
does financial math, and agents never invent values.
