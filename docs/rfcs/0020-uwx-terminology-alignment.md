---
rfc: 0020
title: Align the format spec and examples with the .uwx.md extension
status: draft
author: jaredmaxey
created: 2026-08-13
affects:
  - format-spec
  - protocol-spec
  - conformance-corpus
  - tooling
---

# RFC 0020: Align the format spec and examples with the `.uwx.md` extension

> **Corrective.** This RFC completes work that [RFC 0017](./0017-uw-lite-source-representation.md)
> decided and shipped in code but never carried into the format specification.
> It proposes no new behaviour. It exists because the gap is on normative
> surface, and because RFC 0017's own
> [Process failure](./0017-uw-lite-source-representation.md#process-failure)
> section is a standing argument for writing these things down rather than
> quietly fixing them.

## Summary

[RFC 0017](./0017-uw-lite-source-representation.md) split the single `.uw.md`
file type into **UW Lite** (`.uw.md`) and **UWX** (`.uwx.md`), and was accepted
2026-08-09. The reference implementation followed. `spec/UW_FORMAT_SPEC_v1.md`
did not: it still calls itself the `.uw.md` specification and opens by declaring
a `.uw.md` file "the canonical, lossless" record — the exact claim RFC 0017
moved to `.uwx.md`. This RFC realigns the format spec, the protocol spec, the
XML/CSV specs, and the ten worked examples with the extension the library
already emits, and fixes the vocabulary used to talk about all of it.

## Motivation

Three concrete problems, none of them cosmetic.

**1. Two normative documents contradict each other.** `UW_FORMAT_SPEC_v1.md`
contained **zero** occurrences of `.uwx.md` and sixteen of `.uw.md`, describing
the full section model, `_meta` provenance, and calc inputs — that is, UWX —
while `UW_LITE_SPEC_v1.md` and RFC 0017 define `.uw.md` as a constrained,
explicitly lossy summary. A reader holding only the format spec would conclude
that a structured record is a `.uw.md` file, which the implementation has
already stopped believing. `CLAUDE.md` invariant 7 requires spec, schema, and
protocol to stay in lockstep; they were not.

**2. The published site inherits the error.** `tools/docs-site` renders the
format spec directly, so uwmd.org told every visitor that `.uw.md` is the
canonical lossless representation. The specification is the product here — this
is the standard's front door.

**3. The repo's own examples were flagged as legacy by its own library.**
All ten files in `examples/` were structured records carrying the legacy
extension. Running the shipped detector over one of them demonstrates it:

```
Parkview.uwx.md    -> uwx-markdown | warnings: []
Parkview.uw.md     -> uwx-markdown | warnings:
  ["Structured UWX content uses the legacy .uw.md extension; migrate it to .uwx.md."]
```

The examples are the first thing a newcomer copies, so the format was teaching
the shape it had just deprecated. None of the ten was a Lite file — every one
carried `uw_version` and fenced `uw:section=` blocks — so there was no
ambiguity about which side of the split they belong on.

## Proposed change

### 1. Vocabulary

Adopt the Word convention explicitly, and state it in the format spec so it
stops being folklore:

| Term | Means |
|---|---|
| **UW Markdown** | The standard as a whole. The right term in prose. |
| **UWX** / `.uwx.md` | The complete, lossless underwriting record. What `UW_FORMAT_SPEC_v1.md` specifies. |
| **UW Lite** / `.uw.md` | A constrained, human-readable, explicitly lossy summary. Specified by `UW_LITE_SPEC_v1.md`. |

"A UW Markdown document" is the colloquial form, exactly as people say "a Word
document" while the file is `.docx`.

**Where the analogy must not be pushed.** `.doc` is a superseded predecessor;
UW Lite is neither older nor deprecated. It is a current, deliberately lossy
*view* with its own specification and its own purpose, and the UWX → Lite
projection MUST report every path it omits. Documentation MUST NOT describe
Lite as a legacy or previous version. The formulation that holds: **UWX is what
a deal *is*; Lite is one way of showing it.**

### 2. Format spec

`spec/UW_FORMAT_SPEC_v1.md` is retitled `.uwx.md — UW Markdown Extended Format
Specification`, its opening claim moves to `.uwx.md`, and a short **Naming**
section states the table above, the limit of the Word analogy, and the legacy
rule: structured content using `.uw.md` remains readable via sniffing, but
**extension no longer implies structure**, and new structured files MUST NOT be
written as `.uw.md`. Every in-body reference to a structured file becomes
`.uwx.md`, including the filename convention in the appendix.

### 3. Protocol, XML, and CSV specs

The same substitution where the referent is a structured record. Two references
are deliberately *not* changed to `.uwx.md`:

- `UW_PROTOCOL_v1.md` — "the UW Markdown format remains 1.1" refers to the
  format's *version*, not a file, so it takes the prose name.
- `UW_XML_MAPPING_v1.md` — the representation-detection list becomes
  "`.uwx.md`, `.uw.md`, `.uw.json`, or `.uw.xml`". `.uw.md` genuinely belongs
  in a detection list; dropping it would misdescribe behaviour.

### 4. Examples

All ten files in `examples/` are renamed to `.uwx.md`, content byte-identical —
the migration output RFC 0017 already specifies. The 41 files referencing them
(tests, conformance, docs, bindings, the docs-site sample copier) are updated in
the same change.

`README.md` leads with **UW Markdown** as the standard and `.uwx.md` as the
file, and the `uwmd init` example writes `my-deal.uwx.md`, since
`generateBlankUWFile()` emits `uw_version` and fenced `uw:section=` blocks —
a UWX file.

## Compatibility analysis

**Nothing breaks, because no behaviour changes.** This RFC changes prose and
filenames, not code.

- **Existing `.uw.md` files** — unaffected. Structured content using the legacy
  extension is still detected as UWX and still readable, with the migration
  warning it already emitted. This RFC does not shorten or schedule the end of
  that path.
- **Tier 1–4 implementations** — unaffected. No parsing, editing, calc, or agent
  behaviour changes. An implementation that reads only `.uw.md` was already
  wrong under RFC 0017 and is no more wrong now.
- **Modules** — unaffected. No manifest, pack, or `_meta` rule changes.
- **Downstream references to example paths** — the one real break. Anything
  outside this repository linking to `examples/*.uw.md` needs the new name.
  Acceptable pre-1.0 and consistent with RFC 0017's own reasoning that this is a
  pre-launch redefinition.

No deprecation cycle is required, and none is proposed.

## Conformance impact

No fixture behaviour changes and no expected output changes. Fixtures under
`conformance/` already use `.uwx.md` for extended records — they were migrated
with the implementation and are the reason the gap was invisible for so long.

Test files referencing renamed examples are updated by path only. Their
assertions are untouched, which is what makes the rename safe to review: any
mistake surfaces as a file-not-found failure rather than a changed expectation.

One fixture worth adding, though it is really a follow-up: **there is no Lite
example anywhere in `examples/`.** The repo specifies UW Lite normatively and
ships zero instances of it, which is likely part of why the two representations
blurred together in the documentation.

## Reference implementation

No library change. `packages/uwmd-core/src/source-representation.ts` already
carries `UWX_EXTENSION`, the detection logic, the legacy warning, and
`migrateLegacyUWMarkdown()`.

Files changed: `spec/UW_FORMAT_SPEC_v1.md`, `spec/UW_PROTOCOL_v1.md`,
`spec/UW_XML_MAPPING_v1.md`, `spec/UW_CSV_BUNDLE_v1.md`, `README.md`, the ten
files in `examples/`, the 41 files referencing them, and the one-line header
comment in `packages/uwmd-core/src/init.ts`.

Test plan: the existing suites are the test. Every example is loaded by path
from core, excel, batch, report, CLI-smoke, and web-editor tests, so a missed
reference fails loudly. Full gate — build, 694 tests, 105 conformance
assertions, lint, schemas — must stay green with no expectation edits.

## Alternatives considered

1. **Fix only the docs site.** Cheapest, and it addresses the visible symptom.
   Rejected: the site renders the spec, so the site would be correct only until
   the next build, and the two normative documents would still disagree.
2. **Leave examples on the legacy extension.** They work — sniffing keeps them
   readable. Rejected: examples are the most-copied artifact in the repo, and
   they were emitting a migration warning from the project's own library. That
   is the worst place to model deprecated usage.
3. **Rename examples but leave the spec.** Rejected as backwards: it would make
   the examples contradict the specification they are meant to demonstrate.
4. **Fold this into RFC 0017 as an amendment.** Tempting, since it is the same
   decision. Rejected: 0017 is `accepted` and describes shipped work. Editing an
   accepted RFC to cover a gap found later obscures the sequence, which is the
   failure mode 0017 was itself written to correct.
5. **Adopt `.doc`/`.docx` framing wholesale, calling Lite the old format.**
   Rejected as actively misleading. Lite is current and specified; describing it
   as superseded would discourage the exact adoption the Lite spec is for.

## Unresolved questions

- **When, if ever, does legacy `.uw.md` sniffing end?** RFC 0017 introduced it
  as a transition path with no expiry. This RFC deliberately does not set one;
  it should be decided before 1.0 rather than drifting into permanence.
- **A Lite worked example** should be added to `examples/`, which raises a
  smaller question: does it live beside the UWX examples, or in a `examples/lite/`
  subdirectory that makes the distinction unmissable?
- Whether `spec/UW_FORMAT_SPEC_v1.md` should eventually be *renamed* on disk to
  match its subject (e.g. `UW_UWX_SPEC_v1.md`). Deferred — the file path is
  cited from many places, and the retitle inside the document carries the
  meaning without the churn.

## Prior art

The `.doc` → `.docx` transition is the direct model for the vocabulary, and also
for its limit: OOXML superseded the binary format outright, whereas UWX and Lite
coexist by design. Markdown's own `.md`/`.markdown` duality and YAML's
`.yml`/`.yaml` show how expensive an unresolved extension ambiguity becomes once
an ecosystem is large — which is the argument for settling this pre-1.0.
