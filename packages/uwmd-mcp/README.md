# @uwmd/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) connector that lets an
AI agent validate and verify a UW Markdown (`.uwx.md`) record. Every result is
computed by `@uwmd/verify`, the standard's reference implementation. The agent
reads the results; it does no financial math.

> **Not yet published.** This package is `private` until the public launch. It
> is built and tested in the repository; listing it on npm and the MCP
> registries is a launch-day step for the owner.

## Tools

All three are read-only (`readOnlyHint`, no network, no files). Each takes the
record's text, not a path.

| Tool | Input | Returns |
|---|---|---|
| `uwmd_validate` | `source`: the full `.uwx.md` text | `overall_status`, error and warning counts, `stage_readiness`, and every issue (`code`, `severity`, `section`, `field`, `message`) |
| `uwmd_verify` | `source` | `ok`, the validation summary, stated-metric counts with each `failed` statement (stated vs recomputed) and each `unverifiable` one (reason), hash-chain integrity, provenance, and replacement-funding verification |
| `uwmd_explain_code` | `code`, for example `CC-03` | the code's severity, title, description, remediation and spec reference |

Results follow the [UW MCP binding](../../spec/bindings/UW_MCP_BINDING_v1.md)'s
result rule (§3): structured content plus the same value as one JSON text block.
A refusal (an unparseable record, an unsupported version, a record over 5 MB) is
`isError: true` with a structured `code` and no stack trace. Signatures are
counted but not checked: the connector holds no key store.

These are stateless companions to the binding's `deal_id` tools, which a server
with stored deals implements; they do not redefine them.

## Running it locally

```bash
npm run build -w packages/uwmd-mcp
node packages/uwmd-mcp/dist/bin.js
```

The server speaks MCP over stdio. A client configuration, after launch:

```json
{ "mcpServers": { "uwmd": { "command": "npx", "args": ["-y", "@uwmd/mcp"] } } }
```

## Launch-day listing (owner)

1. Remove `"private": true`, and publish `@uwmd/mcp` with the lockstep 5.0.0
   release. Set `version` in `package.json`, `server.json` (both places) and
   `src/version.ts`; a test holds them equal.
2. Choose the registry namespace. `org.uwmd/uwmd` (as in `server.json` and
   `mcpName`) needs DNS verification of uwmd.org; `io.github.uwmd-osp/uwmd` needs
   only GitHub sign-in. Change both fields together.
3. Check `server.json` against the registry's current schema, then publish it
   with the registry's `mcp-publisher` tool.
