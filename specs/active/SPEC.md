# RFC 0041 — explicit period addressing

Status: owner authorized proceeding; implementation recorded on 2026-09-12. One implementation stage.
Baseline: verified RFC 0040 head `1c10871` (PR #178, all checks green).
PR #178 is still open; this work will be submitted as a dependent PR, without
changing its branch or assuming it has merged. Reconcile main before retargeting.

## Authorized contract

Implement the bounded plan in `specs/queued-rfc-0041.md`. This contract explicitly
authorizes the additive `PeriodKey`, `PeriodSeriesEntry`, `PERIOD_SERIES`,
`CalcEvaluationContext.sectionVariants`, and public period helper surfaces;
new period key/registry schemas; and Protocol 2.8.0 with normative text and
schemas in the same commit. No package release or new dependencies.

- A new `period_path` AST node carries one selector after a registered series.
  Existing AST nodes, generic deepGet and literal bracket-string keys are unchanged.
- Selectors: Y1 and higher (safe positive integer without leading zero), absolute
  YYYY-MM, YYYY-Q1..Q4, Gregorian YYYY-MM-DD. No relative Qn/Mn or conversions.
- The five standard series use year, keyed year_N, calendar period, or date
  identity. Keyed year_01 and year_1 canonicalize equally and are duplicates.
- PS-01 warns for malformed series/periods, PS-02 errors for duplicates in every
  active variant, PS-03 warns for static custom calc/scenario kind mismatch.
  Existing LU/CF/WF structure checks remain authoritative for their other rules.
- Evaluation refuses malformed/unregistered selectors or malformed series as
  CALC-PERIOD-001, duplicate periods as -002, and ambiguous/missing explicit
  variants or invalid selected roles as -003. Missing section/series/period
  returns null. A valid selector with another period kind returns null.
- Period references use section-rooted lookup, not frontmatter/prior-result
  shadowing. Default selection uses generic primary/default/base/sole eligibility;
  never check-specific senior/detail preferences. Explicit sectionVariants picks
  the exact block, including an intentionally selected component; no fallback.
- Full selector-path overrides, including null, shadow document lookup. Dependency
  keys retain selectors. Bracket-string leaf keys are escaped in period reference
  keys so dots or @ in literal names cannot become selector syntax.
- Public resolvePeriodPath is contextual and uses the calc reference grammar.
  No global reservation of @ in metadata pointers or generic object paths.
- Excel explicitly refuses period_path with EXCEL-EMIT-PATH; no stale row-index
  translation. Refinement records dependencies but explicitly declines numerical
  perturbation of selector expressions until its cascade supports period context.
- No numerical formula, convergence criterion, unit or tolerance changes.

## Completion

Tests pin row-order independence, all five series, duplicates without validation,
malformed and missing periods, calendar identity/kind separation, explicit and
generic variants, prototype guards, override and dependency identity, and Excel
refusal. Add conformance fixtures. Pass build, tests, test typechecking, default
and declarative conformance, schemas, lint, package/lockfile/version/index checks,
and docs build. Update RFC, normative surfaces and wiki in the same feature.
