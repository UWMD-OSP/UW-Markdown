# Agent product removal: separate 5.0 plan

Status: proposed package breaking-change plan; not implemented by the 4.x
cleanup. See the [inventory and authority reconciliation](2026-10-15-architecture-boundary.md).
This is a proposed coordinated-launch breaking migration, not authorization to
prepare a release or a predetermined package-version assignment. Independent
versioning remains applicable. No release base, activation date, Format/Protocol
change or draft RFC acceptance is selected here. Obtain explicit owner approval
before deleting public contracts or beginning coordinated-launch preparation.

## Target and compatibility matrix

UWMD remains vendor-neutral and verifier-heavy. StackUW owns modeling, agents
and workflows. External producers need no StackUW account, package or model
architecture to create records that UWMD can verify.

| Current public surface | 4.x | Proposed 5.0 disposition and migration |
|---|---|---|
| Root `runBancroftAgent`, `runBancroftAgentStreaming`, run/result/progress types | Preserve behavior | Remove from UWMD; product host owns execution, retries and streaming. No replacement package name or StackUW API is promised by this plan. |
| Root and browser `BANCROFT_LAYERS`, context/prompt/readiness/dependency builders and `AgentContext`, `BancroftPrompt`, `LayerDefinition` | Preserve | Remove product layer registry and prompt builders; callers own prompts, readiness and workflow structure. |
| Root tool constants, `MULTI_SECTION_LAYERS`, `ToolOutput` | Preserve | Retire host tool definitions after approval; adopters may define their own. No automatic transfer or replacement package is authorized. |
| Root `AgentProviderError`, provider/request/completion/message/tool types; `createAnthropicProvider`, options | Preserve | Remove execution/provider integration from core. Product installs its own vendor SDK or uses its own provider interface. |
| Root replay/recording factories, cassette parser/fingerprint/version and related types | Preserve | Retire with approved host execution removal; any adopter migration is a separate decision. Model cassettes are not financial conformance evidence. |
| Root/browser `writeAgentBlock`, `writeErrorEntry`, `AgentOutput`, `RunOptions`, `RunResult` | Preserve | Preserve these generic provenance-aware writer APIs and `buildMeta` by default. Any later removal requires an independent use-case audit, exact compatibility proposal and owner approval; host retirement alone is insufficient. |
| Root `buildContext`, profile/options/result types | Preserve | Preserve generic `buildContext` and its profile/options/result types by default. Any later removal requires an independent use-case audit and owner approval. Context packaging is not a financial verification profile. |
| Root/browser `AgentHostCapability`; core manifest `agent-host` claim | Preserve | Remove core's execution type/claim after removal; preserve accepted manifest vocabulary and external module declarations unless separately governed. |
| `uwmd run`, `uwmd layers` and their command-specific flags/help/tests | Preserve all modes, including JSON-input/dry context/prompt modes | After approval, refuse retired commands explicitly before I/O; do not fall through to successful help. Preserve generic `uwmd edit`, its attribution flags and shared options for other commands. |
| Anthropic optional peer/dev dependency and root lockfile entries | Preserve | Remove core SDK declarations/imports after no remaining product user; regenerate lockfile and verify peer-free consumers and browser closure. Never delete another package's transitive dependency by name alone. |
| Five `.codex/skills/uwmd-*` workflow directories and companion `agents/openai.yaml` | Preserve | Retire UWMD workflow assets only after owner approval of asset/URL support policy. No automatic copying, required StackUW destination or replacement package is authorized. Any adopter migration is a separate decision, not a retirement prerequisite. Generic format-use/download instructions remain. |

The actual release must enumerate all value **and type** removals from the then
current barrels and declarations. The matrix is a family-level inventory, not
permission to drop unrelated exports from mixed modules.

## Ordered implementation

1. After approval, capture exact root/browser/CLI/declaration baselines at the
   explicitly reviewed implementation base; no release base is selected here.
   Audit consumers, including CLI, editor/initializer, bindings, render/report,
   signing capability types and tests. Publish migration examples before deletion.
   Do not add an empty compatibility shim that silently discards writes.
2. Preserve `writeAgentBlock`, `writeErrorEntry`, `AgentOutput`, `RunOptions`,
   `RunResult`, `buildMeta` and generic `buildContext` with its public types. The
   4.x editor/initializer import cleanup preserves the same `buildMeta` binding;
   it does not authorize writer retirement. Verify supersede history, identity,
   roles, integrity, pipeline logs and requested frontmatter updates unchanged.
