---
rfc: 0112
title: Remove the retired agent host layer vocabulary from the standard
status: accepted
author: UWMD maintainers
created: 2026-10-21
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0112: Remove the retired agent host layer vocabulary from the standard

> **Accepted by the UWMD maintainers, 2026-10-21, as drafted** (owner: "RFC 0112 (#474) accepted as drafted, including D2: keep the generic `agent/<id>` source with `agent_id` and `agent_version`.").
> Origin: accepted decision D1 of 2026-10-12
> ("Remove retired agent host entirely. Don't move it."), carried out as phase C of the
> public cleanup brief on the owner's instruction of 2026-10-21. The starter
> half, the agent runtime, providers and `uwmd run`, is removed separately
> without an RFC: RFC 0078 already classes retired agent host agents as starter products.
> This RFC covers what the Format, the Protocol and the schemas still say about
> retired agent host. It removes members that records and manifests carry, so it is
> normative.

## Summary

The Format still describes one product's agent suite as if it were part of the
standard. §1.3 maps retired agent host layers to sections. Frontmatter `pipeline_state`
has one key per layer and refers to `BANCROFT_LAYERS` in the reference library.
The section registry's "Written by" lines name layer agents (`agent/L2-CRE-11`).
Part VI specifies the reference CLI, including `uwmd run`, and §6.8 sets MUST
rules for "any retired agent host agent". Part VII specifies the reference renderer's
outputs. Module manifests can declare `agent_layers` with a `prompt_template`.
This RFC removes that vocabulary. Every rule that protects verification is kept
in a form that applies to any producer. A record keeps saying *who* wrote each
block, but no longer *which layer of which product* did.

## Motivation

- **The boundary test fails.** A lender verifying a record from any producer
  should need only the standard (RFC 0078). The Format today names a product's
  layer registry, its CLI and its renderer, and §1.2 says that "proprietary
  tooling (retired agent host agents, uwmd CLI) is required to *generate* sections
  correctly."
- **The product is gone.** The owner removed the agent suite (D1). Vocabulary that
  points at a removed runtime is dead weight that every independent
  implementation has to read and ignore.
- **Some of it is real.** Several "Written by" lines carry prohibitions such as
  "an agent MUST NOT invent a tranche `rate`". Several §6.8 obligations
  (`_meta` first, revision increment) are producer rules. These are kept, so
  removing the vocabulary does not weaken them.

## Proposed change

1. **Format §1.2.** Replace the "Toolchain-agnostic" sentence on proprietary
   tooling with: any producer that follows this specification can write
   sections, and no particular tool is required to write or read them.
2. **Format §1.3** ("Relationship to the retired agent host Agent Suite") is deleted.
3. **Frontmatter `pipeline_state`** (Format §2.2) is removed with its layer keys
   and the L3 reservation (D4). Workflow position stays in `status` and
   `deal_stage`.
4. **Section registry "Written by" lines** (Part IV, 29 lines) are removed. Where
   a line carries a source prohibition, it becomes a **Source rules** line that
   states the prohibition for any non-user source (D3). For example, the capital stack's line becomes: "Tranche amounts and terms are user-supplied capital terms; a
   block whose source is not `manual`, `user` or `wizard` MUST NOT state a
   tranche `rate`, `amount` or a stated `sizing` value."
5. **Provenance identities (D2).** The generic `agent/<id>` source namespace, its
   required `agent_id` and `agent_version`, and the free-form `actor` stay as
   they are (Format §2.5–§2.6, Part III). Only the retired agent host layer ids leave the
   spec's examples and prose (`agent/L6-01` becomes, for example,
   `agent/risk-rater`).
6. **Format Part VI** (Toolchain Interface) moves to the non-normative starter
   guide as the CLI reference, without `uwmd run` (D6). §6.8's obligations are
   sorted (D5): the producer rules move into Part III, and the product mechanics
   are dropped.
7. **Format Part VII** (Rendering Targets) moves to the starter guide as the
   renderer reference (D6).
8. **Module manifests.** `agent_layers`, `ModuleAgentLayerDecl` and
   `prompt_template` are removed from `spec/schemas/module-manifest.schema.json`,
   `protocol.ts` and Protocol Appendix F. Manifests already refuse unknown
   members, so a manifest that still declares `agent_layers` is refused. The
   codes that validated it (`PROTO-MOD-055` to `PROTO-MOD-060`) are retired and stay reserved (D7).
