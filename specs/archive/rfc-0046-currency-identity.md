# Specification: Document currency identity (RFC 0046)

Status: **implemented on development branch; unreleased** · Opened 2026-09-13

RFC 0046 adds optional document-level currency identity through
`frontmatter.currency_code`, with `CUR-01` validation and explicit display
prefixes. Numeric storage, calculations, CSV/JSON output, and legacy locale
symbol behavior remain unchanged. Per-value identity, FX, and mixed-currency
arithmetic remain deferred.

The complete contract is [RFC 0046](../../docs/rfcs/0046-currency-identity.md).
