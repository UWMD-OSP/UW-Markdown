# Language-agnostic conformance driver (RFC 0004)

`runner.py` runs the UW Markdown corpus against **any** implementation that
speaks the CLI protocol in [protocol §II.6a](../../spec/UW_PROTOCOL.md).
It shells out; it knows nothing about TypeScript, Node, or `@uwmd/core`. The
reference implementation is tested exactly the way a Python, Go, or Rust one
would be — which is the point. A corpus that only its own author's language can
run is not a shared artifact.

```bash
# The reference implementation (also `npm run conformance:v2`; on a machine
# where the interpreter is only on PATH as `python3`, invoke it that way)
python conformance/runner/runner.py

# Somebody else's
python conformance/runner/runner.py --impl "./target/release/uwmd"
python conformance/runner/runner.py --impl "python -m uwmd" --tier verifier --profile module
```

Python 3.10+, standard library only. That constraint is deliberate: a driver
that needs a package index is a driver an air-gapped implementer cannot run.

## What it does not cover

**`npm run conformance` remains the full CI gate:** 1,249 reference checks.
This driver retains all 557 CLI projections, including Reader, Verifier,
Module and separately reported starter-product cases. A portable result
claims coverage of those cases, not the omitted cross-fixture contracts.

Select `--tier reader` or `--tier verifier` (includes Reader), `--profile
module,integrity,...`, or `--starter-products`. With no selector all cases
run and `by_target` separates standard and product outcomes. Any other
`--tier` value is a usage error (exit `2`). The closed target, tier and profile
vocabulary is read from `vocabulary.json`, which `gen-conformance-cases`
generates from `scripts/conformance-targets.mjs`.

Every case names the Format version it was written for (`format_version`,
RFC 0111 D6): the rule set it exercises (Protocol §XII.5). `--format-version
3.0[,...]` runs only the cases of those rule sets; with no selector every rule
set runs. A Verifier claiming a release passes the cases of every rule set it
keeps. All cases are `3.0` today, the one rule set. A case with no
`format_version` is refused (exit `2`), and each result row carries it.

A profile must be explicitly claimed in the implementation manifest. An
unclaimed profile yields `unverifiable`, never pass/fail. Capability skips
remain separate. `--no-skip` rejects a run containing either outcome;
`summary` and `by_target` retain their distinct counts.

Known gaps inside the tiers it does cover, listed rather than hidden:

- **`starter/editor/parent-hash-stamp` and `stale-parent-rejected`** need
  `applyEditAsync` and a volatile content hash, which the CLI's synchronous
  `edit` cannot express. Covered by the TypeScript runner only.
- **The layer-profile starter check** reads the layer registry directly; it has no CLI surface.
- **The named suites** (`lite`, `market-data`, `modules`, `packages`,
  `composition`, `size-intensive`, `signing`) are TypeScript-only today.
- **Verifier obligations (RFC 0115).** Every Verifier obligation has portable
  cases, one subcommand each. What stays in the TypeScript runner: the
  validator-code fixtures of `cash-flow`, `waterfall`, `capital-stack` and
  `lease-up` (they pin codes, not a verdict); the `cash-flow` declaration
  fixtures (dated metric calc declarations); `capital-stack`'s single-loan
  metric pins (a starter pack) and its cash-versus-accrued contrast (two
  stacks compared); the assembly baselines' `metrics` and
  `absent_validation_codes`; the example-level metric findings in
  `conformance/metrics/expected.json` and the metric controls; and the
  pack-based receipt checks and receipt issuance, which are starter checks
  (RFC 0115 D4). The RFC 0062 same-day selection rule is mirrored as
  calculation fixtures `period-09` to `period-12`, so this driver checks the
  rule itself.

## Output

TAP version 14 on stdout, plus an optional JSON manifest:

```
TAP version 14
1..44
# implementation: org.uwmd.core@1.7.0
ok 1 - reader__documents__01-minimal-screening__parse # 141ms
not ok 42 - module__calc__revpar-basic__calc # 157ms
  ---
  - value: 999.0 != 104.76
  ...
# 43/44 passed
```

```bash
python conformance/runner/runner.py --manifest-out report.json
```

The manifest carries the summary *and* the implementation's own
`ImplementationManifest`, read from its `manifest` subcommand. TAP has no
standard way to attach that, and without it two implementations' results cannot
be aggregated. An implementation with no `manifest` subcommand still runs; it is
reported as `unidentified` rather than assumed to be anything.

Exit code: `0` no failures, `1` a failure or an incomplete `--no-skip` run, `2` the driver could not
run (unknown case format, implementation not executable).

## Case files

`cases/*.case.json` are **generated** — `node scripts/gen-conformance-cases.mjs`,
or `npm run gen-conformance-cases`. A case file is a restatement of what is
already on disk (which fixture, which command, which baseline), and
the [case schema](../../spec/schemas/conformance-case.schema.json) checks its
closed owner vocabulary. The [corpus index](../corpus-index.json) records
one owner for each case; the generator refuses missing or duplicate identities.
Ids and filenames use `<owner>__<suite>__<scenario>__<operation>`. The `target` is the conformance claim; storage names describe content.

```json
{
  "id": "module__calc__revpar-basic__calc",
  "target": "module",
  "format_version": "3.0",
  "command": "calc",
  "args": ["deal.uwx.md", "calc.json", "--json"],
  "fixture_dir": "conformance/calc/fixtures/revpar-basic",
  "expect": { "kind": "json-subset", "file": "expected-result.json", "exit_code": 0 }
}
```

`args` entries that name a file inside `fixture_dir` are resolved to absolute
paths; everything else is passed through as a literal flag or value.

### `expect.kind`

