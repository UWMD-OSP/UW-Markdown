---
rfc: 0065
title: Bind a stated reserve draw to an already-stated gross expenditure
status: accepted
accepted: 2026-10-10
author: codex
created: 2026-09-29
depends_on:
  - 0045
  - 0062
  - 0063
  - 0064
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0065: Bind reserve draws to gross expenditure

## Summary and motivation

Accept and implement an optional external binding plan and a read-only verifier
for selected RFC 0064 internal draws and already-stated gross expenditures.
Many-to-many allocations and explicit partial expenditure funding are admitted;
every selected draw must be fully allocated. The verifier preserves both gross
expenditure and the draw, their identities and attributable source evidence.

The [completed Golden Deal review](../reviews/2026-09-24-completed-golden-corpus-validation.md)
identified reserve-dependent spending that correctly refuses RFC 0045. RFC 0064
is implemented and was released in core/CLI 2.20.0 with Protocol 2.24.0. Its custody identity does not establish which
internal draw funded which expenditure. Date, equal amount, label or shared
provenance cannot supply that relationship. All public examples here are synthetic.

This RFC changes no RFC 0045 rule, including Protocol §VIII.9.6.4 or the exact
`reserve_spending_excluded` refusal. It creates no owner-cash rows, subtracts
no draw from gross expenditure and adds no positive draw-offset row. External
transfer verification, owner-cash assembly, financing assembly and any admission
change are separate future contracts. No later owner-cash financial convention
is proposed or accepted here.

## Decisions

| Question | Decision | Why (precedent) |
|---|---|---|
| Scope and carrier | Optional external, document-digested binding plan; no new document section or required field. Verify funding identity only. External transfers, owner-cash/financing assembly and RFC 0045 admission remain separate. | RFC 0044/0045 external plans; RFC 0064 §VIII.11 read-only verification and the owner's settled binding-only scope. |
| Allocation proposals | Accept many-to-many edges. Every explicitly selected internal draw must be fully allocated; duplicate draw/expenditure pairs refuse regardless of their amounts. | RFC 0045 explicit coverage and source-row non-overlap; RFC 0064 preserves distinct same-day movement identities. |
| Funded share | Accept partial funding only as an explicitly stated positive funded amount per expenditure. Edge totals must equal that stated share and must not exceed the gross magnitude. Do not derive an owner-cash remainder. | RFC 0059 separately stated outcomes; RFC 0045 keeps gross sources and economic assertions separate from assembly. |
| Source addresses | Reserve reference is exact variant plus account_id, period_id and movement_id. Expenditure reference is exact variant plus lease-up period/ti_lc_capex or cash-flow row_index. Explicit null means the unlabelled variant; no default/base/fence-order fallback. | RFC 0070 exact-variant references and RFC 0064's account/period/movement identities; source edits invalidate the whole Envelope digest. |
| Gross source and category | Narrow to lease-up ti_lc_capex and separately stated supplemental other_capex/operating_expenses rows. The producer explicitly declares gross=true, category, currency, funded share and source pointer. No bundled lease-up net row, reserve_net, financing or label/amount/date inference. Supplemental classification is an attributable assertion, not authenticated by hashing. | RFC 0045 explicitly assigns supplemental coverage categories; RFC 0070's dedicated-payment assertions and RFC 0064's source-shaped classifications remain producer-owned. |
| Completeness | coverage=declared_complete names the selected-draw inventory only. Require unique inventories and explicit positive edges; it does not claim external-source or whole-plan completeness. | RFC 0045's declared_complete coverage result and explicit source coverage; RFC 0064 never invents absent facts. |
| Timing and source verification | Preserve cash-row dates and lease-up periods; a lease-up cell has date=null. Selected reserve variants must verify in full under RFC 0064. Binding adds no acquisition/disposition horizon, timing projection or boundary admission. | RFC 0062 source identities retain same-day rows; RFC 0063 final-boundary admission belongs to assembly, and RFC 0044 requires explicit timing before projection. |
| Refusals and result | Browser-safe verifyReserveDrawBindings and read-only verify-reserve-draws CLI. Use the §VIII.11 state/reason/source_digest/evidence/issues shape and registered RDB-01–09 errors; retain all finite resolved edge evidence. Ordinary document validation is unchanged. | RFC 0064 independent verifier and typed source evidence; existing validation-code families and remediation registry. |
| Money and version | Authored-order binary64 sums, no intermediate rounding; separately quantize final totals and stated amounts at the shared 2dp half-away-from-zero currency boundary. No new tolerance. Format remains 2.0; advance Protocol minor at subsequent release preparation after current 2.24.0. | Protocol §VIII.5, RFC 0059, RFC 0070, RFC 0064 and shared quantizer fix #291; RFC 0072 R8 release-label treatment. |

## Normative contract

