---
title: UW Markdown for AI and code
description: The interoperability contract for AI agents, deterministic services, and underwriting software.
---

# UW Markdown for AI and code

UW Markdown is an open interoperability standard, not a hosted AI service or a
single application. AI agents, deterministic calculation services, internal
underwriting systems, and compatible editors or viewers can load the same deal
record directly. No custom connector or MCP server is required.

## Core rules

1. Preserve the Markdown narrative and labeled JSON blocks.
2. AI may extract source facts, classify information, identify gaps, and draft narrative.
3. AI must not calculate financial results. Use deterministic code or formulas
   for NOI, DSCR, LTV, debt yield, cap rate, IRR, NPV, and DCF.
4. Preserve bytes outside the requested edit region for Tier-2 edits.
5. Preserve provenance. Append or supersede; do not silently destroy history.
6. Rates are fractions (`0.055` means `5.5%`).
7. Treat the format spec, protocol, schemas, and conformance fixtures as the contract.

## Best context order

1. [`llms.txt`](/llms.txt) for discovery.
2. [First-file tutorial](/tutorials/your-first-uwmd-file) for orientation.
3. [Format specification](/spec/format) for document syntax and semantics.
4. [Protocol specification](/spec/protocol) for reader, editor, calc-host, and agent-host behavior.
5. [Schemas](/spec/schemas/) and [conformance fixtures](/conformance/) for implementation testing.
6. [`llms-full.txt`](/llms-full.txt) for the expanded link map.

## Optional HTTP and MCP profiles

The [HTTP binding](/spec/http), [OpenAPI contract](/spec/UW_HTTP_API_v1.openapi.json),
and [MCP binding](/spec/mcp) describe interoperable server shapes. They are
optional profiles. This site does not expose live deal resources or mutation tools.

The MCP profile defines `uwmd.get_document`, `uwmd.validate`, `uwmd.convert`,
`uwmd.apply_edit`, and `uwmd.list_representations`.

## Ready-to-use instruction files

- <a href="/downloads/ai/uwmd-skill/SKILL.md" download="SKILL.md">Codex-compatible skill</a>
- <a href="/downloads/ai/CLAUDE.md" download="CLAUDE.md">Claude instructions</a>
- <a href="/downloads/ai/chatgpt-project-instructions.txt" download="chatgpt-project-instructions.txt">ChatGPT project instructions</a>
- <a href="/downloads/ai/GEMINI.md" download="GEMINI.md">Gemini instructions</a>
- <a href="/downloads/ai/UWMD-AI-GUIDE.md" download="UWMD-AI-GUIDE.md">Platform-neutral guide</a>

## Canonical project

- Repository: <https://github.com/jaredmaxey/uw-markdown>
- License: MIT
- Format: UW Format 1.1
- Protocol: UW Protocol 1.2
