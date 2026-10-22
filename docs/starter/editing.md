# Starter products: Editing

> **Non-normative starter-product guidance (RFC 0078). Not part of the standard.**
>
> This page moved verbatim from [UW Protocol](../../spec/UW_PROTOCOL.md)
> §V.1, §V.5 and §V.6, and from the retired Tier-2 Editor requirements
> (Protocol 2.x §II.2), under
> [RFC 0078](../rfcs/0078-protocol-is-verification.md) (D3). Section
> numbers and headings are kept so existing references still find the text;
> relative links were re-based to this directory and nothing else changed.
> The requirement keywords below (MUST, SHOULD, MAY) describe how the
> reference starter products behave and what a tool must do to stay
> compatible with them. They are not conformance requirements of the
> standard, and a conforming Reader or Verifier owes none of them.

### II.2 Tier 2 — Editor

A Tier-2 Editor MUST satisfy all Tier-1 requirements, and additionally:

1. Round-trip preservation: bytes outside the modified region of the
   file MUST be preserved, modulo line-ending normalization.
2. Honor `BUILTIN_EDIT_POLICIES` (§V.3) — supersede vs replace.
3. Update `_meta` on every write per §V.4 (new `version`, new
   `timestamp`, correct `actor` and `source`).
4. Update `frontmatter.last_modified` on every write.
5. Reject any `EditOperation` whose `meta.source` is not permitted by
   policy with a `ProtocolError` of category `edit`.

### V.1 Round-trip preservation

A Tier-2 Editor receiving an `.uwx.md` and returning an `.uwx.md`
MUST preserve bytes outside the directly-modified region, modulo:

- Line-ending normalization (CRLF → LF is permitted).
- Trailing-whitespace stripping is permitted.
- Reordering of frontmatter keys is NOT permitted.
- Reformatting JSON inside untouched fence blocks is NOT permitted.

### V.5 Multi-variant edits

For sections with `multi_variant: true`, edits MUST specify a
`variant` key. Operations against missing variants create a new
variant; operations against existing variants follow the same
replace/supersede policy as single-variant sections.

### V.6 Frontmatter update rules

`uw_version`, `deal_id`, and `created` MUST NOT be modified by
post-init edits. `last_modified` MUST be updated on every write.
