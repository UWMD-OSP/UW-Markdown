# UW Markdown RFCs

This directory contains the request-for-comments documents that precede
any normative change to UW Markdown — the format spec, the protocol
spec, the JSON Schemas, the conformance corpus, or the public API of
`@uwmd/core`.

See [`GOVERNANCE.md`](../../GOVERNANCE.md) for when an RFC is required
and how it gets accepted.

## Process

1. Copy [`0000-template.md`](./0000-template.md) to
   `NNNN-<short-slug>.md` using the next free number.
2. Fill in the design, compatibility, conformance, and implementation sections.
3. Open a pull request or, in owner-led mode, commit it with the implementation.
4. The project owner accepts, requests changes, or rejects the proposal.
5. In owner-led mode there is no mandatory waiting period. After collaborative
   mode activates under [`GOVERNANCE.md`](../../GOVERNANCE.md), a normative RFC
   remains open for public comment for at least 14 days before acceptance.
6. Accepted RFCs move to `accepted`; after the implementation ships, they move
   to `implemented`. Rejected and superseded RFCs remain as design history.

## Index

| # | Title | Status | Affects |
|---|---|---|---|
| [0001](./0001-locale-negotiation.md)    | Locale negotiation                          | implemented | format, protocol, core, conformance |
| [0002](./0002-module-signing.md)        | Module signing                              | implemented | protocol, core, conformance, tooling |
| [0003](./0003-module-asset-classes.md)  | Custom asset-class declarations from modules | implemented | format, protocol, core, conformance, tooling |
| [0004](./0004-conformance-runner-v2.md) | Conformance test runner v2 (language-agnostic) | implemented | protocol, core, conformance, tooling |
| [0005](./0005-stochastic-calculations.md) | Stochastic calculations                    | implemented | protocol, core, conformance |
| [0006](./0006-hospitality-module.md)    | Hospitality reference module                | implemented | core, conformance, tooling |
| [0007](./0007-sensitivity-tables.md)    | Sensitivity tables as a calc primitive      | implemented | protocol, core, conformance |
| [0008](./0008-lease-up-modeling.md)     | Lease-up modeling                           | implemented | protocol, core, conformance |
| [0009](./0009-meta-v2-reorg.md)         | `_meta` v2 sub-object reorganization        | implemented | format, protocol, core, conformance |
| [0010](./0010-signed-blocks.md)         | Signed blocks                               | implemented | format, protocol, core, conformance, tooling |
| [0011](./0011-capability-tokens.md)     | Capability tokens for write authorization   | implemented | protocol, core, conformance |
| [0013](./0013-corpus-retrieval.md)      | Embedding-based corpus retrieval            | draft | protocol, core, conformance |
| [0014](./0014-multi-format-interchange.md) | Extensible multi-format interchange        | accepted | format, protocol, core, conformance, tooling |
| [0015](./0015-portfolio-relationships.md) | Portfolio and relationship profiles | draft | format, protocol, core, conformance, tooling |
| [0016](./0016-verification-receipts.md) | Signed deterministic verification receipts | accepted | format, protocol, core, conformance, tooling |
| [0017](./0017-uw-lite-source-representation.md) | `.uw.md` Lite / `.uwx.md` Extended source split | implemented | format, protocol, core, conformance, tooling |
| [0018](./0018-document-profiles-and-deal-packages.md) | Composable document profiles and deal packages | implemented | format, protocol, core, conformance, tooling |
| [0019](./0019-mixed-use-composition.md) | Mixed-use composition as a document shape | implemented | format, protocol, core, conformance, tooling |
| [0020](./0020-uwx-terminology-alignment.md) | Align the format spec and examples with `.uwx.md` | implemented | format, protocol, conformance, tooling |
| [0021](./0021-composable-documents.md) | Composable UWX documents — externalization, composites, rollup receipts | implemented | format, protocol, core, conformance, tooling |
| [0022](./0022-market-data-documents.md) | Market data as an attributable UW document | implemented | format, protocol, core, conformance, tooling |
| [0023](./0023-numeric-determinism.md) | A numeric model and a single quantization boundary | implemented | protocol, core, conformance, tooling |
| [0024](./0024-iterative-function-determinism.md) | Pin the iterative solvers so two engines agree on a root | implemented | protocol, core, conformance |
| [0025](./0025-lite-percent-decimal-exactness.md) | Scale percent displays by moving the point, not by dividing | implemented | format, core, conformance |
| [0026](./0026-capital-stack.md) | A typed capital stack — tranches, preferred equity, and stack-aware sizing | implemented | format, protocol, core, conformance, tooling |
| [0027](./0027-asset-class-size-intensives.md) | Declare every asset class's size intensive, once | implemented | format, protocol, core, conformance, tooling |
| [0028](./0028-reportable-section-readiness.md) | Make a missing required section a reportable defect | implemented | format, core, conformance |
| [0029](./0029-class-aware-stage-requirements.md) | Make stage requirements class-aware | implemented | format, core, conformance |
| [0030](./0030-conformance-profiles.md) | Make partial conformance mechanically checkable | implemented | protocol, core, conformance, tooling |
| [0031](./0031-source-vocabulary.md) | Reconcile the source vocabularies and close the unpoliced-write path | implemented | format, protocol, core, conformance, tooling |
| [0032](./0032-provisional-signing-scope.md) | State how `_meta.provisional` interacts with signing | implemented | protocol |
| [0033](./0033-capital-stack-point-in-time.md) | Scope `capital_stack` to one point in time | implemented | format |
| [0034](./0034-calendar-anchored-cash-flows.md) | Calendar-anchored cash flows — dated series, day counts, deterministic `xirr`/`xnpv` | draft | format, protocol, core, conformance |

`0012` is an unused number, left as a gap so existing references keep their
meaning. RFC 0017 is **retroactive**: it documents a change that shipped before
its RFC was written, and records that process failure rather than hiding it. See
its [Process failure](./0017-uw-lite-source-representation.md#process-failure)
section.

## Status values

- **draft** — author is still iterating; reviewers may comment but
  the proposal is not stable.
- **active** — open for comment; the 14-day minimum applies in collaborative mode.
- **accepted** — merged with intent to implement.
- **implemented** — the change has shipped in a release; CHANGELOG
  entry exists.
- **rejected** — closed without merging the change. RFC stays in
  the directory.
- **superseded** — replaced by a later RFC; cross-link both.
- **withdrawn** — author pulled the proposal.

When status changes, edit the RFC's frontmatter and update this index.