| Kind | Compares |
|---|---|
| `json-subset` | Every key in the baseline must be present and equal in the response. The response may carry more. |
| `json-exact` | Canonical equality in both directions. |
| `text` | stdout against the baseline, newline-normalized. |
| `json-field-text` | One named `field` of the JSON response against a text baseline. |
| `exit-only` | Nothing but the exit code. |
| `verdict-codes` | RFC 0115. The projected response's `verdict` (or `refused_code`) equals the baseline's, and each code in the baseline's `expected_code` / `expected_codes` appears among the projected `codes`. Only the baseline fields named in `expect.fields` are read, from that closed list. |
| `statement-states` | RFC 0115. A `StatedMetricsReport` against an RFC 0099 statement-home case: each `expect` path is stated exactly once with that state, no `absent` path is stated, and `counts.failed` equals `failed` when given. |

**Why subset is the default.** The baselines are frozen *projections*.
`expected-result.json` for a calc names four fields; a conforming
implementation may also report `round_to` and `display`. Exact equality would
fail an implementation for being more informative. Lists are still compared
length-sensitively — an omitted issue is a real difference, not extra
information.

### `expect.baseline_field`

Some render baselines store the whole `RenderResult` envelope
(`{format, content}`) despite a `.txt` / `.md` extension. Naming the field beats
teaching the driver to sniff, and beats re-baselining every rendered fixture to
make the extension honest.

### `expect.fields`, `expect.ignore` and `expect.baseline_pointer`

The RFC 0115 verifier fixtures were written for the reference runner, so a
case says which parts of the baseline it compares rather than the driver
guessing:

- `fields` (with `verdict-codes`) names the baseline members read. A document
  fixture's `expected_codes` are validator codes, so its section-verifier case
  reads only `verdict`.
- `ignore` names top-level baseline members a reference-runner check owns,
  such as an assembly baseline's `metrics` (a calc declaration over the
  candidate) and `absent_validation_codes` (a validator check).
- `baseline_pointer` is an RFC 6901 pointer into a baseline file that holds
  several cases (`conformance/metrics/statement-homes/cases.json`).

### Derived documents

A section verifier and `verify-metrics` read a document, but some fixtures are
bare payloads (`case.json`: `{stack, context}`, `{waterfall, series}`,
`{schedule, context}`, `{series}`) or statement-home edits of an example. The
generator restates each as a document under `conformance/runner/derived/`, holding
exactly the payload the reference runner passes to the verifier: the context
as the sections the document-level context reads, and a waterfall's series at
the variant its `cash_flow_ref` names. `gen-conformance-cases --check` checks
these like the case files; never edit them by hand.

### `expect.project`

A named, closed vocabulary of projections the driver applies to the response
before comparing. Examples include:

- `issue-code-severity-set` — reduce a `ValidationResult` to
  `{overall_status, issues: [{code, severity}]}`, deduplicated and sorted.
  The document validation baselines are stored this way so that a reworded
  message is not a corpus edit.
- `section-verification` (RFC 0115) — reduce a section report to
  `{verdict, codes}`: the verification's verdict, or `not_applicable` when
  nothing was checked, and the sorted set of its issue codes.
- `receipt-verification` (RFC 0115) — reduce a `UWReceiptVerification` to
  `{verdict, codes}`, or a refusal to `{refused_code}`.
- `property-cash-flow-assembly` (RFC 0115) — reduce a
  `PropertyCashFlowAssembly` to `amounts`, `dates`, `cell_count`,
  `source_periods`, `source_paths`, `sale_deductions` and
  `net_sale_proceeds`, or its refusal to `error_code`, `reason`, `pointer` and
  the nested `lease_up_verdict`.

A projection must be *named in the case file*, never inferred. The moment the
driver starts guessing at baseline shapes, it has acquired the private
knowledge RFC 0004 exists to eliminate.

### Volatile values

`last_modified`, `_meta.provenance.timestamp`, fence `ts=`, and
`_meta.integrity.content_hash` are masked
before text comparison: an edit stamps them with the moment it ran, and a
baseline that pinned one would be asserting the clock. `parent_hash` is
deliberately *not* masked — it is stamped from the prior head's `content_hash`,
which the fixture fixes, so it is stable and worth checking.

## Implementing the protocol

See [protocol §II.6a](../../spec/UW_PROTOCOL.md) for the normative
definition. The short version: `manifest`, `parse`, `validate`, `render`,
`edit`, `calc`, and one `verify-*` subcommand per Verifier obligation
(RFC 0115: `verify-metrics`, `verify-cash-flows`,
`verify-property-cash-flows`, `verify-waterfall`, `verify-capital-stack`,
`verify-lease-up`, `verify-receipt`, `verify-reserve-accounts`,
`verify-reserve-draws`); exactly one JSON document on stdout (except
`render`, which emits text), stderr free for logging, exit `0` success / `1`
protocol error or failed verification with parseable stdout / `2`
unrecoverable. A `verify-*` subcommand exits `0` for an unverifiable or absent
subject, except the two reserve verifiers (§VIII.11, §VIII.12).

An implementation claims each `verify-*` capability flag it has built. A case
needing a flag it does not claim is skipped, not failed, and a Verifier tier
claim requires all nine (Protocol §II.5).

### Replacement-funding projection (RFC 0070, Protocol 2.21.0)

The generated hedge cases use `project: "replacement-funding"`.
The driver compares structural HDG/ESC codes and a separate verification
state/reason/code projection, plus the process exit code. It never merges async
HDG-09 into structural errors. Cases preserve exact authored source bytes.

RFC 0123 receipt cases may request recomputed_ids in verdict-codes. This is an
exact ordered list after projection sorting, with multiplicity retained; it
proves the actual dictionary subset was returned, alongside verdict/code checks.
