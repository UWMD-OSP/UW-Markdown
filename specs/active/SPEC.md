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
