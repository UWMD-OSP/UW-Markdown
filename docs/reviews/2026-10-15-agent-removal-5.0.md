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

Browser subset: `buildAgentContext`, `buildAgentPrompt`, `isContextReady`,
`getLayerDependencies`, `BANCROFT_LAYERS` and `AgentContext`,
`BancroftPrompt`, `LayerDefinition`, `AgentHostCapability`.
`AgentProviderError` also has its class type facet. Generic writers/context APIs,
verify exports and normative module declarations are excluded.

Remaining owner decisions: approve the exact host export/command retirement set,
the proposed refusal behavior and asset/URL support policy; resolve the governed
Format §6.3/§6.8 boundary. An adopter migration destination/version is not a
prerequisite. Independent package versions and launch preparation remain separate
decisions. No 5.0 release preparation is authorized by this plan.


## Implementation-base reassessment and governed clarification

This refinement was inspected against merged main
`50bf4c13206560848c5bb9b045f4532ad3cd8633`, after PR #359. It is a
proposal-only follow-up, not authority to remove the listed exports, accept an
RFC, change a validation result or select release versions. The historical
filename identifies the intended coordinated-launch discussion, not release
preparation. The 17 runtime names and 18 additional type-only names above were
checked against the current root/browser barrels; no further removals are implied.

The proposed governed text treatment must cover more than the CLI subsection:

| Existing normative reference | Candidate treatment requiring review | Protected meaning |
|---|---|---|
| Format §1.2, “Toolchain-agnostic,” says proprietary Bancroft/CLI tooling is required to generate sections correctly | Propose removing the exclusive-producer assertion and describing any producer that satisfies the record/writer contracts. Do not silently declare this sentence already repealed | Open production and independent verification; no required StackUW runtime |
| Format §1.3 maps Bancroft layers, wizard and deterministic engine to sections | Propose identifying this as a historical/reference workflow mapping, rather than a mandatory producer architecture. Check every dependent “Written by” reference before moving wording | Section meanings, source authority and prohibited invented inputs remain enforceable |
| Format §2.2 pipeline-state comment ties keys to `BANCROFT_LAYERS`; §2.2 frontmatter retains institutional identity | Keep represented keys, default state, reserved-L3 rule and identity fields. Propose decoupling their descriptions from a shipped runtime only through governed clarification | Existing records and validation stay interpretable; descriptive identity never routes underwriting behavior |
| Format §2.5/§2.6 provenance/source identifiers, §3.1 source hierarchy and Part IV “Written by”/MUST NOT rules | Preserve `agent/*`, required agent identity/version when applicable, producer attribution and source prohibitions. Audit wording for historical product names individually | No namespace deletion or loss of writer accountability merely because the host is retired |
| Format §6.3 `uwmd run`, §6.4 Bancroft/tier display description | Propose separating historical/reference CLI behavior from interoperable document requirements; update only after explicit approval | Generic rendering and source records remain supported; CLI retirement is not a format refusal |
| Format §6.8 numbered Agent Contract | Classify each of its eight obligations before editing: read state; schema; host metadata; revision; current/superseded state; scope; review flag; missing-input response. Product request/response mechanics and independent-producer invariants must not be removed together | No implied repeal of MUST language or new obligation for every unrelated producer |
| Protocol §II.4 and Appendix F; module schema/types including `agent_layers`/`prompt_template` | Preserve retired-tier separation and external capability/declaration vocabulary. Remove only core's obsolete implementation claim after its runtime is actually removed | Third-party hosts may continue advertising their own product capabilities and producing verifiable records |
| Protocol §V.2–§V.4 and §V.9–§V.11, receipts and bindings | No proposed change in this workstream | Replace/supersede, authority, metadata, canonical digests, integrity/signatures, receipt subjects and transports retain their established semantics |

Format §1.2's compaction sentence remains RFC 0085 work; do not use this product
cleanup to decide history authority. The institutional-profile wording is not
permission to delete `institution_config_id`. Likewise, protocol use of the
term “agent-host accountability” describes attributable evidence, not a runtime
requirement. This table identifies candidate clarification scope; it supplies
no accepted replacement text, changed severity or new conformance obligation.

## Call-site and distribution migration controls

| Current consumer or distribution path | Smallest future change after approval |
|---|---|
| `core/cli.ts` invokes layer/prompt helpers and dynamically loads `runBancroftAgent`; `cli-args.ts` accepts host flags | Tombstone `run` and `layers` before file, JSON-input, output or provider handling. Retain `edit --agent-id/--agent-version`; do not map host JSON-input writes to `edit` silently |
| `core/agents/bancroft.ts` consumes context, tool schemas, provider interface and optional Anthropic factory | Retire the execution closure together; no orphan provider or retry layer in verify |
| `scripts/rerecord-cassettes.mjs` and agent dispatch in `scripts/run-conformance.mjs` | Retire only the removed host's recording/dispatch branches, with explicit corpus ownership/count review; preserve runner infrastructure for standard cases |
| `core/runner.test.ts` mixes layer-context and generic writer cases | Separate/remove host-specific context tests while keeping writer metadata, byte/supersede, error-log and frontmatter cases; do not delete the whole file |
| Provider/context unit tests, `surface.test.ts`, `fixtures/public-surface-4.0.json` | Deliberately test the approved removed set and retained names. Do not regenerate a compatibility snapshot wholesale to conceal unrelated removal |
| `scripts/verify-packages.mjs` imports `createAnthropicProvider` in a strict consumer | Remove only that approved factory consumer; retain root/browser declaration tests, SDK-free verification and generic core consumer checks |
| Other workspace packages and external adopters | A package depending on core is not evidence it uses the host. Recheck exact imports at implementation time; no complete external reverse-dependency survey or StackUW source audit is claimed |