9. **Protocol §II.4.** The `agent-host` capability flag is removed from the
   starter-product capability list and `ImplementationManifest.capabilities`,
   because no starter product hosts agents.
10. **Reference library.** `BANCROFT_LAYERS`, the layer context, prompt and
   readiness builders, `LayerDefinition`/`AgentContext`/`retired agent hostPrompt` and
   `uwmd layers` are removed with the vocabulary they implement. The generic
   writers (`writeAgentBlock`, `writeErrorEntry`, `buildMeta`) and generic
   `buildContext` stay.

## Compatibility analysis

No compatibility path (prelaunch; the owner rule). Records that carry
`pipeline_state` keep reading (D4). Module manifests that declare
`agent_layers` are refused. Examples, fixtures and baselines are rewritten.

## Conformance impact

- Examples and fixtures drop `pipeline_state` and take neutral agent ids. Their
  integrity hashes, signatures and expected outputs are regenerated.
- Module fixture `02-agent-layer-malformed` and any `agent_layers` cases are
  retired. A new refusal case shows that a manifest declaring `agent_layers` is
  refused as an unknown member.
- Capability fixtures stop listing `agent-host`.
- No financial expected result changes.

## Reference implementation

In the implementation PR after acceptance: the Format and Protocol edits above;
the schema, `protocol.ts` and `modules.ts` changes in lockstep (invariant 7); the
core removals in item 10; the starter-guide pages for the CLI and renderer;
corpus regeneration; the Python implementation's manifest and module reader.

## Alternatives considered

- **Mark §1.3, Part VI and Part VII "historical, non-normative" and keep
  them.** This leaves a removed product in the standard's text. Rejected under
  D1 ("don't move it").
- **Make `source` fully free-form and drop the `agent/*` namespace and its
  `agent_id`/`agent_version` requirement** (the cleanup brief's wording,
  "provenance actors become free-form strings"). This removes writer
  accountability that the repo guidance keeps ("keep provenance, including agent
  identities"). Not proposed; see D2.
- **Keep `agent_layers` for third-party hosts.** No standard tool reads it, and
  it encodes one product's prompt model. A third-party host can declare its own
  capability in an `x_*` extension. Not proposed.

## Unresolved questions

- §6.8 item 7 ("never set `human_review_required: false` when the block contains
  any `low` confidence values") has no validator check today. D5 proposes
  moving it into Part III as a SHOULD for every producer, but it could also be
  dropped as a product rule.

## Decisions (accepted 2026-10-21)

| # | Question | Proposal | Why / alternative |
|---|---|---|---|
| D1 | Scope | §1.2 sentence, §1.3, `pipeline_state`, Written-by lines, Part VI, Part VII, `agent_layers`, `agent-host`, the layer registry | Every place the standard names the removed suite |
| D2 | Agent identity in provenance | **Ruled:** **Keep** `agent/<id>` with `agent_id`/`agent_version`; `actor` stays free-form; layer ids leave the examples | AGENTS.md keeps agent identities. Alternative: fully free-form sources, as the brief worded it |
| D3 | Written-by prohibitions | Restated as **Source rules** for any non-user source | Keeps "MUST NOT invent" rules that protect verification |
| D4 | A record that still carries `pipeline_state` | Not refused; ignored | RFC 0108 D5 (retired spellings not refused). Alternative: refuse it as an unknown member |
| D5 | §6.8 obligations | 2–5 (schema, `_meta` first, revision, `superseded: false`) move into Part III; 7 becomes a Part III SHOULD; 1, 6 and 8 (read state, layer scope, `awaiting_input` reply) are dropped as product mechanics | Producer invariants stay; product request/response goes |
| D6 | Part VI and Part VII | Move to `docs/starter/` as the CLI and renderer references | RFC 0078: the CLI and renderer are starter products. Alternative: delete them |
| D7 | Retired module codes | Reserved, never reused | Release rule (b), ratified 2026-10-21 |
| D8 | Versions | None allocated; prelaunch 4.x | RFC 0091 D6 |

## Prior art

- RFC 0078 (the standard is verification; agents and the CLI are starter
  products; the Agent Host tier is retired).
- RFC 0108 D5 (retired members are not refused when nothing reads them).
- `ARCHITECTURE.md`, which sorted the §6.8
  obligations and the call sites.
