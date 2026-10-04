---
rfc: 0071
title: A calendar-date validity predicate for safe expressions
status: draft
author: claude-code (agent proposal)
created: 2026-10-03
depends_on:
  - 0006
  - 0034
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
  - documentation
---

# RFC 0071: A calendar-date validity predicate for safe expressions

**Draft agent proposal.** A coding agent wrote this RFC for owner review. It is
not accepted, and it authorizes no implementation, no spec or schema edit, and
no version change.

## Summary

A safe expression cannot tell a real calendar date from any other string. A
module rule can check that a date field is present, but not that it is valid,
so `"2026-02-30"` passes every rule.

This RFC proposes one new §VIII.3 builtin:

```
is_calendar_date(value) → boolean
```

It returns `true` only when `value` is a string spelling a real proleptic
Gregorian date in the exact form `YYYY-MM-DD`. It returns `false` for anything
else, including `null`, numbers, date-times and impossible dates. It never
returns `null`, and no argument value makes it raise an error.

- **Shared grammar.** It goes into the §VIII.3 table that every Tier-3 host
  implements. It is not a rule-only feature, because Protocol §X forbids a
  module evaluation path that the calc engine lacks.
- **One calendar.** It uses the calendar that §VIII.2a period selectors and
  §VIII.9 dated series already use.
- **Additive.** It is one new function. The grammar, value types, error codes
  and Format are unchanged. The only schema edit is description text.
- **Mandatory protocol floor.** A module that calls the predicate MUST
  require a Protocol version that has it. An older host then refuses the
  manifest at load under the existing §VII.2 step 3, instead of loading it and
  failing its rules.

With it, RFC 0068's `CC-MOD-MH-05` can be written as
`mhc_sites == null || is_calendar_date(mhc_sites.as_of_date)`. A malformed
`as_of_date` then reports `CC-MOD-MH-05` through an ordinary rule evaluating
`false`, and no module-specific runtime is needed.

## Motivation

### Canonical baseline

Verified on `origin/main` at `2df048c83c3b0efb185df7e075527f21c1784932`:
UWMD 2.17.0, Protocol 2.21.0 Stable (RFC 0070), Format 2.0, and the PR #248
module distribution support.

### What exists today

**The grammar has string literals but no way to inspect a string.** §VIII.1
defines `string ::= "'" [^']* "'"`, and the reference parser implements it.
`'2026-06-30'` parses; `"2026-06-30"` (double quotes) is `CALC-PARSE-001`.
Once a string exists, an expression can only:

- test equality (`==`, `!=`);
- order it lexicographically (`<`, `<=`, `>`, `>=`);
- concatenate it (`+`);
- pass it through `coalesce` or `if`.

The §VIII.3 table has no length, substring, character-class, pattern or date
function.

**No expression in today's grammar decides date validity.**

- *Presence.* `x != null` is `true` for any non-null value, valid or not.
- *A range check* such as `x >= '0000-01-01' && x <= '9999-12-31'` accepts
  `'2026-02-30'`, `'2026-1-01'` and `'2026-06-30T00:00:00Z'`. On a numeric `x`
  it raises `CALC-TYPE-001`, because ordered comparison needs operands of one
  type.
- *Enumeration.* Valid dates are isolated points in lexicographic string order,
  so a correct rule would have to list all 3,652,425 of them. That is far
  beyond the 4,096-character expression limit (`CALC-LIMIT-001`).

**Module rules.** Each module rule is evaluated by
`runRule` in `packages/uwmd-core/src/module-runtime.ts`, through the same
`evaluateCalc` as calculations:

| Rule evaluates to | Runtime reports |
|---|---|
| `false` | the rule's own code and severity |
| `null`, `true`, or any other value | nothing |
| an evaluation failure | `MOD-RULE-ERROR`, naming the rule. Its remediation says "Fix the rule expression in `<module>`" |

**Section schemas are not enforced.** A module section's JSON Schema is
shape-checked when the manifest loads and never applied to documents
(`checkModuleSections`, RFC 0006 note 3, Protocol §X). This is deliberate:
`@uwmd/core` takes no JSON Schema validator.

**Core already has the right check, but it is unreachable from expressions.**
`parseISODate` in `packages/uwmd-core/src/calc/day-count.ts` (RFC 0034) is
deterministic. It matches `^(\d{4})-(\d{2})-(\d{2})$` and checks the month and
the real length of the month by integer arithmetic. It does not call
`Date.parse`, read a locale or read the clock. It is already exported from both
`@uwmd/core` and `@uwmd/core/browser`. It backs:

