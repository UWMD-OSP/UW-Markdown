# Task matrix: RFC 0071 implementation

| # | Task | State |
|---|---|---|
| 1 | Add `BUILTINS.is_calendar_date`: arity check, string check, `parseISODate` | done |
| 2 | Test the case matrix, document values, errors, time-zone and locale independence, and browser parity (`calc.test.ts`) | done |
| 3 | Run the exhaustive and arbitrary-input oracle without `parseISODate` or `Date` (`calc.property.test.ts`) | done |
| 4 | Test module rules: own code on a bad date, the optional pattern, `MOD-RULE-ERROR` for arity and argument errors, and the §X floor via `PROTO-MOD-030` | done |
| 5 | Test Excel refusal: `EXCEL-EMIT-FN` in core, and the `@uwmd/excel` custom export | done |
| 6 | Add the Protocol §VIII.3 row and paragraph, the §VIII.9 sentence, the §X floor, and the schema description note | done |
| 7 | Add tier-3 fixtures `date-01`–`date-48` and generate their v2 cases | done |
| 8 | Update the docs: wiki 04, the docs-site calc conventions, the tier-3 README, the RFC implementation notes, `13-status.md` and the CHANGELOG | done |
| 9 | Run the full gate set and open the PR | in review |

Not in scope: `actualDays()`, RFC 0068, a numeric predicate, release preparation
and version labels. RFC 0071 stays `accepted`.
