# AI-agent product surface — inventory and compatibility assessment

Owner direction: 2026-10-15. Canonical repository: UWMD-OSP/UW-Markdown.
Inspected main: `a18ed8ee7f502e2bd538c3c96be1584f94c458b9`, tree
`1473f7266602bc9e675b0cdb9ceab37aaaa17d1d`. Current published core/CLI 4.3.0,
verify 0.2.1, Format 3.0 / Protocol 4.1.0; full independent matrix remains VERSIONS.md.
Primary user checkout is clean on an unrelated RFC 0085 branch; other worktrees
are untouched. Git fetch failed DNS; GitHub API main/tree and open PRs were
checked directly. PR335/RFC 0085 and PR357/RFC 0088 remain separate draft work.

## Architectural conclusion

UWMD is an open underwriting interoperability and verification standard.
StackUW and unrelated adopter applications own agents, skills, prompts,
orchestration, assumptions, model production, scenarios and provider integration.
Compatibility with AI consumers follows from the same published contracts and
APIs used by other software; it does not require a bundled agent product.

RFC 0078 D1/D3/D8 and implemented RFC 0083 remain the architectural foundation:
the host already is **non-normative**, but is also a **published public API**.
Non-normative does not mean removable without package compatibility treatment.
This inventory authorizes no breaking deletion and no acceptance of other RFCs.
No implementation is copied or automatically migrated to StackUW.

## Protected contract and generic automation surfaces

| Surface | Disposition / reason |
|---|---|
| Format, Protocol, schemas, dictionary, receipts, integrity/signatures, deterministic verifiers/primitives | Preserve. Do not remove numerical verification because agents used to invoke it. #356 is a separate correctness investigation |
| Provenance `agent/*`, actor/id/version, `_meta`, `agent_run` log events, source tags, supersession and existing signatures/history | Preserve original data and verification. External producers may still use agents; source authorship is not a bundled runtime |
| Pipeline-state fields and Part IV source/writer annotations | Preserve represented records; retiring a DAG does not remove data fields or reinterpret historical records |
| `ModuleManifest.agent_layers`, `ModuleAgentLayerDecl`, schema validation, `ViewerCapability`/manifest `agent-host` vocabulary | Preserve interoperable declarations and validation. Third-party modules/tools may still declare them. The module rejection fixture is a Module contract, not a host replay test |
| HTTP/MCP and representation bindings, generic source-edit adapters | Preserve. Transport tools are not a provider integration or workflow engine |
| `AGENTS.md`, `CLAUDE.md` pointers/package instructions, developer wiki | Preserve coding-agent development instructions. Update architecture descriptions without deleting the instructions |
| `parseUWFile`, validation/verification, `buildMeta`, `applyEdit`/`applyEditAsync`, deterministic `buildContext`, rendering/context profiles, generic bindings | Preserve third-party automation APIs and byte/provenance safeguards. No `AgentProvider` is needed to use them |
| `runner.ts`: `writeAgentBlock`, `writeErrorEntry`, `AgentOutput`, `RunOptions`, `RunResult`; `buildMeta` re-export | Preserve for now. This is also a standalone provenance-aware write path, not the hosted orchestration loop. Its existing name/event semantics are not silently renamed or generalized |
| `llms.txt` / `llms-full.txt`, contract discovery and machine-readable documentation | Preserve AI-compatible discovery; distinguish it from installable business-operation skills |

### Normative text requiring governed treatment before a final removal

Format §6.3 still describes `uwmd run`; §6.8 contains MUST requirements on agent
writers, including schema/meta/revision/scope/missing-input behavior. Part IV also
has “Written by” descriptions and the historical layer mapping. Protocol II.4
explicitly places agent hosting outside conformance tiers, and former IX is in
the starter guide. **Do not infer that every Format requirement disappeared.**
Keep all those normative files and current validation results unchanged now.
A separate draft migration must identify any §6.3/§6.8 clarification, retain
independent producer/provenance constraints and distinguish reference-product
behavior from requirements imposed on interoperable records. Removing an SDK
is not authority to weaken source authentication or writer accountability.