- §VIII.2a `YYYY-MM-DD` period selectors (`periods.ts`);
- the §VIII.9 dated series (`cash-flow-series.ts`, `waterfall.ts`);
- lease-up and property cash-flow dates;
- RFC 0070 replacement-funding dates;
- validator date checks.

§VIII.9 says its procedures are "reachable only through a declaration or the
verifier — the §VIII.1 grammar and the §VIII.3 expression-callable table are
unchanged". So no expression can reach it.

### Observed behaviour

Probed on the built `2df048c` core, using the real `evaluateCalc` and
`validateAgainstModules` with a toy manifest. The scratch harness is not
committed.

| `as_of_date` | `x != null` | range check above | RFC 0068 `CC-MOD-MH-05` today | `is_calendar_date(x)` today |
|---|---|---|---|---|
| `"2026-06-30"` | `true` | `true` | no issue | `CALC-RESOLVE-001` |
| `"2026-02-30"` | `true` | `true` | **no issue** | `CALC-RESOLVE-001` |
| `"2026-1-01"` | `true` | `true` | **no issue** | `CALC-RESOLVE-001` |
| `"2026-06-30T00:00:00Z"` | `true` | `true` | **no issue** | `CALC-RESOLVE-001` |
| `20260630` (number) | `true` | `CALC-TYPE-001` | **no issue** | `CALC-RESOLVE-001` |
| `null` / absent | `false` | `null` | `CC-MOD-MH-05` | `CALC-RESOLVE-001` |

A manifest whose rule calls an unknown function loads on today's host.
`PROTO-MOD-026` refuses only rules that do not parse. Such a rule then reports
`MOD-RULE-ERROR` on every document it applies to.

Frontmatter is not a hazard. The strict YAML subset (Format Appendix A) keeps
an unquoted `close_date: 2026-10-03` as the string `"2026-10-03"`, not a YAML
timestamp, and JSON section values are always typed by JSON.

### The exact limitation

**A module rule cannot deterministically distinguish a valid calendar date
from an arbitrary string.** The only date-validity check a module can state
today is presence. Anything that is present but malformed, impossible, a
date-time or not a string draws no issue at all.

Nor is `MOD-RULE-ERROR` the intended signal for bad document data:

- RFC 0006 note 4 and the `module-runtime.ts` doc comment define it as the
  trace of a rule that "fails to *evaluate*". That is an authoring defect in
  the module, and its remediation tells the reader to fix the module.
- RFC 0068 lists using it for bad document values as an open owner question
  (its Unresolved question 2), not as an existing contract.

## Proposed change

### 1. Protocol §VIII.3: one new table row

| Name | Signature | Notes |
|---|---|---|
| `is_calendar_date(value)` | `(any) → boolean` | `true` only for a valid `YYYY-MM-DD` calendar-date string; see below. Never `null`. No argument value raises. |

### 2. Protocol §VIII.3: new normative paragraph

> **Calendar-date predicate (normative, RFC 0071).** `is_calendar_date(value)`
> takes exactly one argument; a call with any other number of arguments raises
> `CALC-TYPE-001`. The argument is evaluated like any other argument (§VIII.2),
> and an error raised while evaluating it propagates unchanged. The function
> returns `true` if and only if all three conditions hold, and `false`
> otherwise:
>
> 1. **Type.** `value` is a string. `null` (including a missing path, §VIII.2),
>    a number, a boolean, and any object- or array-valued resolution are not
>    strings. A host **MUST NOT** convert a non-string to a string before
>    testing it.
> 2. **Lexical form.** `value` is exactly ten characters of the form
>    `YYYY-MM-DD`, where each `Y`, `M` and `D` is an ASCII digit `0`–`9`
>    (U+0030–U+0039) and each `-` is U+002D. No other character may appear
>    anywhere: no leading, trailing or internal whitespace of any kind, sign,
>    expanded year, time, `T` designator, zone designator (`Z`, `±hh:mm`) or
>    fractional part. A host **MUST NOT** trim, case-fold or Unicode-normalize
>    `value` first.
> 3. **Calendar.** Let `y`, `m` and `d` be the decimal values of the year,
>    month and day digits. Then `1 ≤ m ≤ 12` and `1 ≤ d ≤ L(y, m)`, where:
>    - `L` is 31 for months 1, 3, 5, 7, 8, 10 and 12;
>    - `L` is 30 for months 4, 6, 9 and 11;
>    - for month 2, `L` is 29 when `y` is a leap year and 28 otherwise.
>
>    `y` is a leap year when it is divisible by 400, or divisible by 4 and not
>    by 100. This is the proleptic Gregorian calendar of §VIII.9.1, under
>    which year `0000` is a leap year. Every year from `0000` to `9999` is in
>    range.
>
> The result **MUST** be computed from the characters of `value` alone, by
> integer comparison. A host **MUST NOT** consult a date parser (`Date.parse`
> or equivalent), a time zone, a locale, the host clock, or any environment
> setting (§VIII.4). The calendar is the one §VIII.2a `YYYY-MM-DD` selectors
> and §VIII.9 dates already use.
>
> Unlike the arithmetic builtins, `is_calendar_date` does not propagate
> `null`. It answers whether its argument is a calendar date, and `null` is
> not one. An expression that accepts an absent value says so explicitly:
> `x == null || is_calendar_date(x)`.
>
> No Excel emission is defined. Excel's date functions depend on locale and on
> the workbook date system, and its 1900 date system treats `1900-02-29` as a
> real day. A converter refuses a formula that calls `is_calendar_date`, as the
> reference emitter already refuses `avg` and `coalesce` (`EXCEL-EMIT-FN`).
>
> A module that calls `is_calendar_date` is subject to the protocol floor in
> §X.

