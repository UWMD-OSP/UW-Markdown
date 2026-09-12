# Command-line calculation context

Status: implementation authorized by the overnight development request; stacked
on PR #183. Existing Protocol 2.10.0 semantics only, no normative edits.

Expose --calc-context <JSON file> on calc, refine and uwmd-excel. Validate the
existing sectionVariants/overrides shape with a shared browser-safe core parser.
Preserve literal override keys, finite numbers, strings, booleans and null.
Reject unknown root options, invalid maps/values and unregistered period sections.
Never change the source document. Refine accepts canonical period overrides only
because its existing periodContext does not apply ordinary scalar overrides.
Excel requires --calculations when context is supplied; existing pack sheets
remain outside this context. No financial formulas, dependencies, protocol types,
schemas or versions change.

Test pure validation, CLI calc/refine behavior, native-export inputs and refusal
without output on invalid context. Update CLI help, public guides and wiki.
Run all repository gates and submit a separate stacked PR for owner review.