3. Remove execution, provider adapters, prompts, layer registry, tool schemas,
   host-specific context/prompt builders and their approved public exports. Keep
   generic writers/context APIs by default. Keep verify dependency
   direction and core's remaining verify re-exports.
4. After approval, replace `run`/`layers` dispatch with explicit retired-command
   refusals, proposed usage exit 2, before file reads/writes or provider/network
   requests. Cover live, JSON-input, context and prompt modes. Merely deleting
   dispatch reaches the current successful unknown-command/help fallback.
   Remove only the reference implementation's obsolete `agent-host` claim;
   retain verify, edit attribution flags, bindings and manifest inspection.
5. Retire only tests/fixtures/tooling exclusively exercising approved removed
   products. Copying them into an adopter product requires a separate decision.
   Update corpus-index ownership and relevant guard expectations
   deliberately; retain shared runner infrastructure, normative module rejection
   fixtures and published historical results. Keep editor starter coverage.
6. Remove the SDK peer/dev declarations, regenerate the workspace lockfile,
   update package descriptions and all affected docs/site/download discovery.
   Keep historical RFCs and publication records as evidence. Replace live
   Bancroft recipes with migration notes; keep contributor instructions.
7. Prepare a bounded implementation proposal with migration evidence for owner
   approval. Release preparation, package-version selection and publication
   require their own authorization. This 4.x PR removes no public contracts.

## Contracts that cannot be swept away

Retain `_meta` agent provenance, namespace/authority parsing, source identities,
append-only history, roles, integrity/signatures and receipts. Retain normative
`agent_layers`/`prompt_template` validation and externally advertised capability
vocabulary. Retain module, HTTP/MCP and generic edit contracts. Retain verifier
math, dictionary and builtin pack data needed to check existing receipts.

Current Format §6.3 still describes `uwmd run`; §6.8 imposes MUST requirements
on Bancroft writers. RFC 0078's retired Agent Host tier does not erase these
Format provisions. Before final command/API retirement, obtain a governed
clarification distinguishing reference-product behavior from retained
independent-producer obligations. Preserve source authority, metadata,
provenance, history and current validation/conformance behavior until that
decision. This plan changes none of them.

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
  rejection and integrity maintenance; show retained generic writers preserve
  intended log/frontmatter updates. No adopter-product migration is assumed.
- Check that removed commands/exports fail clearly, retained commands work, and
  the core manifest no longer advertises execution it cannot perform.
- Confirm the diff contains no normative expectation or formula changes. Run
  current-main integration checks again after resolving release-branch overlap.

## Exact candidate public removals (approval required)

This snapshot names the proposed host-specific removals, not approved deletions.
Reconcile it against the reviewed implementation base before any removal.

Runtime values (17): `runBancroftAgent`, `runBancroftAgentStreaming`,
`WRITE_UW_SECTION_TOOL`, `WRITE_MULTIPLE_SECTIONS_TOOL`, `MULTI_SECTION_LAYERS`,
`AgentProviderError`, `createAnthropicProvider`, `createReplayProvider`,
`createRecordingProvider`, `parseAgentCassette`, `agentRequestFingerprint`,
`CASSETTE_VERSION`, `buildAgentContext`, `buildAgentPrompt`, `isContextReady`,
`getLayerDependencies`, `BANCROFT_LAYERS`.

Additional type-only names (18): `BancroftRunOptions`, `BancroftRunResult`,
`ProgressEvent`, `ToolOutput`, `AgentProvider`, `AgentRequest`, `AgentCompletion`,
`AgentToolCall`, `AgentToolSchema`, `AgentMessage`, `AnthropicProviderOptions`,
`AgentCassette`, `RecordedExchange`, `RecordingProvider`, `AgentContext`,
`BancroftPrompt`, `LayerDefinition`, `AgentHostCapability`.

Browser subset: the five layer/context values and `AgentContext`,
`BancroftPrompt`, `LayerDefinition`, `AgentHostCapability`.
`AgentProviderError` also has its class type facet. Generic writers/context APIs,
verify exports and normative module declarations are excluded.

Remaining owner decisions: approve the exact host export/command retirement set,
the proposed refusal behavior and asset/URL support policy; resolve the governed
Format §6.3/§6.8 boundary. An adopter migration destination/version is not a
prerequisite. Independent package versions and launch preparation remain separate
decisions. No 5.0 release preparation is authorized by this plan.
