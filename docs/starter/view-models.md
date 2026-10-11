# Starter products: View models

> **Non-normative starter-product guidance (RFC 0078). Not part of the standard.**
>
> This page moved verbatim from [UW Protocol](../../spec/UW_PROTOCOL_v1.md)
> §IV
> under [RFC 0078](../rfcs/0078-protocol-is-verification.md) (disposition table). Section
> numbers and headings are kept so existing references still find the text;
> relative links were re-based to this directory and nothing else changed.
> The requirement keywords below (MUST, SHOULD, MAY) describe how the
> reference starter products behave and what a tool must do to stay
> compatible with them. They are not conformance requirements of the
> standard, and a conforming Reader or Verifier owes none of them.

## IV. View Models

### IV.1 SectionViewModel

A `SectionViewModel` (`protocol.ts`) describes how to lay out one
section. It comprises:

- `display_name` — heading shown to users.
- `display_order` — sort key relative to other sections.
- `description` — one-line context shown on hover or below the heading.
- `primary_fields` — fields surfaced on the section's collapsed card.
- `detail_fields` — additional fields revealed on expand.
- `multi_variant` — true for sections like `stress_tests` that may
  appear with multiple variants.

Each `FieldViewHint` declares a `path` resolved via `parser.deepGet`,
a `label`, and a `kind` mapping to a formatter in `format.ts`.

### IV.2 BUILTIN_VIEW_MODELS

`protocol.ts` exports a registry covering all 21 standard sections.
Implementations SHOULD use this registry as the default. Modules MAY
override per-section by declaring a `view_models[]` entry with the
matching `section_id` (§X).

### IV.3 Composition

When a module's view model and `BUILTIN_VIEW_MODELS` both define an
entry for the same `section_id`, the module's entry wins. When two
modules conflict, the host MUST refuse to load both unless they
declare `depends_on` relationships that establish a precedence.
