---
name: uw-markdown
description: Read, validate, explain, and safely edit UW Markdown (.uw.md) commercial real-estate underwriting files.
---

# UW Markdown

Use this skill whenever a task reads, creates, validates, converts, summarizes,
or edits a `.uw.md` file.

## Required behavior

1. Read `https://uwmd.org/llms.txt` for the current documentation map.
2. Treat the UW Format and UW Protocol as contracts.
3. Extract facts and draft narrative, but never perform financial math.
4. Use deterministic UW Markdown tools for every derived financial value.
5. Do not invent missing inputs. Record gaps and ask for the source needed.
6. Store rates as fractions (`0.055` means `5.5%`).
7. Preserve provenance and append-only history; supersede rather than destroy.
8. For scoped edits, preserve bytes outside the edited region.
9. Validate the final file and report unresolved blocking issues.

Use the optional MCP profile only when an MCP server is actually available.
Direct file work needs no connector.
