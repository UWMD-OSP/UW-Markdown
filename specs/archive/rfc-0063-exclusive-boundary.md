# RFC 0063 implementation — accepted, unreleased

Jared accepted RFC 0063 at f04b34ab5606264424bddc02b09ced256a09bbcc on
2026-09-24 and authorized implementation, local verification and commits only.
The accepted RFC is the contract; no redesign or additional enum values.

Add only `disposition_period_rule?: 'within_final_period' | 'allow_exclusive_end'`
to PropertyCashFlowPlan, its closed JSON Schema and Protocol VIII.9.6 together.
Preserve omission byte-for-byte, explicit legacy behavior, all independent
refusals, cash horizon, source schedule, copied amounts and RFC 0062 behavior.
The opt-in admits the exact representable exclusive monthly/quarterly boundary
in addition to existing inside-period dates. Use integer calendar derivation.
No financial math, reserve, financing, grammar or Format change is authorized.

Definition of done: full accepted conformance matrix plus schema/API/browser/CLI
coverage; all 26 existing assembly fixtures preserve full outputs/refusals;
relevant private Golden Deal probes rerun without source mutation; all repository
gates pass. Reconcile Protocol 2.18.0 as accepted/unreleased, retaining RFC 0062's
2.17.1 errata history. Format and package versions stay unchanged. RFC status
remains accepted until release. No push, tag, publish or release.

## Completion

Implementation committed locally as `413a64511c4412114c230b5d39bea698f16eda40` after all 14 gates passed.
RFC 0063 remains accepted/unreleased; Protocol 2.18.0, Format 2.0 and unchanged
package versions. Golden Deal probes retain reserve refusal and record the
component-versus-netted-stream MOIC comparison limit. No push or release.
See [verification](../../docs/reviews/2026-09-24-rfc-0063-implementation.md).

# Task matrix — RFC 0063

- [x] Implement and verify the accepted RFC 0063 contract as one coordinated
  spec/schema/type/runtime change, including acceptance records, synthetic
  conformance, Golden Deal probes and all gates; commit locally before closing.

Reconciled baseline: f04b34ab5606264424bddc02b09ced256a09bbcc, clean codex/work,
no active milestone, Protocol 2.17.1, 26 existing assembly fixtures captured.