### 3. Protocol §X: a mandatory protocol floor

This text is added to §X, after the "A registered module must actually run"
list:

> **Protocol floor for `is_calendar_date` (RFC 0071).** A module manifest
> whose `calculations[].formula` or `validations[].rule` calls
> `is_calendar_date` anywhere in its expression **MUST** declare a
> `requires_protocol` range that excludes every Protocol version in which
> `is_calendar_date` is unavailable. No version earlier than the one that
> introduced it may satisfy the range.
>
> The range is what lets an older host decline the module. Under §VII.2
> step 3, a host refuses a manifest whose `requires_protocol` its own
> versions do not satisfy, with a `ProtocolError` of category `module`. It
> therefore never registers a rule it cannot evaluate. Without the floor,
> that host would load the module and report each such rule as a failure to
> evaluate (`CALC-RESOLVE-001`) on every document.
>
> This requirement adds no loader check and no error code. §VII.2 step 3 is
> the enforcement, and the reference library already reports it as
> `PROTO-MOD-030`. A manifest that violates the requirement is
> non-conforming. A host is not required to detect the violation.

This follows the existing semantics of `requires_protocol`:

- §VII.2 step 3 refuses on a version mismatch.
- §XII.4 refuses a module that requires a later major.
- The manifest schema's description of `requires_protocol` already tells
  authors which floor a feature needs: `>=1.3.0` for honoured `round_to`, and
  `>=1.4.0` for the normative `irr`.

RFC 0071 turns that advice into a MUST for the one builtin it adds. The
reason is that an unknown function is not an engine-specific difference in
a result; the rule cannot run at all. The requirement is not generalized to
other builtins here.

### 4. `module-manifest.schema.json`: description text only

The `requires_protocol` description gains a sentence beside its 1.3.0 and
1.4.0 notes:

> Protocol `<RFC 0071 release>` adds `is_calendar_date` in section VIII.3;
> a module calling it must require that version or later (section X).

The schema's validation behaviour does not change.

### 5. Protocol §VIII.9: one sentence amended

The §VIII.9 introduction says the §VIII.1 grammar and the §VIII.3 table are
unchanged by RFC 0034. That sentence gains:

> RFC 0071 later added `is_calendar_date`, a validity predicate over the same
> calendar. No day count, `yearfrac`, date arithmetic or date value type is
> reachable from an expression.

### 6. Header and labels

