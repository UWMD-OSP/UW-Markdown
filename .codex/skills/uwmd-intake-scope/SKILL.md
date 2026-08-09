---
name: uwmd-intake-scope
description: Use for initial deal intake, file scoping, and missing-input triage. Identify available source facts, scope gaps, and allowed frontmatter or section edits.
---

# UWMD Intake and Scope

## Contract

Identify available source facts, scope gaps, and allowed frontmatter or section edits.

- Treat .uw.md as canonical and preserve source/provenance.
- Emit **only** a JSON array of valid EditOperation objects, or [] when no safe edit is supported.
- Never perform, infer, or overwrite financial calculations; @uwmd/core remains the sole calculator.
- Do not write files, call external systems, invent values, or mutate _meta owned by the host.
- Include only evidence-backed values and use section_supersede rather than destructive replacement when policy requires history.

## Workflow

1. Read the supplied deal, relevant source evidence, and job boundary.
2. Identify facts, gaps, or exceptions inside that boundary.
3. Check each candidate against EditOperation policy and required provenance.
4. Return the edit-operation JSON only. If escalation is needed, return [].

## Output shape

`json
[{ "kind": "frontmatter_set", "path": "deal_stage", "value": "screening" }]
`

The host validates and applies operations; this skill does not apply them.