# Agent product removal: separate 5.0 plan

Status: proposed package breaking-change plan; not implemented by the 4.x
cleanup. See the [inventory and authority reconciliation](2026-10-15-architecture-boundary.md).
The version here means core/CLI package 5.0.0. A package major is not, by itself,
authorization to change Format or Protocol, bump their versions, or accept a
draft RFC. Coordinate with the existing release-preparation workstream before
editing versions, lockfiles or release artifacts.

## Target and compatibility matrix

UWMD remains vendor-neutral and verifier-heavy. StackUW owns modeling, agents
and workflows. External producers need no StackUW account, package or model
architecture to create records that UWMD can verify.

| Current public surface | 4.x | Proposed 5.0 disposition and migration |
|---|---|---|
| Root `runBancroftAgent`, `runBancroftAgentStreaming`, run/result/progress types | Preserve behavior | Remove from UWMD; product host owns execution, retries and streaming. No replacement package name or StackUW API is promised by this plan. |
| Root and browser `BANCROFT_LAYERS`, context/prompt/readiness/dependency builders and `AgentContext`, `BancroftPrompt`, `LayerDefinition` | Preserve | Remove product layer registry and prompt builders; callers own prompts, readiness and workflow structure. |
| Root tool constants, `MULTI_SECTION_LAYERS`, `ToolOutput` | Preserve | Move tool definitions to the product host; use generic UWMD edit proposals at the boundary. |
| Root `AgentProviderError`, provider/request/completion/message/tool types; `createAnthropicProvider`, options | Preserve | Remove execution/provider integration from core. Product installs its own vendor SDK or uses its own provider interface. |
| Root replay/recording factories, cassette parser/fingerprint/version and related types | Preserve | Move with product execution and its tests; do not replace financial conformance evidence with model cassettes. |
| Root/browser `writeAgentBlock`, `writeErrorEntry`, `AgentOutput`, `RunOptions`, `RunResult` | Preserve | Remove only after a writer-callsite audit and documented migration to `applyEdit`/`applyEditAsync` or a product-owned writer. Generic editing is not a drop-in replacement for implicit quick-metric/pipeline-state/log side effects. Preserve those intentionally in the host where needed. |
| Root `buildContext`, profile/options/result types | Preserve | Review each use; migrate product token-budget/context bundling. Keep normative representations and read bindings independently available. Do not silently rename context packaging into a verification profile. |
| Root/browser `AgentHostCapability`; core manifest `agent-host` claim | Preserve | Remove core's execution type/claim after removal; preserve accepted manifest vocabulary and external module declarations unless separately governed. |
| `uwmd run`, `uwmd layers` and their command-specific flags/help/tests | Preserve all modes, including JSON-input/dry context/prompt modes | Remove together. Document generic `uwmd edit` and product-host alternatives, including attribution and explicit write semantics. Keep shared options for other commands. |
| Anthropic optional peer/dev dependency and root lockfile entries | Preserve | Remove core SDK declarations/imports after no remaining product user; regenerate lockfile and verify peer-free consumers and browser closure. Never delete another package's transitive dependency by name alone. |
| Five `.codex/skills/uwmd-*` workflow directories and companion `agents/openai.yaml` | Preserve | Transfer to product ownership with an explicit destination/version and migration instructions, then remove UWMD-distributed workflow copies and discovery references. Generic format-use/download instructions remain. |

The actual release must enumerate all value **and type** removals from the then
current barrels and declarations. The matrix is a family-level inventory, not
permission to drop unrelated exports from mixed modules.

## Ordered implementation

1. Capture exact root/browser/CLI/declaration baselines at the chosen 5.0 base.
   Audit consumers, including CLI, editor/initializer, bindings, render/report,
   signing capability types and tests. Publish migration examples before deletion.
   Do not add an empty compatibility shim that silently discards writes.
2. Finish separating generic metadata/editing from the legacy runner. The 4.x
   cleanup already removes the editor/initializer's `buildMeta` detour. Verify
   supersede history, actor identity, roles, integrity, pipeline logs and any
   requested frontmatter updates through the replacement path.
3. Remove execution, provider adapters, prompts, layer registry, tool schemas,
   product-specific context packaging and their public exports. Remove runner
   exports only after step 2's migration is complete. Keep verify dependency
   direction and core's remaining verify re-exports.
4. Remove `run`/`layers` dispatch, parser allowlists and product help; remove
   only the reference implementation's `agent-host` claim. Retain CLI verify,
   edit, provenance options, binding support and external manifest inspection.
5. Migrate product unit tests, starter agent fixtures and cassette tooling with
   the products. Update corpus-index ownership and relevant guard expectations
   deliberately; retain shared runner infrastructure, normative module rejection
   fixtures and published historical results. Keep editor starter coverage.
6. Remove the SDK peer/dev declarations, regenerate the workspace lockfile,
   update package descriptions and all affected docs/site/download discovery.
   Keep historical RFCs and publication records as evidence. Replace live
   Bancroft recipes with migration notes; keep contributor instructions.
7. Release through the ordinary governed process, with explicit package semver
   and migration evidence. Do not merge the 5.0 deletions into this 4.x PR.

## Contracts that cannot be swept away

Retain `_meta` agent provenance, namespace/authority parsing, source identities,
append-only history, roles, integrity/signatures and receipts. Retain normative
`agent_layers`/`prompt_template` validation and externally advertised capability
vocabulary. Retain module, HTTP/MCP and generic edit contracts. Retain verifier
math, dictionary and builtin pack data needed to check existing receipts.

Any later contract removal needs its own RFC, compatibility analysis and aligned
spec/schema/protocol/conformance changes. #355 must proceed through its own RFC
for bound returns, declared-ledger coverage or named identities; this product
removal plan neither changes those contracts nor creates a projection engine.

## Acceptance evidence

- Snapshot and review the exact intentional export/command removals; update the
  4.x superset guard only for the 5.0 baseline, never to green a 4.x deletion.
- Run build, all tests, test typecheck, full conformance, schema validation and
  applicable package/lockfile/version/index/code/release guards plus site build.
- Pack and install verify alone and core without optional vendor peers. Check
  both entries and strict TypeScript declarations. Verify an existing core-issued
  receipt and agent-authored record without any model execution dependency.
- Exercise generic edit/MCP/HTTP source-edit paths with provenance, stale-parent
  rejection and integrity maintenance; show the migrated product writer does
  not lose intended log/frontmatter updates.
- Check that removed commands/exports fail clearly, retained commands work, and
  the core manifest no longer advertises execution it cannot perform.
- Confirm the diff contains no normative expectation or formula changes. Run
  current-main integration checks again after resolving release-branch overlap.

Unresolved implementation prerequisites: the product's actual migration
destination and version, the writer side-effect migration, retained generic
context use cases, and the agreed 5.0 release base. These need concrete evidence
before removal, not speculative replacement APIs in the 4.x package.
