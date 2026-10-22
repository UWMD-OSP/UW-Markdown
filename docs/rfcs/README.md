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
7. An RFC whose own deliverable is the decision — it defines no fields and
   ships no code — is `decided` rather than `accepted`, and that is terminal.
   See [Status values](#status-values) for the full vocabulary and for how
   `decided` differs from `accepted`.

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
| [0014](./0014-multi-format-interchange.md) | Extensible multi-format interchange        | implemented | format, protocol, core, conformance, tooling |
| [0015](./0015-portfolio-relationships.md) | Portfolio and relationship profiles | implemented | format, protocol, core, conformance, tooling |
| [0016](./0016-verification-receipts.md) | Signed deterministic verification receipts | implemented | format, protocol, core, conformance, tooling |
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
| [0034](./0034-calendar-anchored-cash-flows.md) | Calendar-anchored cash flows — dated series, day counts, deterministic `xirr`/`xnpv` | implemented | format, protocol, core, conformance |
| [0035](./0035-distribution-waterfall.md) | Distribution waterfall — state-and-verify promote, pref, and catch-up over a dated series | implemented | format, protocol, core, conformance |
| [0036](./0036-waterfall-irr-hurdles.md) | IRR-hurdled waterfall tiers — a closed-form boundary, not a nested solve | implemented | format, protocol, core, conformance |
| [0037](./0037-cross-check-variant-resolution-and-coverage.md) | Cross-check resolution over variant maps, and a validation coverage channel | implemented | format, protocol, core, conformance |
| [0038](./0038-return-metric-tax-basis.md) | Tax basis on stated return metrics | implemented | format, protocol, core, conformance |
| [0039](./0039-data-center-module.md) | Data-center module — the first product module on a module-declared asset class | implemented | core, conformance, tooling |
| [0040](./0040-variant-role-resolution.md) | Variant roles — resolve cross-checks by a declared role, not a key name | implemented | format, protocol, core, conformance |
| [0041](./0041-period-indexed-addressing.md) | Explicit period addressing for the standard series | implemented | format, protocol, core, conformance |
| [0042](./0042-period-refinement.md) | Stated period inputs in refinement | implemented | protocol, core |
| [0043](./0043-contextual-excel-period-bindings.md) | Contextual Excel period bindings | implemented | protocol, core, tooling |
| [0044](./0044-explicit-lease-up-cash-flow-projection.md) | Project verified lease-up amounts onto explicit cash dates | implemented | protocol, core, conformance, tooling |
| [0045](./0045-explicit-property-cash-flow-assembly.md) | Assemble explicitly covered property cash flows | implemented | protocol, core, conformance, tooling |
| [0046](./0046-currency-identity.md) | Document currency identity | implemented | format, protocol, core, conformance |
| [0047](./0047-property-cash-flow-input-inventory.md) | Property cash-flow input inventory | implemented | core, tooling |
| [0048](./0048-standalone-document-kit.md) | Standalone UW document kit and package examples | implemented | conformance, tooling, documentation |
| [0049](./0049-postgresql-jsonb-lake-adapter.md) | PostgreSQL JSONB lake adapter boundary | implemented | tooling, documentation |
| [0050](./0050-preferred-equity-split-coupon.md) | Preferred equity with a split coupon | implemented | format, protocol, core, conformance |
| [0051](./0051-waterfall-dual-hurdle-any-mode.md) | Distribution waterfall dual-hurdle "any" mode | implemented | format, protocol, core, conformance |
| [0052](./0052-named-exit-sale-deductions.md) | Named exit sale deductions | implemented | protocol, core, conformance |
| [0053](./0053-tax-abatements-and-reassessment-basis.md) | Tax abatements and reassessment basis | implemented | format, protocol, core, conformance |
| [0054](./0054-per-lease-ledger-decision.md) | Where per-lease economics live (decision) | decided | format, documentation |
| [0055](./0055-typed-commercial-lease-clauses.md) | Typed commercial lease clauses | implemented | format, protocol, core, conformance |
| [0056](./0056-rate-hedges-and-escrows.md) | Typed rate hedges, escrows and the reserves that fund them | implemented | format, protocol, core, conformance |
| [0057](./0057-renovation-draw-and-expense-targeted-capex.md) | The renovation draw, and capex that buys an expense reduction | implemented | format, protocol, core, conformance |
| [0058](./0058-expense-recoveries-and-cam-true-up.md) | Expense recoveries and the CAM true-up | implemented | format, protocol, core, conformance |
| [0059](./0059-waterfall-clawback-terminal-true-up.md) | Waterfall clawback as a terminal true-up | implemented | format, protocol, core, conformance |
| [0060](./0060-tranche-class-candidates.md) | The four tranche-class candidates (decision) | decided | documentation |
| [0061](./0061-protocol-version-label-integrity.md) | Keep protocol version labels synchronized | implemented | protocol, tooling, documentation |
| [0062](./0062-same-day-cash-flow-selection.md) | Permit same-day cash-flow rows while refusing ambiguous selectors | implemented | format, protocol, core, conformance |
| [0063](./0063-final-period-exclusive-boundary.md) | Admit disposition at the final calendar period's exclusive boundary | implemented | protocol, core, conformance, tooling |
| [0064](./0064-property-reserve-account-roll-forward.md) | Verify property reserve-account roll-forwards without netting expenditure | implemented | format, protocol, core, conformance, tooling |
| [0065](./0065-reserve-draw-gross-expenditure-binding.md) | Bind a stated reserve draw to an already-stated gross expenditure | implemented | format, protocol, core, conformance, tooling |
| [0066](./0066-calc-identifier-variant-resolution.md) | Resolve calc identifiers over variant-map sections the way cross-checks do | implemented | protocol, core, conformance, tooling |
| [0067](./0067-tenure-and-ground-lease-contract.md) | Tenure and ground-lease contract | draft | format, protocol, core, conformance |
| [0068](./0068-manufactured-housing-module.md) | Manufactured-housing module — a community leased by the site, with park-owned homes as a second income line | superseded | core, conformance, tooling |
| [0069](./0069-student-rent-roll-bed-counts.md) | Declare the student rent-roll bed counts and pre-leasing dates the student pack already reads | implemented | format, protocol, core, conformance |
| [0070](./0070-replacement-cap-funding-and-payment-binding.md) | Bind outright replacement-cap funding to an exact modeled cash payment | implemented | format, protocol, core, conformance, tooling |
| [0071](./0071-calendar-date-predicate.md) | A calendar-date validity predicate for safe expressions | implemented | protocol, core, conformance, documentation |
| [0072](./0072-frontmatter-scenario-semantics.md) | Give frontmatter `scenario` a defined meaning | implemented | format, core, conformance, tooling |
| [0073](./0073-previous-asset-class-identifiers.md) | Previous identifiers for module-declared asset classes | draft | protocol, core, conformance |
| [0074](./0074-module-declaration-override-semantics.md) | What a dependent module's declaration override means | implemented | protocol, core, conformance |
| [0075](./0075-hedge-senior-role-preference.md) | Read a rate hedge from the senior loan when debt_structure is a role map | implemented | format, protocol, core, conformance |
| [0076](./0076-hedge-checks-under-refused-selection.md) | Refuse a stated rate hedge whose loan or cash lines cannot be selected | implemented | format, protocol, core, conformance |
| [0077](./0077-exit-proceeds-with-junior-capital.md) | Define exit proceeds to equity when the capital stack carries junior capital | implemented | format, core, conformance, tooling |
| [0078](./0078-protocol-is-verification.md) | The protocol is verification: separate the standard from the starter products | implemented | protocol, format, conformance, core, tooling |
| [0079](./0079-metric-precision.md) | Verify stated metrics at their stated precision; one cash-on-cash definition | implemented | protocol, core, conformance, tooling |
| [0080](./0080-official-classes-are-builtins.md) | Every official asset class is a builtin | implemented | format, protocol, core, conformance, tooling |
| [0081](./0081-one-format-one-protocol.md) | One format, one protocol: remove backward compatibility (pre-release cleanup) | accepted | format, protocol, core, conformance, tooling |
| [0081](./0081-one-format-one-protocol.md) | One format, one protocol: remove backward compatibility (pre-release cleanup) | implemented | format, protocol, core, conformance, tooling |
| [0082](./0082-borrower-underwriting-profile.md) | A borrower-underwriting document profile for a loan to an operating company | draft | format, protocol, core, conformance, tooling |
| [0083](./0083-verify-package-split.md) | Split `@uwmd/verify`, the reference implementation of the standard, out of `@uwmd/core` | implemented | core, conformance, tooling |
| [0084](./0084-document-signature-binding.md) | Bind a document snapshot without discarding signed block attribution | implemented | protocol, core, conformance, tooling |
| [0086](./0086-data-center-purchase-price-authority.md) | Resolve data-center purchase-price authority and summary binding | draft | format, protocol, core, conformance, tooling |
| [0087](./0087-hospitality-revenue-reconciliation.md) | Define the basis for hospitality revenue reconciliation | draft | format, protocol, core, conformance, tooling |
| [0088](./0088-pin-financial-numerical-procedures.md) | Resolve financial power and transcendental reproducibility | accepted | protocol, core, conformance |
| [0090](./0090-provenance-actor-admission.md) | Admit required provenance actors with an explicit diagnostic | accepted | format, protocol, core, conformance, tooling |
| [0091](./0091-required-metadata-booleans.md) | Allocate the two required metadata boolean diagnostics | accepted | format, protocol, core, conformance, tooling |
| [0093](./0093-metadata-shape-diagnostics.md) | Close three metadata-shape diagnostic gaps | accepted | format, protocol, core, conformance, tooling |
| [0094](./0094-present-invalid-metadata-leaves.md) | Allocate three present-invalid metadata leaf diagnostics | accepted | format, protocol, core, conformance, tooling |
| [0095](./0095-optional-metadata-and-provenance-references.md) | Allocate bounded optional metadata and provenance-reference diagnostics | accepted | format, protocol, core, conformance, tooling |
| [0096](./0096-bounded-stated-payload-admission.md) | Allocate bounded stated-payload admission diagnostics | accepted | format, protocol, core, conformance, tooling |
| [0097](./0097-institution-config-refusal.md) | Refuse invalid selected institution configuration before validation | accepted | format, protocol, core, conformance, tooling |
| [0098](./0098-capital-point-in-time.md) | Declare the point in time of the capital stack and senior loans, and reconcile CC-03 per point | accepted | format, protocol, core, conformance, tooling |
| [0099](./0099-verify-every-stated-home.md) | Verify each dictionary metric wherever the document states it | accepted | format, protocol, core, conformance, tooling |
| [0100](./0100-nonnegative-sizes.md) | Refuse negative sizes, counts, areas and rents | accepted | format, protocol, core, conformance, tooling |
| [0101](./0101-present-invalid-source.md) | Refuse every present source value outside the actor grammar | accepted | format, core, conformance |
| [0102](./0102-backtick-fences-only.md) | A structured block opens only on a three-backtick json line | accepted | format, conformance, tooling |
| [0103](./0103-metric-dictionary-corrections.md) | Four metric dictionary corrections — USALI F&B gross margin, data-center mark-to-market and drawn power, booked rooms revenue | accepted | format, core, conformance, tooling |
| [0104](./0104-issue-field-paths-and-order.md) | Validation issue field paths are dotted paths from the payload root; issue order is not normative | accepted | protocol, core, conformance |
| [0105](./0105-financial-validity-homes.md) | Name the field each financial-validity threshold reads, and check each stated home | accepted | format, core, conformance |
| [0106](./0106-malformed-block-json.md) | Refuse a structured block whose JSON is not an I-JSON object | accepted | format, protocol, core, conformance |
| [0107](./0107-ltc-financial-validity-home.md) | Give the LTC band a Format-defined home and an FV code | accepted | format, protocol, core, conformance |
| [0108](./0108-validation-section-vocabulary.md) | Align the §4.17 validation section's vocabulary with the validation result | accepted | format, conformance |
| [0109](./0109-financial-validity-deal-flags.md) | Report financial-validity findings as deal flags, not record errors | accepted | format, protocol, core, conformance, tooling |
| [0110](./0110-financial-validity-entry-band.md) | Name the §4.17 financial_validity entry's band "band", as RFC 0109 does | accepted | format, conformance |
| [0112](./0112-remove-bancroft-vocabulary.md) | Remove the Bancroft layer vocabulary from the standard | accepted | format, protocol, core, conformance, tooling |

`0012` is an unused number, left as a gap so existing references keep their
meaning. RFC 0017 is **retroactive**: it documents a change that shipped before
its RFC was written, and records that process failure rather than hiding it. See
its [Process failure](./0017-uw-lite-source-representation.md#process-failure)
section.

## Status values

This is the authoritative list. An RFC's frontmatter `status:` must be one of
these values, and `npm run verify-indexes` fails on any other.

- **draft** — author is still iterating; reviewers may comment but
  the proposal is not stable.
- **active** — open for comment; the 14-day minimum applies in collaborative mode.
- **accepted** — merged with intent to implement, and **this RFC itself still
  promises implementation that has not shipped**.
- **decided** — terminal. The RFC's own deliverable *is* the architectural or
  design decision, and it explicitly promises no implementation of its own.
- **implemented** — the change has shipped in a release; CHANGELOG
  entry exists.
- **rejected** — closed without merging the change. RFC stays in
  the directory.
- **superseded** — replaced by a later RFC; cross-link both.
- **withdrawn** — author pulled the proposal.

### `accepted` versus `decided`

The test is what *this* RFC promises, not whether any work remains in the area.

A `decided` RFC may identify implementation that a **separate future RFC** would
have to carry. That deferral does not demote it to `accepted`, because the
deferred work was never this RFC's deliverable — there is nothing here left to
ship, so it never becomes `implemented`.

[RFC 0054](./0054-per-lease-ledger-decision.md) is the worked example: it decides
*where* per-lease economics live, states outright that it "defines no fields and
implements nothing", types the lease clauses through RFC 0055, and defers the
periodic series until a consumer exists. It is `decided`, not `accepted`, even
though it names future work.

Use `accepted` when the RFC in hand describes a change that is still owed.

When status changes, edit the RFC's frontmatter and update this index.
