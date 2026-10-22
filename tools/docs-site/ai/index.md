---
title: Building with AI
description: How AI agents work with UW Markdown records — they extract and explain, while deterministic code calculates and verifies.
---

# Building with AI

UW Markdown is an open standard, not a hosted AI service or a single application.
An AI agent works with the same `.uwx.md` record that calculation engines,
underwriting systems, and editors use, and loads it directly. No custom
connector or MCP server is required.

The standard draws one firm line. **AI can extract, classify, and explain.
Deterministic code calculates and verifies the financial results.** An agent
reads the rent roll and T-12, writes facts and narrative into the record, and
leaves every NOI, DSCR, and IRR to the calculation engine.

<AiBoundary />

## Rules for agents

1. Preserve the Markdown narrative and labeled JSON blocks.
2. Extract source facts, classify information, identify gaps, and draft narrative.
3. Never calculate financial results. NOI, DSCR, LTV, debt yield, cap rate, IRR,
   NPV, and DCF come from deterministic code or formulas.
4. When editing, preserve bytes outside the requested edit region.
5. Preserve provenance. Append or supersede; never silently destroy history.
   The host, not the agent, writes each block's `_meta`.
6. Rates are fractions (`0.055` means `5.5%`).
7. Treat the format specification, protocol, metric dictionary, schemas, and
   conformance fixtures as the contract.

The agent host is a starter product, not part of the standard
([RFC 0078](/about/rfcs/0078-protocol-is-verification)). These rules come from
the non-normative [AI agent host guide](/starter/ai-host), and the reference
toolkit's generic writers apply them. Rule 3 binds every tool, and the
standard keeps its provenance rules (append or supersede, host-owned `_meta`).
The reference toolkit runs no agent: your host runs its own model and writes
the result through `writeAgentBlock` or `uwmd edit`. See
[tools and packages](/guide/tools#programmatic-agent-host).

## Best context order

1. [`llms.txt`](/llms.txt) for discovery.
2. [Quickstart](/tutorials/quickstart) and the
   [first-record tutorial](/tutorials/your-first-uwmd-file) for orientation.
3. [Format specification](/spec/format) for document syntax and semantics.
4. [Protocol specification](/spec/protocol) for Reader and Verifier requirements
   and optional verification profiles; the [starter guide](/starter/ai-host)
   describes the agent layer and writer conventions.
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

[Bounded agent skills](/ai/skills) describes narrower, task-specific skills.

## Canonical project

- Repository: <https://github.com/UWMD-OSP/UW-Markdown>
- License: MIT
- Authoring: UW Format 3.0 (`.uwx.md` for structured records); readers refuse any other `uw_version`.
- Compatibility: see the [current version matrix](/about/versions) for protocol and package versions.
