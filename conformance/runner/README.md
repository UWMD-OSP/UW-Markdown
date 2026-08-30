# Language-agnostic conformance driver (RFC 0004)

`runner.py` runs the UW Markdown corpus against **any** implementation that
speaks the CLI protocol in [protocol §II.6a](../../spec/UW_PROTOCOL_v1.md).
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
python conformance/runner/runner.py --impl "python -m uwmd" --tier 1,3
```

Python 3.10+, standard library only. That constraint is deliberate: a driver
that needs a package index is a driver an air-gapped implementer cannot run.

## What it does not cover

**`npm run conformance` remains the CI gate.** It runs 274 assertions across
thirteen suites, and most of them are not "run a command, compare the output":
receipt re-issuance stability, composition DAG resolution, ZIP packaging,
signature key stores, cross-fixture invariants asserted with no baseline at
all. Replacing it with this driver would trade breadth for portability, which
is a bad trade.

This driver runs the subset that *is* a CLI call — the tier fixtures, 44 cases
across tiers 1–3. That is enough to self-certify to a tier, which is what
RFC 0004 set out to make possible.

Known gaps inside the tiers it does cover, listed rather than hidden:

- **`tier-2-editor/parent-hash-stamp` and `stale-parent-rejected`** need
  `applyEditAsync` and a volatile content hash, which the CLI's synchronous
  `edit` cannot express. Covered by the TypeScript runner only.
- **Tier 4** is shape-only and replay-driven; it has no CLI surface.
- **The named suites** (`lite`, `receipts`, `market-data`, `modules`,
  `packages`, `composition`, `capital-stack`, `size-intensive`, `signing`) are
  TypeScript-only today.

## Output

TAP version 14 on stdout, plus an optional JSON manifest:

```
TAP version 14
1..44
# implementation: org.uwmd.core@1.7.0
ok 1 - tier-1/01-minimal-screening/parse # 141ms
not ok 42 - tier-3/revpar-basic # 157ms
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

Exit code: `0` all passed, `1` at least one failure, `2` the driver could not
run (unknown case format, implementation not executable).

## Case files

`cases/*.case.json` are **generated** — `node scripts/gen-conformance-cases.mjs`,
or `npm run gen-conformance-cases`. A case file is a restatement of what is
already on disk (which fixture, which command, which baseline), and
hand-maintaining fifty of those invites one to go stale silently.

```json
{
  "id": "tier-3/revpar-basic",
  "tier": "3",
  "command": "calc",
  "args": ["deal.uw.md", "calc.json", "--json"],
  "fixture_dir": "conformance/tier-3-calc-host/fixtures/revpar-basic",
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

### `expect.project`

A named, closed vocabulary of projections the driver applies to the response
before comparing. Today there is exactly one:

- `issue-code-severity-set` — reduce a `ValidationResult` to
  `{overall_status, issues: [{code, severity}]}`, deduplicated and sorted.
  The tier-1 validation baselines are stored this way so that a reworded
  message is not a corpus edit.

A projection must be *named in the case file*, never inferred. The moment the
driver starts guessing at baseline shapes, it has acquired the private
knowledge RFC 0004 exists to eliminate.

### Volatile values

`last_modified`, `_meta.timestamp`, fence `ts=`, and `content_hash` are masked
before text comparison: an edit stamps them with the moment it ran, and a
baseline that pinned one would be asserting the clock. `parent_hash` is
deliberately *not* masked — it is stamped from the prior head's `content_hash`,
which the fixture fixes, so it is stable and worth checking.

## Implementing the protocol

See [protocol §II.6a](../../spec/UW_PROTOCOL_v1.md) for the normative
definition. The short version: six subcommands, exactly one JSON document on
stdout (except `render`, which emits text), stderr free for logging, exit `0`
success / `1` protocol error with parseable stdout / `2` unrecoverable.