## Product inventory

| Location | What actually ships / exists | Recommended treatment |
|---|---|---|
| `packages/uwmd-core/src/agents/bancroft.ts` | Single/streamed LLM invocation, retries, model/temperature defaults, tool calls, edit dispatch, progress/token reporting | Retire as an adopter-product feature after approved public API migration |
| `agents/provider.ts`, `agents/providers/anthropic.ts` | Provider interfaces/errors and dynamic SDK/client construction; API keys and hosted requests | Retire with the host, not move into verify or another UWMD agent package |
| `agents/providers/replay.ts` | Cassette format, fingerprinting, recording and replay of the model request/response | Retire provider-specific test infrastructure with the host; preserve generic conformance infrastructure |
| `agents/schemas.ts` | LLM function-tool schemas, multi-section layer set, tool-output type | Retire with product; these are not the MCP transport schema |
| `context.ts` | Nine-entry Bancroft DAG, read/write/pipeline mapping, readiness/dependency logic, system/user prompt generation | Retire layer-specific helpers; retain the separate generic `context-profiles.ts` |
| `agents/L0b-prompt.md` | Repository prompt asset; no tracked code reference found by search | Candidate for asset retirement; do not claim a public package removal from the filename alone |
| `runner.ts` | Generic-ish block writer/error log path used by host, CLI and editor safeguards | Keep unchanged pending separate design if a neutral replacement is needed; do not delete by directory/name matching |
| Core `index.ts` and `browser.ts` | Explicit published exports listed below; browser excludes network host but still exports layer/prompt helpers | Main and browser both need approved breaking migration; SDK-free is not agent-product-free |
| Core manifest and lockfile | SDK `^0.91.1` both dev dependency and optional peer; resolved root SDK 0.91.1 | Keep while provider compiles/runs; remove both declarations and obsolete lock entries only with approved runtime retirement |
| `reference-implementation.ts` | Core's manifest currently claims `agent-host` | Keep truthful in 4.x while host ships; eventually stop this implementation's claim without deleting the normative vocabulary |
| `cli.ts`, `cli-args.ts` | `run` context/prompt/JSON-input/live paths; `layers`; `ANTHROPIC_API_KEY`, `--api-key`, `--model`, `--instructions` | Retain in 4.x; exact later retirement must cover offline modes too. Preserve `edit --agent-id/--agent-version` provenance flags |
| `.codex/skills/*` | Five business skills: intake-scope, document-extraction, validation-triage, batch-exceptions, portfolio-rollup, each with an OpenAI UI descriptor | These are underwriting workflow assets, despite their hidden developer-looking path. Plan retirement separately from AGENTS.md |
| `docs/downloads/ai/` | Platform-neutral instructions, downloadable SKILL.md, Claude/Gemini/ChatGPT instruction files | Stop promoting as a UWMD agent offering; retain existing URLs/content in 4.x pending explicit asset retirement |
| `docs/starter/ai-host.md`, wiki06, TOOLS/package/CLI READMEs | Host contract/examples, provider/API-key recipes, layer-extension instructions | Label legacy/non-normative; recommend adopter-owned implementations; keep compatibility reference available |
| Docs-site `ai/`, navigation and downloads; `prepare-public.mjs` | Public AI landing/skills promotion and copying instruction files into public downloads | Publish neutral interoperability guidance; retain routes and downloads rather than cause an unreviewed URL break |
| Historical RFCs/changelog/releases/reviews | Evidence of past decisions/publications | Preserve history; append new owner direction instead of rewriting previous acceptance |

The live uwmd.org AI/skills/tools pages were inaccessible to the browsing tool.
Website findings above are from tracked VitePress sources and copy scripts, not
an assertion that production already matches this branch. No deployment occurs.

