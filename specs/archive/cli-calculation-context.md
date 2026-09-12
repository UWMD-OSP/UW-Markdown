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

## Completion

Implementation and documentation are committed. Owner approved resumption on
2026-09-12; the refinement regression now checks each variant's actual endpoints
through calc at the existing six-decimal boundary. No financial arithmetic,
numeric tolerance, schema, dependency, protocol or package version changed.

- [x] Context parsing and transport for calc/refine/Excel, with exact zero/null
  behavior, unsupported-override refusal and source preservation tests.
- [x] CLI help, package READMEs, wiki/status and canonical public guide, with
  automatic site mirroring from docs/CALCULATION_CONTEXT.md.
- [x] Build; 1,876 workspace tests; test typechecking; 426 default conformance
  checks plus 76 declarative cases; 28 JSON schemas; lint; lockfile/package,
  version/index/release guards; docs build.

The new guide was regenerated after removing its ignored site copy, proving
that the tracked source/copy plan supplies it. No npm ci was needed because
dependencies, the lockfile and workspace links are unchanged.

PR #184 is stacked on #183, which is stacked on #182. Package publication and
merging remain with the owner. CI on the submitted head is the final remote gate.
