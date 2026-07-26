# UW Markdown — Codebase Wiki (for AI agents & contributors)

This wiki is the **development knowledge base** for the UW Markdown repository.
It exists for one purpose: let an AI coding agent (or a new human contributor)
orient quickly, find the right file, follow existing conventions, and avoid
breaking the invariants that hold this codebase together.

> **Audience note.** This is *internal development* documentation. It is
> distinct from the *human-facing standard* docs (the spec, the published
> VitePress site). When the two disagree, **the spec wins** — see
> [doc precedence](#document-precedence) below. This wiki summarizes and
> cross-references; it is never normative.

## What this repository is

UW Markdown is the **open standard `.uw.md`** (a Markdown + JSON file format for
commercial-real-estate underwriting deals) plus its **reference implementation**
(`@uwmd/core`), a CLI, an Excel converter, and supporting tools. It is a
*library and specification*, not a web app — there is **no React frontend, no
Express server, no database** in this repo. `underwriter.cc` is the first public
product *consuming* the standard, and lives in a separate codebase.

## How to use this wiki

If you are about to... | Read
---|---
Get the 5-minute mental model | [01 — Architecture](01-architecture.md)
Understand the `.uw.md` file itself | [02 — The `.uw.md` format](02-uwmd-format.md)
Touch `@uwmd/core` (parser/validator/editor/…) | [03 — Core library](03-core-library.md)
Work on calc evaluation (Tier-3) | [04 — Calc engine](04-calc-engine.md)
Add/change a derived metric or asset pack | [05 — Calc packs](05-calc-packs.md)
Work on the Bancroft AI agents (Tier-4) | [06 — Bancroft agents](06-bancroft-agents.md)
Look up a deal's data shapes / types | [07 — Data model reference](07-data-model-reference.md)
Work on a tool (CLI, Excel, web, VS Code) | [08 — Tools](08-tools.md)
Add/run tests or conformance fixtures | [09 — Conformance & testing](09-conformance-testing.md)
Know the rules you must not break | [10 — Conventions & invariants](10-conventions-invariants.md)
Build, version, or release | [11 — Build, release & governance](11-build-release-governance.md)
Do a specific common task | [12 — Recipes](12-recipes.md)
See what's built vs. what needs work | [13 — Build status (living)](13-status.md)

## The fastest possible orientation

- **One package matters most:** `packages/uwmd-core` (`@uwmd/core`). Everything
  else depends on it; its runtime dependencies are `@anthropic-ai/sdk`, `fast-xml-parser`, and `fflate`.
- **The public API is a single file:** [`packages/uwmd-core/src/index.ts`](../../packages/uwmd-core/src/index.ts).
  If a symbol isn't exported there, tools can't use it.
- **The contract is versioned normative text:** [`spec/UW_FORMAT_SPEC_v1.md`](../../spec/UW_FORMAT_SPEC_v1.md)
  defines the authoring file, [`spec/UW_PROTOCOL_v1.md`](../../spec/UW_PROTOCOL_v1.md)
  defines conforming software, while [`spec/UW_XML_MAPPING_v1.md`](../../spec/UW_XML_MAPPING_v1.md)
  and [`spec/UW_CSV_BUNDLE_v1.md`](../../spec/UW_CSV_BUNDLE_v1.md) define model
  representations. `protocol.ts` mirrors the protocol surface.
- **One invariant rules them all:** *AI extracts and narrates; it never
  calculates.* All NOI/DSCR/LTV/IRR/DCF math is deterministic in `calc/` +
  `packs/`. See [10 — Conventions & invariants](10-conventions-invariants.md).
- **Trust is anchored by conformance:** `conformance/` fixtures + `npm run
  conformance` are how any implementation (including this one) proves it behaves.

## Document precedence

When sources conflict, trust them in this order:

1. **The current source code** — the ground truth for *what the code does today*.
2. **Versioned normative files under `spec/`** — the format, protocol, and representation mappings that define conforming behavior. Changing these requires an RFC.
3. **`spec/schemas/`** — JSON Schemas and structural XML tooling schemas for boundary payloads.
4. **Root docs** — `ARCHITECTURE.md`, `README.md`, `docs/GLOSSARY.md`, `docs/TOOLS.md`.
5. **This wiki** — orientation and cross-references. If this wiki is wrong, fix it,
   but never treat it as authority over 1–4.

## Keeping this wiki honest

Every claim here was grounded in the source at time of writing. Code drifts.
Before you rely on a function signature or a file path from this wiki, confirm it
against the file it points to. If you change behavior that a page describes,
update the page in the same PR. Pages cite real paths and line-free references on
purpose — line numbers rot, file/symbol names rot slower.