`AgentProviderError` is a runtime class and also has a type facet; the 18
additional type-only count does not count that facet twice. The browser has
five candidate runtime removals and four candidate type-only removals, not the
root's complete host surface. Generic `buildContext` currently exports from the
root entry only (`ContextProfile`, `BuildContextOptions`, `ContextResult`);
this proposal neither adds it to the browser entry nor removes it. Existing
root/browser generic writers and all verify re-exports stay intact.

Current `conformance/corpus-index.json` identifies exactly five host-product
checks, all owned by `starter-products`: `starter-agent/l0a-scope-deterministic`,
`starter-agent/l6-risk-rating`, `starter-agent-profile/consumer-profile-contract`,
and `starter-agent-replay/l6-risk-rating/{sections,document}`. Their proposed
retirement requires explicit review of that exact count/ownership delta. Retain
Module `02-agent-layer-malformed`, schema parity and all standard cases. If a
portable index change is necessary, regenerate only that derived index through
its documented process after approval; never rewrite financial expected results
or weaken dispatch/coverage guards to accommodate the removal. Historical run
reports and cassette evidence remain historical evidence, not new financial
verification. Current fixtures remain unchanged by this proposal.

For command refusals, test bare commands, valid old flags, missing/nonexistent
input, malformed JSON-input, attempted output, all offline modes and live mode
with/without a configured API key. The proposed refusal must occur before I/O,
not merely before the hosted API call. Unknown flags must still fail strictly;
a retired-command diagnostic may take precedence for recognized legacy host
syntax, with no successful help fallback. No key is required or transmitted to
test these refusals. The exact diagnostic contract and exit 2 remain proposals.

SDK removal means deleting the core optional peer, its optional-peer metadata,
dev dependency and dynamic loader only when no retained code references them.
Regenerate the lockfile normally, retaining any independently required
transitive SDK dependency elsewhere. Prove packed verify/core imports and strict
declarations work without the peer; compare package contents and browser
closure. This package-only cleanup does not change receipt engine identity or
existing receipt verification rules. Future package-version/pin updates follow
independent versioning when separately authorized.

The five workflow directories are `uwmd-intake-scope`,
`uwmd-document-extraction`, `uwmd-validation-triage`, `uwmd-batch-exceptions` and
`uwmd-portfolio-rollup`, under `.codex/skills/`, including their
`agents/openai.yaml` descriptors. A directory being hidden or named “agents”
does not make it a contributor instruction. Conversely, root/package coding
`AGENTS.md`/`CLAUDE.md` must remain. `agents/L0b-prompt.md` is a repository asset;
current core packaging ships dist/README, not arbitrary source Markdown, so
asset retirement is not automatically a separate promised npm-path removal.

Keep producer-neutral Format instruction downloads and machine-readable
`llms.txt`/`llms-full.txt`. `tools/docs-site/scripts/prepare-public.mjs` copies
`UWMD-AI-GUIDE.md`, `CLAUDE.md`, `GEMINI.md`,
`chatgpt-project-instructions.txt` and `uwmd-skill/SKILL.md` to existing public
URLs; those are not the five workflow directories. The default proposal is to
retain these neutral instruction paths. Decide separately whether `/ai/`,
`/ai/skills`, `/starter/ai-host` and host-specific anchors retain compatibility
notes, redirect or retire after a documented support window. Do not silently
change download bytes, erase historical records or assume an available redirect
facility. No deployment or public URL change is made here.

## Genuine owner decisions and minimum future sequence

1. **Removal scope:** approve or narrow the exact 17 runtime/18 type candidate
   set, browser facets and `run`/`layers` modes. Generic writer/context APIs
   remain preservation defaults, not another open removal decision.
2. **Governed boundary:** approve the classification/replacement treatment of
   Format §1.2/§1.3/§6.3/§6.8 and dependent references, retaining producer/source
   obligations. Determine any Format/Protocol compatibility/version consequence
   through normal RFC review; do not infer acceptance from this report.
3. **Command compatibility:** approve explicit pre-I/O retired-command behavior,
   proposed exit 2 and diagnostic precedence rather than successful fallback.
4. **Asset/support policy:** approve workflow/prompt retirement and compatibility
   documentation/URL support window. No mandatory adopter migration destination.
5. **Activation:** authorize the eventual breaking implementation and support
   window separately. Package version selection, release preparation and public
   launch remain later independent approvals.

Smallest future sequence: settle the governed boundary and exact compatibility
scope first; then prepare one bounded host/CLI/SDK retirement with its necessary
consumer and starter-only test updates; then retire approved workflow assets
and documentation discovery under the chosen support policy. Keep generic
writers/context, deterministic verification, source records and HTTP/MCP
throughout. Re-run retained provenance/receipt and independent-consumer evidence.
Do not combine optional financial assurance, numerical procedure revisions or
RFC 0085 compaction implementation with this removal.
