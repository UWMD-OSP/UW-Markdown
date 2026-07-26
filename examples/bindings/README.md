# HTTP/MCP reference adapters

This example shows the thin integration layer intended by the HTTP and MCP
binding profiles. It imports every parser, codec, validator, ETag, and edit
operation from `@uwmd/core`; it contains no serialization logic of its own.

```bash
npm run build
node examples/bindings/reference-adapters.mjs
```

`createReferenceBindings(source)` returns:

- `httpGet()` for a negotiated HTTP read response;
- `readResource()` for MCP `resources/read`;
- handlers for all five `uwmd.*` MCP tools;
- `currentETag()` for optimistic-concurrency clients.

A real server supplies authentication, authorization, persistence, and its HTTP
or MCP SDK transport. Register the returned callbacks with that server rather
than copying codec logic. Stable deal identities remain under
`https://uwmd.org/deals/{deal_id}` even when the API is deployed elsewhere.

See the [HTTP binding](../../spec/bindings/UW_HTTP_BINDING_v1.md),
[MCP binding](../../spec/bindings/UW_MCP_BINDING_v1.md), and
[OpenAPI contract](../../spec/bindings/UW_HTTP_API_v1.openapi.json).
