# 06 — Bancroft layers (starter product)

> RFC 0078 retired Tier 4 (Agent Host) as a Protocol tier. The layer registry
> and its builders are non-normative starter products; their former Protocol
> text is in [`docs/starter/ai-host.md`](../starter/ai-host.md), and the
> layer-profile check runs from `conformance/starter/agent/`.

**The reference toolkit hosts no agents.** `@uwmd/core` runs no model, ships no
provider adapter, tool schema or replay cassette, and the CLI has no `uwmd run`
command. A host that runs its own agents (StackUW, or any other producer) does
the execution itself and writes each record through the generic writers
(`writeAgentBlock`, `writeErrorEntry`) or the edit API (`applyEdit`,
`uwmd edit --agent-id/--agent-version`). The format's provenance, supersede and
pipeline-log rules apply to those writes as to any producer's. **Agents extract
and narrate; they never compute financial metrics** (invariant 1).

What core keeps, until RFC 0112 decides the layer vocabulary (Format §2.2
`pipeline_state` names its keys after `BANCROFT_LAYERS`):

- **Location:** [`src/context.ts`](../../packages/uwmd-core/src/context.ts)
  + [`src/context-profiles.ts`](../../packages/uwmd-core/src/context-profiles.ts)
  + the generic writers in [`src/runner.ts`](../../packages/uwmd-core/src/runner.ts).
  `src/agents/L0b-prompt.md` is the L0b layer's prompt text, which its layer
  description refers to.
- **Starter contract:** [AI host guide](../starter/ai-host.md) §IX,
  non-normative since RFC 0078.
- **Ownership:** StackUW owns modeling, agents and workflows. See the
  [inventory](../reviews/2026-10-15-architecture-boundary.md) and
  [removal plan](../reviews/2026-10-15-agent-removal-5.0.md).
- **Public API (via `index.ts` and `browser.ts`):** `buildAgentContext`,
  `buildAgentPrompt`, `isContextReady`, `getLayerDependencies`,
  `BANCROFT_LAYERS` and the types `AgentContext`, `BancroftPrompt`,
  `LayerDefinition`; `buildContext` (root entry only); `writeAgentBlock`,
  `writeErrorEntry`, `buildMeta`.

## The layer registry (`BANCROFT_LAYERS` in `context.ts`)

Each `LayerDefinition` declares `id`, `layer` (number), `name`, `reads[]`,
`writes[]`, `pipelineStateKey`, and `consumed_profile` (the starter context
profile, verified by the layer-profile starter check).

Layer | Name | Reads | Writes | Profile
---|---|---|---|---
`L0` | Document Ingestion | (raw docs) | `rent_roll`, `operating_statement`, `lease_schedule` | summary
`L0a` | Scope | `property` | `market_analysis`, `noi_model`, `debt_structure`, `valuation`, `quick_metrics`, `gaps` | summary
`L0b` | Scope Refinement | `*` | `property`, `noi_model`, `debt_structure`, `gaps` | compact
`L1` | Screening | `deal_context`, `property`, `ownership` | `screening`, `preliminary_sizing` | summary
`L2` | Underwriting | `deal_context`, `property`, `rent_roll`, `operating_statement`, `borrower_sponsor` | `noi_model`, `valuation`, `market_analysis` | relevant
`L4` | Structuring | `deal_context`, `property`, `noi_model`, `valuation`, `market_analysis`, `borrower_sponsor`, `sources_uses` | `debt_structure`, `sources_uses`, `covenants` | relevant
`L5` | Compliance | `deal_context`, `property`, `ownership`, `borrower_sponsor`, `debt_structure`, `valuation` | `compliance` | relevant
`L6` | Risk Rating | `deal_context`, `property`, `noi_model`, `valuation`, `debt_structure`, `market_analysis`, `borrower_sponsor`, `stress_tests`, `dcf`, `compliance` | `risk_assessment` | relevant
`L7` | Assembly | `*` (everything) | `pipeline_log`, `deal_context` (ai_synthesis) | live

Notes:
- **L3 is intentionally absent** (reserved). L9/L10 (portfolio/relationship)
  appear in product strategy but are **not implemented here**.
- `reads: ['*']` means "all sections" (L0b, L7).
- `L0` and `L4` write multiple sections. How a host collects a multi-section
  answer from its model is the host's business.

## Pipeline dependencies & readiness

- `getLayerDependencies(layerId)` returns layers that must complete first, e.g.
  `L6 → [L2, L4, L5]`, `L7 → [L0, L1, L2, L4, L5, L6]`, `L0b → [L0a]`.
- `REQUIRED_BY_LAYER` (in `context.ts`) names sections that must be present for a
  layer to produce meaningful output (e.g. L2 needs `property`+`rent_roll`; L6
  needs `noi_model`+`debt_structure`+`valuation`).
- `isContextReady(ctx)` halts on (a) any `blocking_flags`, or (b) any missing
  required section. A host should not invoke a layer whose context is not
  ready.

## Context building (`buildAgentContext`)

```ts
buildAgentContext(parsed, agentId, opts?) → AgentContext
```

Resolves the layer (by `L\d+` prefix; unknown → L7), collects the sections the
layer reads (or all, for L7), always includes `deal_context` for orientation,
records `missingRequired`/`missingOptional`, and builds:
- `chatContext` — a token-budgeted rendered context string (via `render(..., {format:'chat'})`).
- `profileContext` — the starter payload built from the layer's
  `consumed_profile` via `buildContext` (`context-profiles.ts`). Hosts running
  under the starter compatibility contract use this payload.

## Prompt building (`buildAgentPrompt`)

```ts
buildAgentPrompt(context, userInstructions?) → { systemPrompt, userMessage, outputSchemaDescription }
```

The system prompt states the layer's role (`getLayerDescription`), the **output
contract** (which sections to write, begin with `_meta`, set confidence and
`human_review_required`), the available input sections, and any blocking flags. It
includes the explicit instruction: *"Never calculate financial figures — report
what the data shows; the deterministic engine owns the math."* The user message is
the chat context + the section list to write.

## Writing a layer's output

The host owns `_meta`: it builds it with `buildMeta()` and passes it with the
section payload to `writeAgentBlock(fileContent, parsed, { sectionId, content },
opts)`, which supersedes the prior block, appends the new versioned block and a
`pipeline_log` entry, and applies any requested `pipeline_state` and
`quick_metrics` updates. It drops any `_role` or `_overrides` the payload
carries. A failed run records a `writeErrorEntry`. Neither function calls a
model.

## Context profiles (`context-profiles.ts`)

`buildContext(parsed, profile, opts) → ContextResult`. Profiles: `summary`,
`compact`, `relevant`, `full`, `live`. Each layer declares which it `consumes`;
the layer-profile starter check asserts the `layer → profile` map matches the
baseline.

## From the CLI

```bash
uwmd layers                                      # list all layers
```

## Recipe: add a new agent layer

1. Add a `LayerDefinition` to `BANCROFT_LAYERS` in `context.ts`: `id` (`L\d+`
   form), `layer`, `name`, `reads[]`, `writes[]`, `pipelineStateKey`,
   `consumed_profile`.
2. Add the layer's required sections to `REQUIRED_BY_LAYER` and its prerequisites
   to `getLayerDependencies`.
3. Add a role string in `getLayerDescription` and an output-schema hint in
   `getOutputSchemaDescription`.
4. If it consumes a new pipeline-state key, extend `UWPipelineState` in `types.ts`.
5. Update the layer-profile expectation under
   `conformance/starter/agent/profile/` (a starter-product check). Run
   `npm run conformance -- --suite=starter-agent-profile`.
