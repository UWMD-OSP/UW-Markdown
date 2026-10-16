---
title: AI-compatible integration
description: Use UWMD's open record and verification contracts from an adopter-owned AI application.
---

<span id="building-with-ai"></span>

# AI-compatible integration

UWMD is an open underwriting interoperability and verification standard.
StackUW and other adopter applications own their AI agents, skills, prompts,
model generation, workflows, orchestration and provider integrations.
UWMD does not require a shared agent runtime or modeling architecture.

An adopter can read and write the same records as a spreadsheet, internal
credit system or other producer. Use the [Format](/spec/format), verification
[Protocol](/spec/protocol), [metric dictionary](/spec/metrics/),
[schemas](/spec/schemas/) and [conformance corpus](/conformance/) as the contract.
AI can extract facts and draft narrative; deterministic code computes and verifies
financial results. Do not invent absent source inputs or treat authentication as
proof that financial assumptions are true.

<AiBoundary />

<span id="rules-for-agents"></span>

## Integration boundary

- The application selects its provider, prompts, skills, assumptions and workflow.
- Its trusted host applies document edits with the required source authority,
  metadata, provenance and history protections. The reference editor also
  preserves unaffected bytes for scoped edits.
- An independent verifier checks the resulting record and its declared financial
  assertions. Missing, failed and unverifiable results remain distinct.
- Rates are stored as fractions, such as `0.055` for 5.5%.

`@uwmd/verify` supplies the reference Reader/Verifier without an agent provider.
Other implementations can verify the same contracts independently. The reference
`@uwmd/core` additionally supplies generic editing and rendering tools; no agent
is needed for validation, financial verification or receipts.

<span id="best-context-order"></span>
<span id="optional-http-and-mcp-profiles"></span>

## Contract discovery and optional transports

Start with [`llms.txt`](/llms.txt) or [`llms-full.txt`](/llms-full.txt), then
read the specifications and [version matrix](/about/versions). A model can work
directly with the record; a connector is not required.

The [HTTP binding](/spec/http), [OpenAPI contract](/spec/UW_HTTP_API_v1.openapi.json)
and [MCP binding](/spec/mcp) describe optional interoperable transports. They
remain supported. They do not prescribe the application's provider or agent loop.
This site does not expose live deal resources or mutation tools.

<span id="ready-to-use-instruction-files"></span>

## Existing 4.x agent integrations

Core 4.x still ships its legacy Bancroft host and provider APIs, now deprecated.
The [legacy host reference](/starter/ai-host) remains available for compatibility;
it is non-normative and is not a recommendation for new agent development.
Format writer/provenance requirements remain unchanged.

The [legacy skill assets](/ai/skills) and existing
[instruction downloads](/downloads/#legacy-ai-instruction-files) remain reachable
pending a separately approved retirement/migration. No implementation is
automatically transferred to StackUW or any other adopter.

## Canonical project

- Repository: <https://github.com/UWMD-OSP/UW-Markdown>
- License: MIT
- Compatibility: [independent version matrix](/about/versions)