## Exact public export proposal — approval required for deletion

The following list is a **proposed removal set**, not an implemented change.
Every name below remains exported in 4.x and in this cleanup.

Main-entry values (17, including the class's runtime binding):

```text
runBancroftAgent runBancroftAgentStreaming
WRITE_UW_SECTION_TOOL WRITE_MULTIPLE_SECTIONS_TOOL MULTI_SECTION_LAYERS
AgentProviderError createAnthropicProvider
createReplayProvider createRecordingProvider parseAgentCassette
agentRequestFingerprint CASSETTE_VERSION
buildAgentContext buildAgentPrompt isContextReady getLayerDependencies BANCROFT_LAYERS
```

Additional type-only names (18; the class above also has a type facet):

```text
BancroftRunOptions BancroftRunResult ProgressEvent ToolOutput
AgentProvider AgentRequest AgentCompletion AgentToolCall AgentToolSchema AgentMessage
AnthropicProviderOptions AgentCassette RecordedExchange RecordingProvider
AgentContext BancroftPrompt LayerDefinition AgentHostCapability
```

Browser subset: five layer/context values (`buildAgentContext`, `buildAgentPrompt`,
`isContextReady`, `getLayerDependencies`, `BANCROFT_LAYERS`) and four type-only
names (`AgentContext`, `BancroftPrompt`, `LayerDefinition`, `AgentHostCapability`).
No `@uwmd/verify` re-export, `ModuleAgentLayerDecl` or generic write/edit/context
API is included. Existing `fixtures/public-surface-4.0.json` is the explicit
compatibility anchor; this PR leaves it unchanged.

## Downstream dependency and testing inventory

Known in-repository direct consumers: core CLI; agent/context tests; mixed
writer/layer tests in `runner.test.ts`; `editor.block-roles.test.ts`; the core
public-surface/browser tests; package strict-consumer checks importing the
Anthropic factory; replay re-recording and conformance dispatch. Other packages
can depend on core without using its agent exports; dependency alone is not
evidence they need an agent host. No external reverse-dependency completeness
claim is possible here; no unrelated adopter repository was inspected.

Root lockfile contains SDK 0.91.1; tracked web-editor/docs-site/VSCode lockfiles
contain no installed SDK entry. Preserve the SDK-free verifier/strict-consumer
and browser guards. Provider tests use injected clients/replay; no hosted model
call, key, or paid request is needed for this work.

The corpus contains **five agent-product checks**, all `starter-products`:
two shape fixtures (`l0a-scope-deterministic`, `l6-risk-rating`), one
`consumer-profile-contract`, two replay checks (sections and document). They
remain blocking until the actual product is retired. They are **not** Reader or
Verifier requirements. Keep the Module `02-agent-layer-malformed` and schema
parity checks. Do not drop corpus dispatch/coverage/skip tests wholesale.

When retirement is approved, remove only those five product cases and their
dispatch/re-record recipes, document the count delta, and regenerate only the
**portable case index** under its normal procedure if needed. Do not change any
retained standard fixture/expected financial value to make tests pass. Split
mixed runner tests so provenance/editor safeguards remain meaningful. Replace
the historical core surface-superset assertion for the approved removal set
with explicit removed-name/retained-name checks; never regenerate it blindly.

## Bounded implementation sequence and compatibility

1. **Safe 4.x cleanup now:** document ownership; mark host-specific public
   declarations deprecated with JSDoc; stop recommending the host/skills for new
   integrations; correct stale claims that its context/profile/tool schemas are
   normative; retain all APIs, CLI output/flags, peers, URLs, asset bytes and
   expectations. The deprecation is advisory, but consumers that elevate
   deprecation warnings can see new diagnostics. No network/runtime behavior or
   financial number changes.
2. **Approval proposal, not release preparation:** settle exact public removal
   set, CLI retirement, Format text and asset/URL support policy. A breaking
   change is reserved for an owner-approved coordinated-launch migration; do not
   conceal it in 4.x. Independent package semver still applies; no package is
   automatically assigned version 5.0 or republished here.
3. **After approval:** remove hosted agent modules/layer helpers and SDK from
   core, update CLI/manifest/consumer tests and product-only cases together.
   Retain deterministic verification, representations, generic editing and
   provenance APIs. Selectively retire business skill assets without copying
   them into StackUW. Preserve historical records and existing normative
   vocabulary for third-party producers.

### Exact proposed CLI and adopter migration

Retire `run` **including** `--context-only`, `--prompt`, `--json-input` and live
mode, and `layers`, only after approval. Do not route them to a successful help
fallback: the present default CLI branch exits 0. Propose explicit retired-command
refusals (usage exit 2, before file reads/writes/provider requests) naming the
adopter-owned workflow alternative. Do not silently map JSON-input to `edit`:
metadata, layer gating and pipeline updates differ. Existing `edit` provenance
flags and all other approved 4.x compatibility behavior remain.

Adopter architecture: its own provider/prompts/orchestrator produces candidate
facts/narrative; its trusted host validates them and uses existing public
edit/provenance APIs; deterministic UWMD verification checks the resulting
record. Choosing a model, retry policy, scenario/model-generation graph or
application skill is the adopter's decision. No StackUW API, migration destination,
automatic code transfer, or replacement npm agent package is prescribed.

## Genuine decisions before breaking implementation

- Approve the explicit value/type removal set and CLI tombstones/exit behavior;
  retain current generic writer names unless a separately reviewed replacement
  exists. No inference that every name containing “agent” should disappear.
- Resolve Format §6.3/§6.8 reference-product versus independent-writer wording
  through the governed draft; preserve provenance/source/metadata obligations.
- Approve repository skill/prompt retirement and public-download/URL support
  policy, including how long 4.x compatibility documentation remains available.
- Choose activation/support window and package semver when the owner authorizes
  launch preparation. This assessment prepares no release/tag/publication.

RFC 0085–0087 remain draft, #343 remains open, #354–#356 remain separate
verification workstreams. No numerical or receipt-contract decision is inferred.

## Issue #355: bounded financial assurance, not model generation

The owner-approved architectural direction is to preserve RFC 0078/0083's
verifier/product boundary. This is direction for design, not acceptance of a new
profile or new financial obligations. Keep the financial profile separate from
the agent-host retirement and numerical procedures in #356/RFC 0088.

Proposed assurance levels:

1. **Declared-result binding:** identify the precise cash-flow stream, method,
   periods, variant and immutable source subject for a stated headline return.
   Recompute that assertion under the accepted numerical contract; do not infer
   an unstated stream, convention, financing basis or scenario.
2. **Optional declared acquisition-ledger coverage:** identify closing, operating
   and terminal components and check the accepted ledger identities and unique
   source bindings. Completeness means coverage of the enumerated declared
   ledger, not proof that no undisclosed real-world cash event exists.
3. **Optional additional financial identities:** admit each period relationship
   only after its source authority, applicability, precision and meaning have a
   justified normative contract. An issue comment proposing every pro forma row
   is design evidence, not owner approval for universal modeling obligations.

Revenue/expense forecasts, debt-model construction, scenario generation and
custom model mechanics remain producer capabilities. A producer can use a
monthly or annual engine, custom institutional architecture, spreadsheet or
other deterministic implementation while emitting the same verifiable claims.
No comprehensive model-generation engine is a prerequisite for 5.0.

A future coverage report may distinguish financially verified, stated-only,
failed and unverifiable assertions, but must first define its counting contract:
what constitutes one assertion; how duplicates and repeated periods count;
which requested claims are applicable; how absent, unsupported and unrequested
claims are represented; whether source/variant/method identities are distinct;
and what denominators each coverage percentage uses. An empty claim set cannot
be advertised as a fully financially verified acquisition model. Do not silently
translate these proposed presentation categories into new base validation
results or conflate authenticated provenance with financial verification.

Remaining profile decisions are the initial claim/method/basis set, accepted
ledger relationships, coverage counting/applicability and numerical guarantees
that depend on #356. Independent Python work can implement existing Reader/
Verifier obligations now; the new optional profile and disputed runtime identity
guarantees remain separate. No new formula, profile, conformance expectation or
receipt meaning is implemented here.

## Verification evidence

The PR records exact commands, local results and remote CI separately. Target
existing provider/runner/context/browser/surface and strict-consumer guards;
retain failed local subprocess gates as failures. No hosted model request,
independent Excel recalculation, deployment or external account change is run.

### Local cleanup verification (2026-10-15)

Base: `a18ed8ee7f502e2bd538c3c96be1584f94c458b9`. Environment:
Linux x86_64, Node 24.21.0, npm 11.19.0. These checks cover the local working
candidate; they are not evidence of a remote PR or independent implementation.

| Command / check | Actual result |
|---|---|
| `npm run build` | Pass, all package builds. An earlier attempt failed on three malformed newly inserted deprecation comments; those comments were corrected before this successful run |
| `npm --prefix packages/uwmd-core test -- src/agents/bancroft.test.ts src/agents/providers/anthropic.test.ts src/agents/providers/replay.test.ts src/context.test.ts src/context-profiles.test.ts src/runner.test.ts src/surface.test.ts src/editor.block-roles.test.ts --pool=forks --maxWorkers=2` | 8 files, 87 tests passed, including root/browser declaration/runtime surface compatibility |
| `npm run typecheck:tests` | Pass, all workspace test typechecks |
| `npm run lint` | Pass, no errors; one existing unused `PARKVIEW` warning in the docs component |
| `npm run docs:build` | Pass, 17.06 seconds; coordinator final shared-artifact run also passed in21.60 seconds. Initial run failed on the roadmap review link; coordinator corrected it to the canonical GitHub URL before this successful run |
| `npm run verify-indexes` | Pass, 2 source/index tests and all index checks |
| `npm run verify-lockfile` / `npm run verify-versions` | Pass; workspace links/pins and independent version matrix unchanged |
| `npm run validate-schemas` / `npm run verify-codes` | Pass: 62 schemas; all code/rule guards |
| `npm test` (coordinator integration run) | **Failed:3,999 passed /180 failed**; subprocess/EPERM/empty-output symptoms remain failures, distinct from direct reference checks or later remote CI |
| `npm run conformance` | **Failed** in `scripts/conformance-targets.test.mjs` before the reference runner. Local subprocess restrictions remain a limitation; this gate is not reported as passing |
| `node scripts/run-conformance.mjs` | Direct reference runner passed 1,089 cases, 0 failed, 0 updated; this does not replace the failed wrapper gate or demonstrate independent consumer conformance |
| `npm run verify-packages` | **Failed**: npm pack could not write the default read-only npm cache. Retry with `npm_config_cache=/tmp/uwmd-agent-npm-cache` also **failed**, with empty subprocess stdout causing JSON parsing failure. Strict packed-consumer verification is not claimed |
| Comment-free TypeScript AST comparison against base | Pass for all 7 edited source files; changes are comments only. Exactly 35 host-specific public declarations carry advisory deprecations |
| Manifest comparison excluding `description` | Pass: no dependency, peer, export, version, engine or package-file changes |
| Protected-path diff and whitespace review | No changes to specs, schemas, conformance, lockfile, public barrels, runner/CLI behavior, skill assets or AI download payloads; `git diff --check` passes |

No new tests mirror comment changes. The worker ran targeted compatibility
checks; the coordinator subsequently ran the full suite and recorded its actual
3,999-pass/180-failure result above. Those subprocess failures remain failures. No Microsoft Excel recalculation or hosted-model
execution was performed. Required remote CI and packed-consumer checks must be
reviewed on the eventual PR before integration.