Protocol §VIII.12 and the plan/result schemas define the synchronized contract;
Format §4.28 identifies this optional companion without adding a section or
required field. `protocol.ts` mirrors the wire types and registered RDB codes.
`verifyReserveDrawBindings` is exported through both library entry points;
`verify-reserve-draws` is a separately invoked read-only CLI command.

The closed plan carries the complete semantic source digest, currency,
`coverage: "declared_complete"`, selected draw inventory, expenditure inventory
and allocation edges. Every expenditure explicitly states gross classification,
category, source pointer and reserve-funded share. Supplemental categories are
producer declarations, corresponding to RFC 0045's explicit coverage categories;
a binding plan does not run the RFC 0045 assembler or require an admission change.
The first scope excludes supplemental TI/LC bundles, undifferentiated totals,
owner transfers and financing rows. It only binds the lease-up `ti_lc_capex`
component or individually declared gross capital/operating expenditure rows.

Reference shapes and procedure are fully pinned in §VIII.12. Exact nullable
variants have no implicit fallback. Reserve references name account, period and
movement IDs, replacing the abandoned draft's PR #219 statement/movement indices.
Expenditure references name the exact lease-up period/component or cash-row index
in the immutable source snapshot. Account verification is required for every
selected reserve variant; unrelated reserve variants do not capture the read.

Allocations are positive stated magnitudes. Their authored-order binary64 sums
must equal each selected draw and each independently stated funded share after
separate shared currency quantization; total funding must not exceed absolute
gross expenditure. The gross signed amount, movement magnitude, funded share and
edge amount remain separate in evidence. No remainder or economic cash-flow row
is derived. A lease-up period is retained with no invented cash date. Dated rows
keep their authored date, including a stated final-boundary date; binding itself
adds no timing or RFC 0063 assembly admission.

The result follows RFC 0064's four states, typed refusals, complete Envelope
digest and finite item-level evidence. Absent plan is inert. Structural/source
failures and nonfinite arithmetic are unverifiable; stale digest or finite
allocation disagreement fails; consistent explicit allocations verify.

| Code | Surface | Meaning |
|---|---|---|
| `RDB-01` | verifier error | Invalid reserve draw binding plan shape or declaration. |
| `RDB-02` | verifier error | Reserve draw binding source digest is stale. |
| `RDB-03` | verifier error | Exact reserve draw or gross expenditure reference is unresolved. |
| `RDB-04` | verifier error | Selected reserve or expenditure source is invalid or unverified. |
| `RDB-05` | verifier error | Duplicate reserve draw, expenditure identity or allocation edge. |
| `RDB-06` | verifier error | Draw class, gross sign, category or currency disagrees. |
| `RDB-07` | verifier error | Selected reserve draw is not fully allocated. |
| `RDB-08` | verifier error | Stated expenditure funding disagrees or exceeds gross expenditure. |
| `RDB-09` | verifier error | Reserve draw allocation arithmetic is nonfinite. |

Digest consistency is not proof of classification, authenticity or completeness.
A rehashed false producer declaration is still false; that limitation is explicit,
as in RFC 0070's dedicated-payment assertion and RFC 0064's movement provenance.
The source block `_meta` remains host-owned and append-only.

## Compatibility, conformance and release

No optional plan means exactly the current document validation and assembly
behavior, including reserve refusals. Existing files require no edits. Both
format generations can be supplied to the companion verifier. Format stays 2.0;
current version labels remain unchanged, with the new Protocol minor assigned
at subsequent release preparation after current 2.24.0 (RFC 0072 R8).

`conformance/reserve-draw-bindings/` carries independently authored synthetic
source/plan/expected triples. Cases cover one-to-one, one-to-many, many-to-many,
explicit partial funding, TI/LC components, capital and operating rows, same-day
identities, an authored final-boundary date, stale digests and exact-reference
refusals, unsupported classifications, gross sign/category/currency errors,
duplicate edges/inventories, incomplete draws, overbinding, stated-share mismatch
and nonfinite allocation totals. Large-cent sums exercise the shared quantizer;
one-cent controls must fail. Focused tests restore the pre-#291 integral shortcut
and confirm both large-cent cases fail, then verify them under the corrected
shared quantizer. Additional tests pin pre-await snapshots, crypto refusal,
source metadata and paths, browser export parity, inert validation and an
unchanged RFC 0045 refusal beside a verified binding plan.

## Alternatives and boundaries

Date/label/amount matching and shared-source identity are coincidence, not edges.
Netting a draw against expenditure erases gross economics; treating the draw as
a second expenditure duplicates it. A `reserve_net` row names external owner
transfers, not an internal draw. A source category or timestamp does not choose a
variant. Inferring missing accounts, movements, expenses, dates or shares cannot
establish an attributable binding. Release preparation and Claude Code's merge
remain separate steps after this RFC and its implementation are reviewed.
