# 06 — Bancroft agents (Tier-4)

Bancroft is the AI agent layer. Each agent is a **layer** in an underwriting
pipeline (L0…L7). A layer reads a curated subset of the deal, calls Claude with a
structured-output tool, and writes section blocks back via the supersede-aware
writer. **Agents extract and narrate; they never compute financial metrics.**

- **Location:** [`packages/uwmd-core/src/agents/`](../../packages/uwmd-core/src/agents/)
  + [`src/context.ts`](../../packages/uwmd-core/src/context.ts)
  + [`src/context-profiles.ts`](../../packages/uwmd-core/src/context-profiles.ts)
- **Normative contract:** `UW_PROTOCOL_v1.md` §IX (provider-neutral). `bancroft.ts`
  is the Claude-backed *reference* implementation.
- **Public API (via `index.ts`):** `runBancroftAgent`, `runBancroftAgentStreaming`,
  `buildAgentContext`, `buildAgentPrompt`, `isContextReady`, `getLayerDependencies`,
  `BANCROFT_LAYERS`, `WRITE_UW_SECTION_TOOL`, `WRITE_MULTIPLE_SECTIONS_TOOL`,
  `MULTI_SECTION_LAYERS`.

## The layer registry (`BANCROFT_LAYERS` in `context.ts`)

Each `LayerDefinition` declares `id`, `layer` (number), `name`, `reads[]`,
`writes[]`, `pipelineStateKey`, and `consumed_profile` (the normative context
profile, verified by Tier-4 conformance).

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
- `L0` and `L4` write multiple sections → they use the multi-section tool
  (`MULTI_SECTION_LAYERS = {'L0','L4'}`).
- All layers default to **`claude-sonnet-4-6`**, temperature **0.1**.

## Pipeline dependencies & readiness

- `getLayerDependencies(layerId)` returns layers that must complete first, e.g.
  `L6 → [L2, L4, L5]`, `L7 → [L0, L1, L2, L4, L5, L6]`, `L0b → [L0a]`.
- `REQUIRED_BY_LAYER` (in `context.ts`) names sections that must be present for a
  layer to produce meaningful output (e.g. L2 needs `property`+`rent_roll`; L6
  needs `noi_model`+`debt_structure`+`valuation`).
- `isContextReady(ctx)` halts on (a) any `blocking_flags`, or (b) any missing
  required section. The agent runner refuses to call Claude if not ready.

## Context building (`buildAgentContext`)

```ts
buildAgentContext(parsed, agentId, opts?) → AgentContext
```

Resolves the layer (by `L\d+` prefix; unknown → L7), collects the sections the
layer reads (or all, for L7), always includes `deal_context` for orientation,
records `missingRequired`/`missingOptional`, and builds:
- `chatContext` — a token-budgeted rendered context string (via `render(..., {format:'chat'})`).
- `profileContext` — the *normative* payload built from the layer's
  `consumed_profile` via `buildContext` (`context-profiles.ts`). Hosts running
  under the conformance contract should send this, not `chatContext`.

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

## Structured output tools (`agents/schemas.ts`)

Claude is forced to return JSON via `tool_choice: { type: 'any' }` over one of two
tools:
- `WRITE_UW_SECTION_TOOL` (`write_uw_section`) — single section. Required fields:
  `section_id`, `confidence` (`high|medium|low`), `human_review_required`,
  `flags[]`, `section_data`; optional `notes`.
- `WRITE_MULTIPLE_SECTIONS_TOOL` (`write_multiple_uw_sections`) — an array of the
  same shape; used only by L0 and L4.

The runner ignores any `_meta`/`_notes` Claude tries to put inside `section_data`
— **the host owns `_meta`**, built fresh via `buildMeta`.

## The runner (`agents/bancroft.ts`)

```ts
runBancroftAgent(fileContent, agentId, opts) → Promise<BancroftRunResult>
runBancroftAgentStreaming(fileContent, agentId, opts) → Promise<BancroftRunResult>
```

`BancroftRunOptions`: `apiKey` (required), `model?` (default `claude-sonnet-4-6`),
`maxRetries?` (default 2), `maxTokens?` (default 4096), `temperature?` (default
0.1), `userInstructions?`, `onProgress?`.

Flow:
1. Parse file, `buildAgentContext`, check `isContextReady` (else return a
   not-ready failure without calling Claude).
2. `buildAgentPrompt`, then call `client.messages.create` (or `.stream`) with the
   system prompt, user message, the layer's tool, and `tool_choice: 'any'`.
3. `extractToolOutputs` pulls the `tool_use` block(s). If Claude didn't call the
   tool, retry with `sleep(1000 * retries)` backoff up to `maxRetries`.
4. On exhausted retries, write a `writeErrorEntry` (`AGENT_NO_TOOL_CALL`) to the
   pipeline log and return failure.
5. On success, `writeSectionOutputs` re-parses before each write, bumps the
   block version, builds `_meta` (`source: agentId`, `actor: 'system'`,
   `agent_version: '1.0.0'`, plus confidence/flags/notes from the tool output),
   calls `writeAgentBlock`, and updates `pipeline_state[layer.pipelineStateKey] =
   'complete'`.

Result includes `success`, `updatedContent`, `sectionsWritten`, `tokensUsed`,
`durationMs`, `logEntryIds`, `retries`, optional `error`. `ProgressEvent.stage`
goes `context_built → calling_claude → parsing_output → writing_block → complete`
(or `error`).

> **Rate limiting / caching:** there is only simple linear backoff on retry. No
> token-rate awareness, no prompt caching, no response caching today.

## Context profiles (`context-profiles.ts`)

`buildContext(parsed, profile, opts) → ContextResult`. Profiles: `summary`,
`compact`, `relevant`, `full`, `live`. Each layer declares which it `consumes`;
Tier-4 profile conformance asserts the `layer → profile` map matches the baseline.

## Running a layer from the CLI

```bash
uwmd run deal.uw.md --agent L2 --context-only   # inspect curated context
uwmd run deal.uw.md --agent L2 --prompt         # print system+user prompts
uwmd run deal.uw.md --agent L2 --live           # call Claude (needs ANTHROPIC_API_KEY)
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
4. If it writes multiple sections, add its id to `MULTI_SECTION_LAYERS` in
   `agents/schemas.ts`.
5. If it consumes a new pipeline-state key, extend `UWPipelineState` in `types.ts`.
6. Add a Tier-4 profile expectation and (optionally) a shape fixture under
   `conformance/tier-4-agent-host/`. Run `npm run conformance -- --tier=4`.
