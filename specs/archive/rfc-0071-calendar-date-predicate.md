# RFC 0071 implementation specification

**Feature:** accepted RFC 0071.

| Record | Value |
|---|---|
| RFC accepted | 2026-10-04, at PR #249 head `bf57e6037032cbcb32964fcde071a9c75c611e45` |
| Implementation authorized | 2026-10-04, separately by the owner |
| Canonical base | `a1b3a747f5dcd3c42f6d8159305bba0774d71366` (the PR #249 merge) |
| Frozen contract | the owner acceptance record in `docs/rfcs/0071-calendar-date-predicate.md` |
| Branch | `claude/implement-rfc-0071` |
| Implementation PR | #250 |
| Implementation commit | `493811eb6d4be60a39a9d60eea9d51107012fd88` |

## Contract and scope

Implement `docs/rfcs/0071-calendar-date-predicate.md` exactly: add
`is_calendar_date(value) → boolean` to the shared Protocol §VIII.3 builtin set.

**What it returns**
- `true` only for a string in the exact ASCII form `YYYY-MM-DD` that names a
  real proleptic Gregorian date, for years `0000`–`9999`. Year `0000` is a
  leap year.
- `false` for every other value:
  - `null`, absent paths, numbers, booleans, arrays and objects;
  - malformed strings and impossible dates;
  - date-times and zone designators;
  - strings with any whitespace, or with non-ASCII digits or separators.

**What it never does**
- Returns `null`.
- Coerces, trims or Unicode-normalizes the argument.
- Consults a locale, time zone, the host clock or `Date.parse`.

**Errors**
- A wrong number of arguments raises `CALC-TYPE-001`.
- An error raised while evaluating the argument propagates unchanged.

**How it is built**
- It reuses `parseISODate`, behind an explicit string check that runs first.
  No second calendar parser is written.
- Custom calculations, module calculations, module validations, and the
  `@uwmd/core` and `@uwmd/core/browser` entry points all reach it through the
  one evaluator. There is no rule-specific machinery.

**In module rules**
- A bad authored date makes the rule evaluate `false`, so the rule reports its
  own code.
- `MOD-RULE-ERROR` stays reserved for evaluation failures.

**Protocol floor (§X)**
- A module whose calculation or validation calls the predicate MUST declare a
  `requires_protocol` range that excludes every Protocol version lacking it.
- Release preparation assigns the exact first compatible version.
- The existing §VII.2 step 3 refusal (`PROTO-MOD-030`) enforces the floor. No
  loader check or error code is added.

**Excel**
- No Excel mapping is added.
- The core emitter refuses the predicate with `EXCEL-EMIT-FN`.
- Adjacent error-code correction: the `@uwmd/excel` custom-calculation export
  now classifies any unsupported function call as `EXCEL-EMIT-FN` (it was
  `EXCEL-EMIT-PATH`), so the two emission paths agree. No Excel function
  support is added, and conditionals keep `EXCEL-EMIT-PATH`.

**Normative changes**
- Protocol: the §VIII.3 row and paragraph, the §VIII.9 cross-reference, and
  the §X floor.
- `module-manifest.schema.json`: the `requires_protocol` description only.
- The text is publication-neutral, and no version label moves.

## Explicit authorization boundaries

Not authorized under this implementation authorization:
- the `actualDays()` years-0000–0099 defect, which stays tracked separately in
  `docs/wiki/13-status.md`;
- any change to RFC 0068;
- a numeric-type predicate;
- release preparation, version selection or bumps, and tags or publication;
- changes to unrelated financial semantics;
- RFC status promotion.

Format 2.0, Protocol 2.21.0 and core/CLI 2.17.0 labels are kept until the
owner's separate release decision. A test-only hypothetical floor in
`module-runtime.test.ts` (`HYPOTHETICAL_FIRST_RELEASE_FOR_TEST_ONLY`) is not a
selected version. **RFC 0071 remains `accepted`.**

## Definition of done

- **Implementation and coverage.** The builtin is implemented, with full
  coverage of the accepted case matrix, the document-value, error and
  module-rule behaviour, browser parity, and Excel refusal on both paths.
- **Oracle.** An exhaustive and property oracle runs independently of
  `parseISODate` and `Date`.
- **Fixtures.** 48 tier-3 fixtures were added, with their generated v2 cases.
- **Spec, schema and docs.** All are synchronized.
- **Gates green:** build, unit tests, test typechecks, default, portable and
  profile conformance, the generated-case check, schemas, packages, lockfile,
  versions, indexes, codes, release record, release readiness, lint and the
  docs build.
- **Delivery.** Commit, archive this matrix, and open a PR for review. Do not
  merge or prepare a release under this authorization.

## Completed task matrix

# RFC 0071 implementation task matrix

- **Base:** `a1b3a747f5dcd3c42f6d8159305bba0774d71366`.
- **Contract:** accepted RFC 0071, frozen at `bf57e60`.
- **RFC status:** remains `accepted`.

- [x] **COMPLETE: the builtin.** `BUILTINS.is_calendar_date` checks arity,
  then that the value is a string, then calls `parseISODate`.
- [x] **COMPLETE: unit tests** in `calc.test.ts`:
  - the case matrix and document values without coercion;
  - arity and argument-propagation errors;
  - time-zone and locale independence;
  - browser/core parity.
- [x] **COMPLETE: oracle** in `calc.property.test.ts`. It uses a character-code
  oracle, without `parseISODate` or `Date`.
  - An exhaustive sweep of 4,620,000 strings found 3,652,425 valid dates.
  - Fast-check covers arbitrary strings and non-string JSON values.
- [x] **COMPLETE: module rules** in `module-runtime.test.ts`:
  - a bad date reports the rule's own code;
  - the optional pattern is silent on absence;
  - arity and argument errors report `MOD-RULE-ERROR`;
  - a module calculation evaluates the predicate;
  - the §X floor is refused through `PROTO-MOD-030`, with the `>2.21.0`
    counterexample.
- [x] **COMPLETE: Excel.** The core emitter refuses with `EXCEL-EMIT-FN` in
  all three emission functions. The custom-calculation export refuses
  function calls with `EXCEL-EMIT-FN`, and a conditional still gets
  `EXCEL-EMIT-PATH`.
- [x] **COMPLETE: normative synchronization.** Protocol §VIII.3, §VIII.9 and
  §X, and the manifest-schema description.
- [x] **COMPLETE: conformance.** Tier-3 fixtures `date-01` to `date-48` and
  their generated v2 cases.
- [x] **COMPLETE: documentation.**
  - wiki 04 and the docs-site calc conventions page;
  - the `@uwmd/excel` README and the tier-3 README, whose stale builtin
    inventory was corrected;
  - the RFC implementation notes;
  - `13-status.md` and the CHANGELOG `[Unreleased]` section.
- [x] **COMPLETE: gates and PR.** All gates were run, the work committed and
  PR #250 opened.

## Verification

**Local, final tree, from a clean `npm ci`**

| Gate | Result |
|---|---|
| Build | green |
| Test typechecks | green |
| `conformance` | 782/782 |
| `conformance:v2 --no-skip` | 206/206 |
| Conformance profiles | 3 of 3 behave as RFC 0030 specifies |
| Generated cases | 206 current |
| Schemas, packages, lockfile, versions, indexes, codes, release record, release readiness | all pass |
| Lint | green |
| Docs build | green |
| `git diff --check` | clean |
| `npm test` | all green except one CLI smoke test, `refine uses selected variants…`, which timed out at 5 s |

The `npm test` timeout reproduced 3 of 3 times on an unmodified worktree at
`a1b3a74`, in 5.9 s, 5.8 s and 11.2 s. It came from machine load, not from
this change. No timeout or test expectation was changed.

**Exact-head CI on `493811e`:** run 37191921502 succeeded, and all 15 checks
passed. They include build and test on Node 20 and 22, Windows conformance,
coverage, lint, the schema/index/code/version/lockfile/release-record verifiers,
the web editor, the VS Code extension and Vercel.

**Completion**
- Implementation commit: `493811eb6d4be60a39a9d60eea9d51107012fd88`, on PR #250.
- The owner reviews and merges PR #250.
- RFC 0071 remains `accepted`. It becomes `implemented` only after a release
  ships it and its publication is independently verified.
- Release and version selection remain separately gated.
