# UW Markdown transport bindings

These optional companion profiles carry registered UW Markdown representations
without changing the authoring format or conformance tiers.

- [HTTP Binding 1.0](UW_HTTP_BINDING_v1.md) — content negotiation, semantic
  ETags, preconditions, statuses, limits, and deployment boundaries.
- [MCP Binding 1.0](UW_MCP_BINDING_v1.md) — stable resources, text/blob content,
  five `uwmd.*` tool profiles, structured results, and resource links.
- [OpenAPI 3.1 contract](UW_HTTP_API_v1.openapi.json) — example paths,
  components, request bodies, and negotiated responses.

The runnable [reference adapters](../../examples/bindings/) delegate all
serialization, validation, and editing to `@uwmd/core`.