At release, the Protocol status line, `PROTOCOL_VERSION`, and the RFC 0061
synchronized labels move to the selected minor version (see
[Versioning](#versioning)).

### Deterministic semantics: the case matrix

`✓` means `true` and `✗` means `false`. No row raises an error.

| Input | Result | Rule exercised |
|---|---|---|
| `"2024-02-29"` | ✓ | leap year (÷4, not ÷100) |
| `"2026-10-03"` | ✓ | ordinary date |
| `"2000-02-29"` | ✓ | leap year (÷400) |
| `"2026-12-31"`, `"2026-01-01"` | ✓ | month bounds |
| `"0000-02-29"`, `"9999-12-31"` | ✓ | year range ends; `0000` is a leap year |
| `"2023-02-29"` | ✗ | not a leap year |
| `"1900-02-29"` | ✗ | ÷100, not ÷400. Excel's 1900 system accepts it; this predicate does not |
| `"2026-02-30"` | ✗ | day beyond the month |
| `"2026-04-31"` | ✗ | 30-day month |
| `"2026-13-01"` | ✗ | month > 12 |
| `"2026-00-10"` | ✗ | month 0 |
| `"2026-10-00"` | ✗ | day 0 |
| `"2026-1-01"`, `"2026-10-3"`, `"26-10-03"`, `"02026-10-03"` | ✗ | wrong field width |
| `" 2026-10-03"` (leading space) | ✗ | no trimming |
| `"2026-10-03 "` (trailing space) | ✗ | no trimming |
| `"2026-10-03\n"`, `"\t2026-10-03"`, `"2026-10-03 "` | ✗ | any whitespace |
| `"2026-10-03T00:00:00Z"`, `"2026-10-03T00:00:00"`, `"2026-10-03 00:00"` | ✗ | date-time |
| `"2026-10-03Z"`, `"2026-10-03+00:00"` | ✗ | zone designator |
| `"2026/10/03"`, `"20261003"`, `"2026-W40-6"`, `"2026-276"` | ✗ | other ISO 8601 or local forms |
| `"+2026-10-03"`, `"-2026-10-03"` | ✗ | sign or expanded year |
| `"２０２６-10-03"` (full-width digits), `"2026‐10‐03"` (U+2010) | ✗ | non-ASCII; no normalization |
| `""` (empty string) | ✗ | lexical form |
| `null`, or an absent path | ✗ | type (never `null`) |
| `20261003`, `2026`, `0` | ✗ | type: number |
| `true`, `false` | ✗ | type: boolean |
| `["2026-10-03"]`, `{ "date": "2026-10-03" }` | ✗ | type. No string coercion, so a one-element array is not read as its element |

The brief that commissioned this RFC listed `2026-10-03` twice among the
invalid cases. They are taken as the leading-space and trailing-space
variants, because the bare string is listed as valid.

### Rule and error behaviour

| Situation | Expression result | Module rule outcome |
|---|---|---|
| Argument is a valid calendar-date string | `true` | silent |
| Argument is anything else, including `null` and absent | `false` | **the rule's own code** (if nothing else in the rule makes it `true`) |
| Wrong number of arguments | raises `CALC-TYPE-001` | `MOD-RULE-ERROR`: an authoring defect |
| The argument expression itself fails (`CALC-RESOLVE-002`, `CALC-FORBIDDEN-PROP`, a type error inside it) | that error propagates | `MOD-RULE-ERROR`: an authoring or document-shape defect the predicate does not hide |
| Host predates this RFC, conforming manifest | — | The rule never runs. The host refuses the manifest at load (§VII.2 step 3; `PROTO-MOD-030` in the reference library), because the §X floor excludes its version |
| Host predates this RFC, non-conforming manifest that omits the floor | `CALC-RESOLVE-001` | `MOD-RULE-ERROR` on every document: the failure the §X MUST exists to prevent |

These follow the existing convention unchanged. A rule fires on `false` and is
silent on `null`, and the predicate itself never produces `null`. The patterns
an author needs:

| Intent | Rule |
|---|---|
| Required and valid | `is_calendar_date(s.d)` |
| Valid when present | `s.d == null \|\| is_calendar_date(s.d)` |
| Section-guarded, as RFC 0068 writes every rule | `s == null \|\| is_calendar_date(s.d)` |
| Valid and not before a stated date | `is_calendar_date(s.d) && s.d >= '2000-01-01'` |

The last row uses only existing behaviour. Fixed-width `YYYY-MM-DD` strings sort
lexicographically in date order, and `&&` short-circuits, so the comparison
never sees a non-string. This RFC adds no date comparison of its own.

### Where it is available

The predicate is available to the **shared safe-expression grammar**: pack and
custom calculations, module calculations and module rules alike. It cannot be
offered to rules alone, for two reasons:

- Protocol §X says a module host "MUST NOT introduce an evaluation path a
  module can reach that the calc engine cannot".
- RFC 0006 says a module rule is evaluated by the same sandbox as a
  calculation, with "no new evaluation machinery".

A calculation may return its boolean. `CalcResult.value` already admits
`boolean`, and §VIII.5 quantization applies only to numbers. No builtin calc
pack is changed to use it.

## Compatibility analysis

- **Existing documents.** None changes meaning or validity. No Format field,
  type or rule changes, and no new Format date type is introduced.
- **Existing expressions.** Every expression that evaluated before evaluates
  the same. The only change is that `is_calendar_date(...)` now evaluates
  where it raised `CALC-RESOLVE-001`. Function names and identifiers are
  separate (`identifier "(" arglist ")"`), so a section or frontmatter key
  named `is_calendar_date` still resolves as before.
- **Tier-1 and Tier-2 implementations.** Unaffected.
- **Tier-3 calc hosts.** §II.3 clause 2 requires the whole §VIII.3 set, so a
  host claiming the new protocol minor must implement the predicate. A host on
  2.21.0 remains conforming to 2.21.0.
- **Tier-4 agent hosts.** They inherit the Tier-3 obligation. AI performs no
  date validation; the evaluator does.
- **Modules.**
  - The manifest schema, rule syntax and manifest contracts are unchanged.
  - The shipped hospitality and data-centre modules do not call the
    predicate, so their behaviour and `requires_protocol` floors are
    unchanged.
  - A module that adopts the predicate MUST raise its `requires_protocol`
    floor (§X, item 3 above). See
    [Relationship to RFC 0068](#relationship-to-rfc-0068).
- **Excel.** `FUNCTION_MAP` gains no entry, so emission refuses with
  `EXCEL-EMIT-FN`. Invariant 4 is untouched: no pack formula uses the
  predicate, and refusing a formula is how parity is already kept for `avg`
  and `coalesce`.
- **`@uwmd/lake`, receipts, CLI.** None of them interprets builtin names. A
  boolean module result is already a valid `CalcResult.value`.

### Versioning

| Surface | Change | Recommended |
|---|---|---|
| Protocol | Additive §VIII.3 builtin, a new Tier-3 obligation, and a §X manifest requirement that applies only to manifests calling the new builtin | **Minor.** Provisionally 2.22.0, if no intervening release claims it |
| Format | none | stays 2.0 |
| `spec/schemas/*` | Description text of `module-manifest` `requires_protocol` only. `calc-result` already admits `boolean` | no validation change |
| Error codes | none (reuses `CALC-TYPE-001`; `EXCEL-EMIT-FN` already exists) | `verify-codes` unaffected |
| `@uwmd/core` | `BUILTINS` gains a key; new evaluation behaviour | **Minor.** Provisionally 2.18.0, paired with the CLI, if no intervening release claims it |
| Excel, report, batch, signing, lake, both modules | no source change | exact-pin repins only, per release practice |
| Module manifest contracts | none | unchanged (0.1.0) |

The exact Protocol and core numbers are a release-preparation decision, as
RFC 0070's were. Draft RFCs 0064, 0065 and 0067 may claim a minor first. The
§X floor and the schema description name the release that actually ships
RFC 0071, whatever its number.

## Conformance impact

No existing fixture changes. The tier-3 `README.md` builtin list is already
stale (it names 8 of 20). It would list the full set at implementation.

**New tier-3 fixtures:** `conformance/tier-3-calc-host/fixtures/date-NN-*`,
each with `calc.json` and `expected-result.json`.

- **Literal cases.** Because string literals exist, every lexical and calendar
  row of the case matrix can be one formula over a literal, for example
  `is_calendar_date('1900-02-29')` → `false`, with no document dependence.
- **Document cases.** The type and absence rows read values from a synthetic
  deal:
  - `null`, an absent path, a number and a boolean, from frontmatter extension
    keys (§XII.1);
  - an array and an object, from a JSON section;
  - a quoted string and an unquoted YAML date, which prove the parser
    delivers both as strings.
- **Error cases:**
  - `is_calendar_date()` and `is_calendar_date(a, b)` → `ok: false`,
    `CALC-TYPE-001`;
  - an argument that raises (a non-boolean `&&` operand) → that error, not
    `false`.
- **Expected values.** Every success case pins `ok: true` and a boolean
  `value`. No success case may expect `null`.

**Module runtime.** `conformance/modules/runtime/` scenarios run a real module
package, and no module adopts the predicate in this RFC. The rule mapping is
covered by unit tests on a toy manifest in `module-runtime.test.ts`, the
established pattern. Each must show:

- a malformed or impossible date reports **the rule's own code**, not
  `MOD-RULE-ERROR`;
- a numeric date reports the rule's code;
- the `x == null ||` form is silent on absence;
- an arity error is `MOD-RULE-ERROR`.

RFC 0068's runtime suite would add document-level scenarios when that module
is implemented.

**Surface guard.** The `calc.test.ts` test that pins `Object.keys(BUILTINS)` to
the §VIII.3 table gains `is_calendar_date`. The guard stays, so the builtin set
still cannot grow by accretion.

## Reference implementation

Not authorized by this draft. If accepted:

- **Builtin.** `packages/uwmd-core/src/calc/builtins.ts` gains
  `is_calendar_date`, about ten lines:
  - check arity;
  - check `typeof args[0] === 'string'` before anything else, because
    `parseISODate` would otherwise coerce a one-element array through
    `String()`;
  - return `parseISODate(args[0]) !== null`.

  It imports `parseISODate` from `./day-count.js`, which is in the same `calc/`
  directory, browser-safe, and free of I/O, locale and clock. No second date
  parser is written.
- **Browser and core parity.** `@uwmd/core` and `@uwmd/core/browser` export
  the same `BUILTINS` object and the same `evaluateCalc` from
  `./calc/index.js`. The web viewer, the web editor and any browser host
  therefore get the predicate by construction. A test asserts that the key is
  present on the browser entry, and that both entries answer the case matrix
  identically.
- **Exports.** No new public symbol. `BUILTINS` gains a key, and
  `parseISODate` is already public.
- **Spec.** The §VIII.3 row and paragraph, the §X protocol floor, the
  §VIII.9 sentence, the `module-manifest.schema.json` description sentence,
  and the version labels, under RFC 0061's synchronization guard.
- **Docs.**
  - `docs/wiki/04-calc-engine.md` and `tools/docs-site/guide/calc-conventions.md`
    list the builtin and the emitter refusal;
  - the tier-3 conformance README;
  - CHANGELOG, `VERSIONS.md` and `docs/wiki/13-status.md` at release.
- **Tests:**
  - every case-matrix row in `calc.test.ts`;
  - a property test checking the predicate against an independent oracle over
    all `y ∈ [0, 9999]`, `m ∈ [0, 13]`, `d ∈ [0, 32]`. The oracle must not use
    `Date.UTC`, which maps years 0–99 to 1900–1999;
  - the module-runtime cases above;
  - an Excel-emitter test that `is_calendar_date` refuses with
    `EXCEL-EMIT-FN`.
- **Gates:** `npm run build && npm test && npm run conformance`,
  `typecheck:tests`, `verify-indexes`, `verify-codes`, `validate-schemas`.

## Relationship to RFC 0068

RFC 0068 (draft) states that `as_of_date` validity "is not enforceable", and
lists a date predicate or schema enforcement as the remedy (its Unresolved
question 1). Reconciled against `2df048c`:

- **Its observed behaviour is accurate.** A malformed `as_of_date` draws no
  issue (table above). So does a numeric one: `!= null` does not test type.
  The latter case is not stated in RFC 0068.
- **One premise is imprecise.** RFC 0068 says the grammar has "no string
  literals". It has single-quoted literals (§VIII.1); only the double-quoted
  example fails to parse. Its conclusion still holds, because no string
  inspection function exists.
- **Its numeric type-error behaviour is unchanged by this RFC.** A non-numeric
  value in a numeric field still reports `MOD-RULE-ERROR` (its Unresolved
  question 2). A total type predicate such as `is_number` would follow the
  same design, but it is a separate RFC and is not proposed here.

**What RFC 0068 can then express.** No module-specific runtime is needed.
`CC-MOD-MH-05` becomes:

```
mhc_sites == null || is_calendar_date(mhc_sites.as_of_date)
```

That one rule reports `CC-MOD-MH-05` for a date that is:

- missing or `null`;
- numeric or another non-string;
- malformed or impossible (`2026-02-30`);
- a date-time.

Its message would read "`as_of_date` is missing or not a valid `YYYY-MM-DD`
date". The other consequences for RFC 0068:

- **Manifest floor.** If RFC 0068 adopts the predicate, its current
  `requires_protocol: '>=2.5.0'` **must** rise to the release containing RFC
  0071, as §X (item 3 above) requires. RFC 0068's statement that the module
  "uses no later feature" would no longer hold.
- **Calculations.** None reads the date, so none changes.
- **Fixtures.** RFC 0068 gains malformed, impossible, date-time and numeric
  date fixtures, each reporting `CC-MOD-MH-05` alone.

**Sequence.** This RFC must be accepted, implemented and released before RFC
0068 can rely on it. This PR does not edit RFC 0068, change its rules, or
change manufactured-housing semantics. The owner directed on 2026-10-03 that
RFC 0068 adopt `is_calendar_date` in its own revision.

## Existing implementation drift (non-scope)

Checking the year range exposed a separate defect. It predates this RFC, and
this RFC does not change it.

- **RFC 0071's domain is unchanged.** Years run from `0000` to `9999`, and
  `0000` is a leap year. That matches `parseISODate` and `parsePeriodSelector`
  today: §VIII.2a selectors and §VIII.9 dates already admit years
  `0000`–`0099`.
- **The predicate reads validity only.** It calls `parseISODate` and nothing
  else in `day-count.ts`. It does no day counting or other date arithmetic.
- **The defect.** `actualDays()` in `packages/uwmd-core/src/calc/day-count.ts`
  counts days with `Date.UTC(year, month - 1, day)`. ECMAScript maps a numeric
  year from 0 to 99 to 1900–1999. So for dates in years `0000`–`0099`, the
  `actual/365f` and `actual/360` conventions of §VIII.9.1 do not literally
  follow the proleptic-Gregorian contract. That error carries through
  `yearfrac` into `xnpv`, `xirr`, and their verifiers in
  `cash-flow-series.ts` and `waterfall.ts`. `30/360us` uses date parts
  directly and is unaffected. Observed on `2df048c`:

  | From | To | `actualDays` today | Proleptic Gregorian |
  |---|---|---|---|
  | `0000-01-01` | `0001-01-01` | 365 | 366 |
  | `0000-02-28` | `0000-03-01` | 1 | 2 |
  | `0099-12-31` | `0100-01-01` | −693,959 | 1 |

- **Origin.** The defect arrived with the RFC 0034 day-count implementation.
  No conformance fixture uses a year below `0100`, which is why it has not
  been caught.
- **RFC 0071 neither changes nor legitimizes it.** The predicate's validity
  domain is not narrowed to avoid it, and the `0000` case stays in the case
  matrix. The §VIII.9.1 contract already says "proleptic Gregorian", so no
  normative decision is needed.
- **Repair.** Fix it separately, as an ordinary calc bug (wiki/11: "Fix a
  parser/validator/calc bug — No RFC"), against the existing §VIII.9.1 text.
  Add early-year unit and conformance cases at the same time. The fix is
  recorded in `docs/wiki/13-status.md` under Remaining work, and is not made
  in this PR.

## Alternatives considered

1. **Run module section JSON Schemas in core.** This would give `format: date`
   and every other check for free. It is rejected by layering: core takes no
   validator, and RFC 0006 note 3 refused a "half-implemented subset of JSON
   Schema". It is excluded by this task. It would also report schema failures
   under some new code, not under the module's own domain code.
2. **A general pattern builtin, `matches(value, regex)`.** It brings in a regex
   language and its dialect differences across hosts, and ReDoS risk from a
   third-party manifest. A leap-year regex is unreadable. A regex could
   replace condition 2 alone; conditions 1 and 3 would still need code.
   Rejected as a language expansion.
3. **Small string builtins** (`len`, `substr`, `to_number`) so that authors
   compose a date check. This needs four or more builtins for one use, and
   each needs its own null and type semantics. Every module would re-derive
   the leap-year rule, and two hand-written rules can disagree. Rejected.
4. **A date value type or `date(value)` constructor.** It widens
   `CalcResult.value` beyond `number | string | boolean | null`, which
   receipts pin. It invites date arithmetic and touches the Format. Rejected,
   and excluded by this task.
5. **A declarative manifest check** (`validations[].kind: 'calendar_date'`,
   `path: ...`), in the RFC 0005/0007 manner of shipping a declaration rather
   than a builtin. That precedent applies when a builtin would need non-scalar
   arguments, lazy evaluation or state. This predicate needs none of those: it
   is pure and scalar, and returns a type the result already admits.
   - A declaration changes the manifest schema and every manifest contract.
   - It works only in rules, so it is the second evaluation path §X forbids.
   - It cannot be combined with other conditions. RFC 0068's `== null ||`
     section guard and RFC 0068's conditional POH rules would be
     inexpressible with it.

   Rejected.
6. **A predicate in the module runtime only.** Forbidden by §X ("MUST NOT
   introduce an evaluation path a module can reach that the calc engine
   cannot"). Rejected.
7. **Null-propagating semantics** (`is_calendar_date(null)` → `null`). This
   would match the arithmetic builtins. But then a "required and valid" rule
   written as `is_calendar_date(x)` falls silent on an absent date, and the
   author must remember to add `x != null &&`. The predicate answers a type
   question, as `==` and `!=` do, and those already return booleans against
   `null`. Rejected.
8. **Raise `CALC-TYPE-001` on a non-string.** This reproduces the
   `MOD-RULE-ERROR` outcome this RFC exists to remove, for the exact input (a
   numeric date) a validity check should catch. Rejected.
9. **Lenient parsing** (trim whitespace, accept date-times by truncating, or
   accept `YYYY-M-D`). Each relaxation is a choice that two hosts could make
   differently, and each admits a value that the §VIII.2a and §VIII.9 dates
   refuse. One strict lexical form keeps one calendar protocol-wide. Rejected.
10. **The name `is_date`, `isdate` or `valid_date`.** "Date" alone suggests
    date-time acceptance, and VBA's `IsDate` is locale-dependent. The name
    `is_calendar_date` matches §VIII.1's `calendar_date` production. Rejected
    in favour of `is_calendar_date`.

## Unresolved questions

These are the recommended answers. Each follows repository precedent, and the
owner can overturn any of them in review.

| Question | Recommendation | Basis |
|---|---|---|
| Shared grammar or rules only | Shared §VIII.3 table | Protocol §X MUST NOT; RFC 0006 |
| `null` and absent | `false`, never `null` | A type question, as with `==` and `!=` |
| Non-string | `false`, no coercion, no error | The RFC's purpose; the array-coercion hazard |
| Year range | `0000`–`9999`, with `0000` a leap year | Same as `parseISODate`, §VIII.2a and §VIII.9.1. See [the drift note](#existing-implementation-drift-non-scope) for `actualDays` |
| Module compatibility | **MUST** set a `requires_protocol` floor | Owner revision, 2026-10-03; §VII.2 step 3 |
| Whitespace and date-times | Rejected, no trimming | One strict form protocol-wide |
| Wrong arity | `CALC-TYPE-001` | Existing builtin arity errors |
| Excel | Refuse emission (`EXCEL-EMIT-FN`) | Same as `avg` and `coalesce`; Excel's 1900 leap bug |
| Version | Protocol minor, core minor | Additive builtin; RFC 0070 precedent |

### Owner direction (2026-10-03)

The owner approved the draft's direction, subject to two revisions. Both are
now incorporated:

- the §X protocol floor is a MUST;
- the early-year `actualDays` drift is recorded as non-scope.

The owner also directed:

| Item | Direction | State |
|---|---|---|
| Acceptance | Accept once these corrections are in and CI is green | **Pending.** Status stays `draft` until the owner records acceptance |
| Implementation | Authorize separately, after acceptance | Not authorized |
| RFC 0068 | Adopt `is_calendar_date` in RFC 0068's own revision | Directed. RFC 0068 is not edited here |
| Numeric type predicate | No RFC at this time | Decided: none |
| Protocol and core numbers | A release-preparation decision; 2.22.0 and 2.18.0 are provisional only | Deferred to release |
| `actualDays` early-year drift | Repair separately against §VIII.9.1, with no RFC | Recorded in `13-status.md` |

## Draft verification record

Run on the built `2df048c` core while drafting, in a scratch harness that is
not committed. No repository code was changed.

- **Today's behaviour.** The "Observed behaviour" table above came from the
  real `evaluateCalc` and `validateAgainstModules`.
- **Case matrix.** The proposed semantics were simulated as
  `typeof v === 'string' && parseISODate(v) !== null`. They were checked
  against all 46 inputs in the case matrix, through both the `@uwmd/core` and
  `@uwmd/core/browser` builds, and every row matched.
- **Exhaustive sweep.** Every `YYYY-MM-DD` string with `y ∈ [0, 9999]`,
  `m ∈ [0, 13]` and `d ∈ [0, 32]` (4,620,000 strings) was checked against an
  independent month-length oracle. There were 0 mismatches and 3,652,425 valid
  dates.
- **Array coercion.** Without the `typeof` check, `parseISODate(['2026-10-03'])`
  returns a date, because the regex coerces its argument through `String()`.
  The type condition is therefore load-bearing, not defensive.
- **Early-year day counts.** The three `actualDays` results in the drift
  table were observed through the built `@uwmd/core` exports.

## Prior art

- **RFC 3339 §5.6 `full-date` and ISO 8601-1 calendar date, extended
  format.** The same `YYYY-MM-DD` lexical form, with the month-length and
  leap-year rules of RFC 3339 Appendix C. JSON Schema's `format: "date"`
  refers to RFC 3339.
- **RFC 0034.** It pinned dates to the proleptic Gregorian calendar and kept
  date arithmetic out of expressions; this RFC keeps it out. **RFC 0006** and
  **RFC 0039**: module rules use the shared sandbox, fire on `false` and stay
  silent on `null`. **RFC 0006 note 3**: core enforces no section schema.
