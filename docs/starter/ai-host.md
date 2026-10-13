# Starter products: AI agent host

> **Non-normative starter-product guidance (RFC 0078). Not part of the standard.**
>
> This page moved verbatim from [UW Protocol](../../spec/UW_PROTOCOL.md) §IX,
> and from the retired Tier-4 Agent Host requirements (Protocol 2.x §II.4),
> under [RFC 0078](../rfcs/0078-protocol-is-verification.md) (D3). Section
> numbers and headings are kept so existing references still find the text;
> relative links were re-based to this directory and nothing else changed.
> The requirement keywords below (MUST, SHOULD, MAY) describe how the
> reference starter products behave and what a tool must do to stay
> compatible with them. They are not conformance requirements of the
> standard, and a conforming Reader or Verifier owes none of them.

### II.4 Agent Host

A Tier-4 Agent Host MUST satisfy all Tier-3 requirements, and additionally:

1. Honor the `BANCROFT_LAYERS` dependency graph: layer L depends on
   inputs from earlier layers; the host MUST NOT run L until its
   dependencies are satisfied (§IX.1).
2. Validate every agent tool call against `WRITE_UW_SECTION_TOOL` or
   `WRITE_MULTIPLE_SECTIONS_TOOL` before applying.
3. Strip any `_meta` and `_notes` the agent included inside
   `section_data` and substitute the canonical `_meta` constructed by
   the host (§IX.4).
4. Append a `pipeline_log` entry for every successful agent invocation.

## IX. AI Host Contract

### IX.1 Layer DAG

`BANCROFT_LAYERS` (`context.ts`) is the normative layer dependency
graph for v1. Each layer declares its `reads` (sections it needs as
input) and `writes` (sections it produces). A host MUST satisfy all
`reads` before invoking a layer.

The seven canonical layers are L0 (ingestion), L1 (screening), L2
(underwriting), L4 (structuring), L5 (compliance), L6 (risk), L7
(assembly). Modules MAY contribute additional layers; module layers
MUST NOT use IDs that shadow canonical IDs.

### IX.2 Context bundling

`buildAgentPrompt()` defines the canonical context bundle shape: the
deal frontmatter, the relevant `reads` sections (canonical blocks
only — superseded blocks excluded), validation issues affecting those
sections, and the layer's prompt template.

### IX.3 Tool schemas

Two normative tool schemas are exported from
`packages/uwmd-core/src/agents/schemas.ts`:

- `WRITE_UW_SECTION_TOOL` — single-section writes.
- `WRITE_MULTIPLE_SECTIONS_TOOL` — batched writes for layers that
  produce multiple sections (see `MULTI_SECTION_LAYERS`).

Tool calls that fail validation against these schemas MUST be
rejected; the host MAY surface the failure to the agent for retry.

### IX.4 _meta substitution

Agents may include `_meta` and `_notes` inside `section_data`. The
host MUST strip both keys from the agent payload and substitute the
canonical `_meta` constructed via `buildMeta()`. This prevents agents
from forging provenance.

### IX.5 Pipeline log

Every successful layer invocation MUST append a `pipeline_log` entry
with `timestamp`, `agent_or_actor`, `event_type`, and `status`.
Failures MUST also be logged, with `status: "failed"` and an error
string.

### IX.6 Shape assertions for tests

Because LLM outputs are nondeterministic, the Tier-4 conformance
fixtures use JSON Schema shape assertions rather than byte-equality.
A run is considered conformant if the post-run file shape matches
the expected schema and the `pipeline_log` entry was appended.

### IX.7 Context Profiles

A consumer of a `.uwx.md` file SHOULD declare which **context profile**
it consumes. The profile determines which sections are included,
whether superseded blocks appear, whether prose is included, and the
approximate token budget the producer targets when constructing the
context payload.

The five normative profiles are:

| Profile | Audience | Includes | Notes |
|---|---|---|---|
| `summary` | Chat agents, orchestration heuristics | Frontmatter slim subset, `pipeline_state`, `quick_metrics`, `gaps` head | Soft target ≤ 600 tokens (chars/4 estimate). |
| `live` | Calc-aware editors | All non-superseded sections, full prose | Default for human-facing tools. |
| `compact` | LLMs at scale | All non-superseded sections, JSON only, minified, ordered stable→volatile | Targets ≤ 55% of `live` token count on the canonical Parkview fixture. `_meta` stripped by default. |
| `full` | Archival / forensic | Every byte, prose included, no compaction | Round-trips the input file byte-for-byte when no truncation. |
| `relevant` | Custom Bancroft layers | Caller-supplied section list, `live`-style payload | Used by `consumed_profile: 'relevant'` layers; the host passes the layer's `reads` as the section filter. |

A producer that satisfies a request for profile `X` MUST NOT return
a context strictly larger than `X` allows; it MAY return a smaller
context (e.g. truncated to fit `maxTokens`) and MUST set
`truncated: true` in the result when it does.

The `compact` profile MUST order sections **stable-first** so prompt-
cache prefixes survive frequent edits to volatile downstream
sections. The canonical order is:

1. `frontmatter`
2. `property`
3. `ownership`
4. `borrower_sponsor`
5. `debt_structure`
6. `sources_uses`
7. `valuation`
8. `rent_roll`
9. `operating_statement`
10. `noi_model`
11. `market_analysis`
12. `compliance`
13. `risk_assessment`
14. `dcf`
15. `stress_tests`
16. `custom_calculations`
17. `gaps`
18. `extensions`

Sections not on this list trail the canonical prefix in
`Object.keys` order.

Token estimates use the `chars/4` approximation; producers MUST
document the approximation and SHOULD validate periodically against
the true tokenizer cost (typical drift ±5% on `.uwx.md` content).

### IX.8 Layer-declared profile consumption

Each Bancroft layer declares a `consumed_profile` field in
`BANCROFT_LAYERS`. A host MUST request that profile (and only that
profile) when preparing the layer's input context. Conformance Tier-4
verifies the declaration via the
`consumer-profile-contract` fixture.

For canonical v1 layers the declared profiles are:

| Layer | `consumed_profile` |
|---|---|
| L0 — Document Ingestion | `summary` |
| L1 — Screening | `summary` |
| L2 — Underwriting | `relevant` |
| L4 — Structuring | `relevant` |
| L5 — Compliance | `relevant` |
| L6 — Risk Rating | `relevant` |
| L7 — Assembly | `live` |

Module-contributed layers MUST declare `consumed_profile`. A module
layer that consumes `full` or that declines to declare a profile is
non-conformant.
