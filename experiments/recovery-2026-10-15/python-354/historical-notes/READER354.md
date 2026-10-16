# Independent Reader and settled evaluator foundation (#354)

Development slice, Python 3.10+, standard library only. This is **not a complete
Verifier**, a self-certified Reader tier, or a release. The discovery manifest
claims only `parse`, with no tier, `validate`, `calc-evaluate`, or optional profile.
The development identifier `0.0.0-dev` is not a change to any release version.

Worktree: `/tmp/uwmd-lane-354`, branch `codex/python-reader-354`. The live GitHub
main head was read through the GitHub connector as
`a18ed8ee7f502e2bd538c3c96be1584f94c458b9`. It is an ancestor of the starting
`b87909878d0f9fd55e212366a8dced7cf05c08ad` (#357 seed/probe follow-up). The
local `origin/main` tracking ref is older; network-restricted shell fetch failed.
No other worktree, shared tracking ref, index, or existing worker file was changed.

## Authority and implementation boundary

The implementation was written from Format Part II, Appendix D, Protocol II.1,
II.6a.6, III.6a and VIII.1–5/2a, the period-key and calc-result schemas, and the
portable corpus. No TypeScript source was used as an implementation template.
Runtime files do not invoke subprocesses, Node, hosted APIs, or fixture/expected
lookups. The tests use the existing corpus as the external oracle.

- `uwmd_reader.py`: restricted YAML, annotated fenced JSON, raw Unicode source,
  numeric token spelling/decimal precision, absent/null distinctions, unknown
  fields/sections/extensions, history, append collections, parallel variants and
  role opt-in. `content` remains an ordinary payload member. Offsets are Unicode
  character offsets, **not UTF-8 byte offsets**. Full original input remains
  available through `Document.source` and each block retains its JSON text.
- `uwmd_calendar.py`: integer/character Gregorian predicate including year 0000.
  The inherited `uwmd_numeric.calendar_date` seed rejects year 0000 and uses
  `datetime`; it is left untouched and is not used by this slice's date checks.
- `uwmd_periods.py`: all five registered series, kind-qualified identities,
  exact declared years, keyed `year_01` collisions, whole-series inspection,
  variant and role selection, blocked path segments, and RFC0062 same-day
  selection refusal without merging cash rows. This is an internal structured
  path API; expression parsing provides the string-path entry point. It does
  not implement every public TypeScript helper or impose its API on Python.
- `uwmd_validation.py`: **partial** META/ROLE/PS structural checks. Results
  state `complete: false`, `verification_state: unverifiable`; CLI exits 1.
  This is not advertised as a complete structural `ValidationResult`.
- `uwmd_expressions.py`: safe AST grammar; no host-language `eval`/`exec`;
  arithmetic, boolean short-circuiting, selected scalar builtins, section/period
  resolution, binary64 steps, and one final quantization using the existing seed
  quantizer. Calc output is experimental; no `calc-evaluate` claim is made.

## Blockers and escalation record

[Issue #356](https://github.com/UWMD-OSP/UW-Markdown/issues/356) and draft RFC0088
have **not** accepted a running-product, library-power, or fractional-power
procedure. `pow`, `log`, `exp`, `nper`, annuities, periodic returns and dated
returns raise a local `NumericalContractBlocked`. The development CLI reports
`implementation_status: blocked` and nonzero exit. That local status is not a
new Protocol error code or a financial failure verdict. Dead branches remain
unevaluated; the parser still validates the complete expression.

Further questions for maintainers, not guessed completion rules:

1. VIII.1 defines `%` syntax but does not specify negative remainder/modulo
   semantics. This evaluator blocks `%` pending clarification.
2. Null conditional predicates and collection equality lack explicit operator
   semantics in VIII.1–3. They are blocked locally. Scalar equality is currently
   typed, without Python boolean-to-number coercion; cross-type comparison and
   the full operator type table need explicit review before any capability claim.
3. The inherited seed's date behavior conflicts with VIII.3/RFC0071 for year
   0000. The conforming predicate is separate so #357's files stay untouched.
4. II.6a.6 sketches wrapped block collections, while the full-multifamily portable
   oracle requires complete pipeline-log objects. This projection follows that
   existing oracle; clarify the collection-specific contract before certification.
5. Duplicate JSON/fence/frontmatter keys refuse to avoid silent loss, consistent
   with V.13.2. The general Reader error codes for these cases are not fully
   enumerated; local parse codes need review before being treated as registered
   normative additions. No normative code registry was edited.

Missing implementation is distinct from the numerical blocker: full Format
validation, all required cross-check coverage, PS-03, metric dictionary checking,
source-statement precision comparisons, all II.2 stated-figure verifiers
(including assembly/waterfall/reserves/bindings), receipt subject/result
canonicalization and receipt verification remain outstanding. Neither a missing
profile nor a passing ratio can remove these base obligations. Broader optional
Integrity/signature/module/stochastic/sensitivity/profile work is unclaimed.

## Reproduction

From the repository root, with only Python installed:

```sh
python3 -B -m unittest discover -s implementations/python -p '*354.py' -v
python3 -B implementations/python/uwmd.py parse conformance/documents/fixtures/01-minimal-screening.uwx.md
python3 -B conformance/runner/runner.py --impl 'python3 /tmp/uwmd-lane-354/implementations/python/uwmd.py' --tier reader --manifest-out implementations/python/evidence354/portable-reader.json
python3 -B conformance/runner/runner.py --impl 'python3 /tmp/uwmd-lane-354/implementations/python/uwmd.py' --tier verifier --manifest-out implementations/python/evidence354/portable-declared.json
python3 -B conformance/runner/runner.py --impl 'python3 /tmp/uwmd-lane-354/implementations/python/uwmd.py' --tier verifier --no-skip --manifest-out implementations/python/evidence354/portable-verifier.json
```

Replace the absolute implementation path for another checkout. The last command
must exit **1**: it deliberately runs undeclared capabilities and counts missing
claims as failures. Its per-case problems retain baseline differences separately.
See `evidence354/coverage-summary.json` and the unmodified runner manifests/TAP
for actual coverage. Observations are Python 3.12.3 on this Linux environment;
3.10 compatibility parsing is not execution evidence on Python 3.10, macOS, or
Windows. No cross-platform financial bit-identity claim is made.

The required repository gates were attempted: build/typecheck fail because
`tsc` is absent, test fails because `vitest` is absent, and reference conformance
fails at its guard because `ajv` is absent. These are actual failed commands,
not green gates or an observed full-reference numerical failure. Their complete
logs are retained in `evidence354/`.
