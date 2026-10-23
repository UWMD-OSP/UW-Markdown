# UWMD architecture boundary: bounded 4.x cleanup

Status: review draft, 2026-10-15. This is a source inventory and implementation
boundary, not an RFC acceptance or a new conformance obligation. UWMD owns the
vendor-neutral exchange standard and verification. StackUW owns modeling,
agents and workflows; other producers remain equally valid adopters.

## Launch-policy update (2026-10-16)

This dated 4.x cleanup inventory remains evidence of the reviewed source, not a
mandatory legacy-support contract. The [explicit owner policy](../../VERSIONS.md#public-launch-compatibility-policy-owner-decision-2026-10-16)
sets5.0 as the first public compatibility baseline; older retention/migration
wording below does not constrain a clean approved launch. Preserve historical
records. Exact product removals and normative changes still require scoped
review and applicable RFC/conformance synchronization. No release is authorized.

## Authority and reconciliation

| Evidence | Meaning for this cleanup |
|---|---|
| [RFC 0078](../rfcs/0078-protocol-is-verification.md), D1/D3/D7/D8 | Verify stated numbers; preserve provenance; agent/editor mechanics are starter products; producing forecasts is vendor work. |
| [RFC 0083](../rfcs/0083-verify-package-split.md) | Verify has no core/vendor dependency. Core re-exports verify and preserves the existing root/browser surfaces. Builtin pack manifests remain verifier data for receipts, not a mandate to build a modeling engine. |
| [Issue #355 latest owner instruction](https://github.com/UWMD-OSP/UW-Markdown/issues/355#issuecomment-6206344561) | Bound stated returns first, optional declared acquisition-ledger coverage, then separately justified named identities. Earlier engine/every-row proposals are superseded design input. |
| [AGENTS.md](../../AGENTS.md) | Existing normative invariants continue. This cleanup clarifies product ownership and 4.x compatibility; it does not retroactively change accepted RFCs. |
| `packages/uwmd-core/package.json`, `src/index.ts`, `src/browser.ts` | Published exports, not product labels, decide what removal breaks. The browser entry still contains context/prompt builders and writer APIs even though it excludes model execution and SDK adapters. |

Inventory and integration baseline:
`a18ed8ee7f502e2bd538c3c96be1584f94c458b9` (GitHub main, including 4.3.0).
Git fetch was unavailable in the execution environment. The exact snapshot was
imported through GitHub's API: every changed blob and the assembled tree matched
GitHub's object ids, and the signed commit serialization matched the main SHA.
The worktree was then rebased onto that shallow snapshot. Local validation
therefore includes the intervening financial verifier/Excel/renderer fixes and
draft RFC work; it is not evidence for a future release or a later main.

## Source and distribution inventory

Paths in the table are relative to the repository. `core` abbreviates
`packages/uwmd-core/src`; `verify` abbreviates `packages/uwmd-verify/src`.

| Surface and source | Classification and disposition |
|---|---|
| `core/agents/bancroft.ts` and sibling tests | Product runner: normal/streaming execution, retries, tools, output writing, pipeline-state updates. Retain 4.x exports; remove from UWMD in the separate major plan. |
| `core/context.ts` and tests | `BANCROFT_LAYERS`, layer dependencies/readiness, `buildAgentContext`, `buildAgentPrompt`, inline system/user prompts and descriptions. L0, L0a, L0b, L1, L2, L4, L5, L6, L7; L3 is absent. Exported from root and browser; SDK-free does not mean product-free. |
| `core/agents/L0b-prompt.md`, `agents/schemas.ts` | Product prompt reference and single/multiple-section tool schemas; host supplies provenance. Prompt file is not an independent execution engine. |
| `core/agents/provider.ts`, `agents/providers/anthropic.ts`, `agents/providers/replay.ts` and tests | Product provider interface/error, optional Anthropic adapter, recording/replay cassette and request fingerprints. Provider neutrality is useful but does not make a runner part of the standard. |
| `packages/uwmd-core/package.json`, root `package-lock.json` | Anthropic SDK is an optional peer and development dependency, loaded dynamically by the adapter. No hard runtime SDK dependency in core; none in verify. Its type loader and structural injected-client declarations must remain usable with the peer absent. |
| `core/runner.ts` and tests | Mixed compatibility writer: `writeAgentBlock`, `writeErrorEntry`, `AgentOutput`, `RunOptions`, `RunResult`; superseding, metadata, log writes and frontmatter changes. Root and browser export it. Preserve these generic writer APIs and `buildMeta` by default, independently of hosted-agent retirement. Later removal needs its own use-case audit and owner approval. |
| `core/context-profiles.ts` and tests | Starter context packaging (`buildContext`, five profiles, token estimates, truncation). Distinct from financial verification profiles and normative representation codecs. Preserve generic `buildContext` and its profile/options/result types by default. Later removal requires an independent compatibility justification and owner approval. |
| `core/cli.ts`, `cli-args.ts`; `packages/uwmd-cli/bin/uwmd.mjs`, README/tests | Product `run` and `layers`, live model/key/instruction flags, prompt/context inspection and JSON-input writing. The CLI also hosts verifier, generic edit and interoperability commands; removal must be command-scoped. |
| `core/reference-implementation.ts`, `starter-protocol.ts` | `agent-host` advertised capability and `AgentHostCapability`; mixed tables also hold display/cascade/capability-token contracts. Remove only obsolete product claims after implementation removal. |
| `conformance/starter/agent/`, `scripts/rerecord-cassettes.mjs` | Product shape/profile/replay fixtures and cassette tooling. Corpus ownership is starter products, not base Verifier. Keep in 4.x; isolate migration from normative fixtures and portable runner vocabulary. |
| `local workflow skills: uwmd-{intake-scope,document-extraction,validation-triage,batch-exceptions,portfolio-rollup}/` | Five product workflow skills, each with `SKILL.md` and `agents/openai.yaml`. They propose edits rather than directly mutating files. Keep 4.x behavior; any retirement requires asset/URL policy approval. No automatic copying or required migration to StackUW or another product is authorized. Their current “core sole calculator” wording is a legacy starter rule, not a restriction on conforming producers. |
| `docs/starter/ai-host.md`, `docs/wiki/06-bancroft-agents.md`, wiki 03/08/09/12, `docs/TOOLS.md`, `docs/GLOSSARY.md`, READMEs, `tools/docs-site/ai/` | Product documentation, discovery and examples. Correct stale normative claims now; retain working compatibility instructions until removal ships. Historical RFCs/release evidence stay immutable. |
| `core/defaults.ts`, `cascade.ts`, `gaps.ts`, `refinement.ts`, `derive*` authoring APIs and web-editor panels | Adjacent deterministic starter features, not LLM SDK integrations. This bounded cleanup does not remove or redesign them; broader modeling ownership requires its own dependency/migration review. |

No live agent execution is implemented in the web editor: the pipeline-log
component displays attribution, and the assumptions editor's “prompt” is a
human input interaction. Neither should be deleted by a keyword search.

## Required or reusable surfaces to retain

| Surface | Reason |
|---|---|
| `verify/metadata.ts`, types, actor parsing, `_meta.provenance.agent_id`/`agent_version`, lifecycle, `pipeline_state`, pipeline logs, roles and source identity | Evidence may describe any external producer, including an agent. Host-owned metadata, supersede history, integrity/signatures and receipts survive product-runner removal. |
| `verify/protocol.ts`, `modules.ts`, module schema/corpus `agent_layers`/`prompt_template`, capability vocabularies | Existing document/manifest contracts remain readable and validated even when UWMD does not execute a layer. No schema or vocabulary deletion in a package-only cleanup. |
| `verify/bindings.ts`, `spec/bindings/`, `core/bindings-edit.ts` | HTTP/MCP discovery/read/validate/convert/representation negotiation and injected source editing are vendor-neutral interoperability. An MCP edit operation is not an agent workflow. |
| `core/editor.ts`, initializer, `EditOperation`, `EditContext`, source-edit APIs and policies | Generic authoring is reusable by human tools and external hosts. Preserve byte boundaries and provenance enforcement. Policy terms such as `agent_only` identify authority, not retired agent host implementation. |
| All verify exports and both entries, dictionary, evaluator, pack data, receipts, integrity, representations and existing stated-figure/profile checks | Verification requires deterministic recomputation. Removing product modeling does not justify deleting its mathematical verification substrate. |
| Root `AGENTS.md`/`CLAUDE.md`, package/tool `CLAUDE.md`, developer wiki | Instructions for contributors developing UWMD, not shipped underwriting agents. Keep them and make their architecture claims accurate. |
| `docs/downloads/ai/` format skill and Claude/Gemini/ChatGPT/platform-neutral guides; docs-site download preparation | Producer-neutral format-use instructions are distinct from executable agent suites and product workflow skills. Vendor-specific filenames provide client instructions, not an SDK dependency. Retain and maintain neutrality. |

## Safe 4.x diff

1. Import `buildMeta` directly from verify in the generic editor and initializer.
   The old runner re-export remains the same binding. No writer, public export,
   package dependency, option, default model, prompt or financial behavior changes.
2. Correct the context-profile source comment and stale wiki/site tier claims.
   Explain the provider-or-key runner option and distinguish legacy product
   skills from format-use instructions. Record StackUW/UWMD ownership in AGENTS.
3. Keep root/browser/CLI exports, optional peers, fixtures and normative files
   intact. Deletions and package restructuring belong to the
   [5.0 plan](2026-10-15-agent-removal-5.0.md).

Precedent for these decisions: RFC 0083 moved `buildMeta` to verify and kept
compatibility re-exports; RFC 0078 retired Agent Host as a normative tier and
made starter behavior package-versioned. No numeric judgment is needed.

## Coordination with #355

Advance #355 through its RFC before touching spec text, schema, protocol
types, dictionary, normative corpus or public assurance counts. The RFC must
first identify the admitted return/method subset, exact stream/source subject,
periods, variant and immutable evidence binding. Ledger coverage must name its
declared input universe and detect omitted/duplicate allocation. A named
identity needs its own applicability, evidence, convention and precision rules.

Define stable assertion identities, mutually exclusive result categories,
dependency handling, inapplicability, empty claims and coverage gaps before
shipping counts. Unsupported claimed checks cannot silently become stated-only;
coverage cannot certify undisclosed real-world completeness or forecast truth.
The issue's proposed financially-verified/stated-only/failed/unverifiable
categories are RFC design input, not changes to today's verifier result types.

Track #356's numerical investigation and #354's independent Python verifier
without treating either proposal as accepted arithmetic. RFCs 0085–0087 remain
separate draft workstreams. No projection package, complete engine, universal
row-reproduction obligation or new launch gate is introduced here.

## Local validation at this base

Build and test typechecking pass. Schema validation, lockfile/version/index/code
guards and lint pass. The docs-site production build passes after correcting
the architecture page's links to repository-only review files. The direct
conformance runner (`node scripts/run-conformance.mjs`) passes **1,089/1,089**,
including **106** starter-product cases. Verify's **2,599** unit tests pass;
core's public-surface guard, editor, initializer, runner and provider tests pass.

The full workspace test invocation is not green locally: subprocess CLI checks
receive empty captured output/JSON in this sandbox. `npm run conformance`'s
Node test wrapper fails similarly; running its target tests without isolation
passes 11/12 with the child-CLI JSON check failing. Release checks report
`spawnSync git EPERM`, including the direct release guard. Package verification
first hits the read-only default npm cache; rerunning with a writable `/tmp`
cache still receives empty `npm pack` subprocess JSON. These are incomplete
gates, not passing claims. No test, expectation or guard was weakened. Current
branch CI must establish the full workspace, wrapper, package and release gates
before merge. Dependencies used existing local installations with workspace
links pointing to this worktree; manifests and lockfiles were not changed.

## Serialized integration review

The coordinator reviewed the nonbreaking cleanup at
`37246c123dd41d8a3deef1421e0158ca81ab15e7` and refined only these two review
records. Generic writers/context APIs remain preservation defaults; host export
retirement, command refusals and asset support remain owner-controlled proposals.
No automatic adopter migration or package-version assignment is authorized.
The removal proposal now names its candidate exports and the unresolved Format
§6.3/§6.8 obligations rather than treating RFC 0078 as their implicit repeal.

For this documentation-only refinement, `npm run docs:build` passes (16.63s),
and `npm run verify-indexes` passes (two source/reference tests and all index
checks). An initial docs attempt could not find VitePress because its reused
local dependency symlink pointed to an absent directory; correcting that
untracked symlink allowed the build. No manifest or lockfile changed. The
full local subprocess failures above remain failed; this refinement does not
reclassify them or claim a new complete local suite. Exact-head GitHub checks
must pass before integration. No normative files, formulas, validation outcomes,
conformance expectations, public exports, versions or release artifacts change.


## Post-merge proposal refinement

At main `50bf4c13206560848c5bb9b045f4532ad3cd8633`, the
[existing removal proposal](2026-10-15-agent-removal-5.0.md) was refined to
identify the exact root/browser removal facets, in-repository callers,
command-mode refusals, SDK closure, workflow/download distinctions and owner
support-policy decisions. It also identifies Format §1.2/§1.3, pipeline/source
wording, §6.3/§6.4/§6.8 and dependent Protocol/module references requiring
individual governed treatment. RFC 0078 does not implicitly repeal them.

The retained boundary is concrete: generic writers and root `buildContext`
remain public by default; source authority, agent provenance, immutable history,
metadata, integrity/signatures, receipts, generic edits, representations,
HTTP/MCP and contributor instructions survive runtime retirement. No StackUW
code transfer or particular adopter destination is required. #355 remains an
optional bounded financial-assurance workstream, not model generation.

The worker refinement changes these two review records only; the integrator
also adds its corresponding Unreleased changelog entry. Earlier validation counts
above describe their original checked tree and are not a new full-suite result
for this documentation refinement. No implementation, normative file, expected
output, public API, dependency, version or release artifact is changed.


Targeted checks for this proposal refinement: `npm run verify-indexes` passed
(two source/reference tests and all index checks); `npm run docs:build` passed
in 17.28 seconds with existing highlighting/chunk-size warnings; and
`git diff --check` passed. The checks reused cached dependencies through
untracked local symlinks; no dependency installation, manifest or lockfile
change was needed. The checked worker diff contains only the two existing review documents; the
coordinator adds the corresponding changelog entry during PR integration.
Full implementation, package, runtime and conformance gates were not rerun for
this prose-only proposal; the earlier subprocess failures remain recorded,
not reclassified. This is not new independent-verifier or Excel evidence.
