# 06 — Agent writers and context profiles (starter product)

> RFC 0078 retired Tier 4 (Agent Host) as a Protocol tier, and RFC 0112 removed
> the Bancroft layer vocabulary from the standard and the toolkit: the layer
> registry, its context, prompt and readiness builders, frontmatter
> `pipeline_state`, module `agent_layers`, the `agent-host` capability and
> `uwmd layers`. What remains is described in the non-normative
> [agent writers guide](../starter/ai-host.md).

**The reference toolkit hosts no agents.** `@uwmd/core` runs no model, ships no
provider adapter, tool schema, replay cassette or layer registry, and the CLI
has no `uwmd run` or `uwmd layers` command. A host that runs its own agents
(StackUW, or any other producer) does the execution itself and writes each
record through the generic writers (`writeAgentBlock`, `writeErrorEntry`) or the
edit API (`applyEdit`, `uwmd edit --agent-id/--agent-version`). The format's
provenance, supersede and pipeline-log rules, and its producer obligations
(Format §3.6), apply to those writes as to any producer's. **Agents extract and
narrate; they never compute financial metrics** (invariant 1).

- **Location:** [`src/context-profiles.ts`](../../packages/uwmd-core/src/context-profiles.ts)
  + the generic writers in [`src/runner.ts`](../../packages/uwmd-core/src/runner.ts).
- **Starter contract:** [agent writers guide](../starter/ai-host.md) §IX,
  non-normative since RFC 0078.
- **Ownership:** StackUW owns modeling, agents and workflows. See the
  [inventory](../reviews/2026-10-15-architecture-boundary.md) and
  [removal plan](../reviews/2026-10-15-agent-removal-5.0.md).
- **Public API:** `writeAgentBlock`, `writeErrorEntry`, `buildMeta` (root and
  browser entries) and `buildContext` (root entry only), with the types
  `AgentOutput`, `RunOptions`, `RunResult`, `ContextProfile`,
  `BuildContextOptions` and `ContextResult`.

## Agent identity in provenance

The standard keeps who wrote each block, not which layer of which product did
(RFC 0112 D2). An agent writes under the generic `agent/<id>` source with
`agent_id` and `agent_version` (Format §2.5–§2.6), for example
`agent/risk-rater`. The `actor` stays free-form. Where a section restricts what
a non-user source may state, its Format entry carries a **Source rules** line
(for example, a non-user source MUST NOT state a capital stack tranche `rate`,
`amount` or a stated `sizing` value).

## Writing an agent's output

The host owns `_meta`: it builds it with `buildMeta()` and passes it with the
section payload to `writeAgentBlock(fileContent, parsed, { sectionId, content },
opts)`, which supersedes the prior block, appends the new versioned block and a
`pipeline_log` entry, updates `last_modified`, and applies any requested
`quick_metrics` updates. It drops any `_role` or `_overrides` the payload
carries. A failed run records a `writeErrorEntry`. Neither function calls a
model.

## Context profiles (`context-profiles.ts`)

`buildContext(parsed, profile, opts) → ContextResult`. Profiles: `summary`,
`compact`, `relevant`, `full`, `live`. `relevant` takes the caller's section
list in `opts.sections`. The `summary` profile carries the slim frontmatter
(`status` and `deal_stage` for workflow position) and `quick_metrics`.
