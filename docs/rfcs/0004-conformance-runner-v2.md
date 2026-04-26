---
rfc: 0004
title: Conformance test runner v2 (language-agnostic)
status: draft
author: jaredmaxey
created: 2026-04-26
affects:
  - conformance-corpus
  - tooling
---

# RFC 0004: Conformance test runner v2 (language-agnostic)

## Summary

The current conformance runner ([`scripts/run-conformance.mjs`](../../scripts/run-conformance.mjs))
is TypeScript-only — it `import`s `@uwmd/core` directly. A non-TypeScript
implementation (Python, Go, Rust, Swift) cannot self-certify against the
corpus without writing its own runner from scratch and trusting that the
runner's interpretation of the corpus matches ours.

This RFC proposes splitting the runner into:
1. A **language-agnostic test driver** that shells out to a conforming
   implementation's CLI via a small, normative protocol.
2. A **standardized reporter format** (TAP14 + a JSON manifest) so any
   implementation's results can be aggregated.
3. The current TypeScript runner becomes the reference driver, talking
   to `@uwmd/core` via the same CLI protocol any other implementation would.

## Motivation

The conformance corpus is the single biggest piece of leverage UW Markdown
has for staying coherent as adopters arrive. A Python implementation that
"passes the conformance tests" but ran them via its own ad-hoc runner is
no longer guaranteed to have produced the same verdicts the TypeScript
implementation produces — the runner *is* part of the conformance contract.

Concrete problems with the v1 runner:

- **Hard-coded TS imports.** A Python implementer reads
  [`scripts/run-conformance.mjs`](../../scripts/run-conformance.mjs) and
  has to translate the test logic. Two translations are guaranteed to drift.
- **No machine-readable output.** The runner prints to stdout. CI consumes
  the exit code only; aggregating across implementations requires parsing
  free text.
- **No way to identify which implementation ran the suite.** The runner has
  no concept of "implementation under test"; it always tests `@uwmd/core`.

Without a v2 runner, every non-TS adopter ends up writing their own
runner — and the corpus stops being a shared artifact.

## Proposed change

### Language-agnostic CLI protocol

A conforming implementation **MUST** expose a CLI binary that supports the
following subcommands. Each one reads from stdin or a file path and writes
canonical JSON to stdout. The runner shells out to this binary; the binary
need not be in TypeScript or even on Node.

```
<binary> parse <file>
  → JSON: ParsedUWFile (per uwmd-block.schema.json)

<binary> render <file> --view chat|summary
  → JSON: { format: 'text'|'markdown', body: string }

<binary> validate <file>
  → JSON: ValidationResult (per protocol-error.schema.json)

<binary> edit <file> <operation.json>
  → JSON: { ok: boolean, content?: string, error?: ProtocolError }

<binary> calc <file> <calc.json>
  → JSON: CalcResult (per calc-result.schema.json)

<binary> manifest
  → JSON: ImplementationManifest (per implementation-manifest.schema.json)
```

stdout **MUST** be exactly one JSON document, optionally followed by a
trailing newline. stderr is reserved for diagnostic logging and is ignored
by the runner. Exit code: `0` for success, `1` for protocol error
(stdout still parseable), `2` for unrecoverable internal error.

### Test driver

A new directory `conformance/runner/` ships:

- `runner.py` — the canonical driver, ~400 lines, Python 3.10+, no
  third-party dependencies.
- `runner.go` — equivalent in Go, for environments without Python.
- `cases/` — declarative case files (YAML), one per fixture, listing the
  inputs and the expected outputs.

Sample case file:

```yaml
# conformance/runner/cases/tier-3-revpar-basic.yaml
tier: 3
fixture_dir: conformance/tier-3-calc-host/fixtures/revpar-basic
inputs:
  file: deal.uw.md
  calc: calc.json
command: calc
expected:
  output: expected-result.json
  diff: canonical-json
```

`canonical-json` diff means: parse both, sort keys, compare values — so
implementations that emit slightly different whitespace are still
considered equivalent.

### Reporter format

Output is **TAP14** with a JSON manifest at the end. TAP is human-readable
and supported by every CI system. The JSON manifest carries the structured
verdict for aggregation:

```
TAP version 14
1..42
ok 1 - tier-1 parser/parkview-basic # parsed in 12ms
ok 2 - tier-1 renderer/parkview-chat
not ok 3 - tier-3 calc/dscr-from-section
  ---
  expected: { value: 1.45 }
  got:      { value: 1.46 }
  ---
...
{
  "implementation": "@uwmd/core@1.0.0",
  "ran_at": "2026-04-26T15:00:00Z",
  "tiers": [1,2,3],
  "summary": { "total": 42, "passed": 41, "failed": 1, "skipped": 0 }
}
```

### Migration

The current `scripts/run-conformance.mjs` becomes a thin wrapper that
invokes `runner.py` with `@uwmd/core`'s CLI binary as the implementation
under test. CI continues to run the same `npm run conformance` script;
the only behavior change is that it now also prints TAP and emits the
manifest as a CI artifact.

## Compatibility analysis

- **Existing fixtures** — no change. The case files reference the same fixture directories.
- **`@uwmd/core`'s CLI** — already exposes `parse`, `validate`, `render`, `edit`, `calc`. Needs a `manifest` subcommand and the canonical-JSON output guarantee. Both are additive.
- **Existing CI** — continues to gate on tiers 1-3 passing. The new TAP output is additional, not a replacement.
- **Existing in-tree runner consumers** (only `scripts/run-conformance.mjs` is one) — replaced by the wrapper. No downstream consumers exist.

No deprecation path required for the corpus itself. The TS runner becomes
deprecated within one minor release — `npm run conformance` continues to
work; under the hood it shells out to the new driver.

## Conformance impact

This RFC is *about* the conformance corpus, not extending it. No new
fixtures. The change is to how the existing fixtures are executed.

Existing fixtures need:
- An expected stdout-shape matching the new CLI protocol's output. Today's expected files (`expected-result.json`, `expected-after.uw.md`, etc.) are already in this shape — they're already what the CLI returns. Minor cleanup: ensure all expected files are JSON Canonical Form.
- Each fixture dir gains a `case.yaml` with the metadata above. This can be auto-generated for tier-1 and tier-3 fixtures from the existing directory structure.

## Reference implementation

- **Files affected:**
  - `conformance/runner/runner.py` (new)
  - `conformance/runner/runner.go` (new)
  - `conformance/runner/cases/*.yaml` (new, one per fixture)
  - `conformance/runner/README.md` (new)
  - `scripts/run-conformance.mjs` — thin wrapper, replaces current logic
  - `packages/uwmd-core/src/cli.ts` — add `manifest` subcommand, canonical-JSON output for all subcommands
  - `.github/workflows/ci.yml` — upload TAP output as an artifact
- **API surface:** the CLI protocol above. No new TS exports.
- **Test plan:** the runner runs against `@uwmd/core` and produces the same pass/fail verdicts the v1 runner does, byte-for-byte on the manifest. CI passes.

## Alternatives considered

1. **Embed a runtime in every implementation.** E.g., a WASM module that runs the corpus inside any host. Rejected — pushes implementation complexity onto every adopter and turns a 400-line Python script into a complex build artifact.

2. **HTTP-based test harness.** Implementations expose a local HTTP server; runner sends test inputs as POST bodies. Rejected — needs every implementation to ship a server, which is a much bigger ask than a CLI. The CLI/stdin/stdout boundary is the lowest common denominator.

3. **Keep the TS-only runner; document the test logic so others can re-implement it.** The current state. Rejected — guaranteed to drift, see Motivation.

4. **Use an existing test framework (e.g., Cucumber, RSpec).** Rejected — adds a heavy dependency and a syntax adopters now need to learn. The case YAML is small enough that ~100 lines of Python parses and runs it.

5. **TAP-only, no JSON manifest.** Considered. The manifest is necessary because TAP doesn't have a standard way to attach implementation-version metadata, and we need that for the conformance dashboard (a future tool).

## Unresolved questions

- **Test isolation.** The runner shells out per test case. For 42 fixtures, that's 42 process spawns — fast enough on a modern machine but slow on CI. Recommend: provide an optional batch endpoint (`<binary> batch < input.json`) that takes an array of test inputs and returns an array of outputs. Implementations can opt in.
- **Live tier-4 tests.** Tier-4 fixtures invoke the agent host, which talks to an LLM. The runner needs an `--allow-live` flag and an environment-variable contract for the API key.
- **Floating-point tolerance.** Tier-3 calc fixtures sometimes produce results that differ by 1 ULP across implementations. The case-file format should support `tolerance: { abs: 1e-9, rel: 1e-9 }`. Recommend: add it now to the schema; default tolerance is exact equality.
- **Reporter pluggability.** TAP14 is the canonical reporter. Should the driver support JUnit XML output (for Jenkins integration) and GitHub Actions annotations? Recommend yes — both are thin transformations of the JSON manifest. Lands as a follow-up.

## Prior art

- **WPT (Web Platform Tests)** — the W3C's conformance corpus for browsers. Multiple implementations (Chrome, Firefox, Safari) run the same suite; the runner is in JS but the *protocol* is HTTP, so any implementation can respond. WPT proves the cross-implementation model works at scale.
- **TAP** ([testanything.org](https://testanything.org)) — well-defined, decades-old, supported by every CI vendor. Format used here.
- **JSON Canonical Form** ([RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)) — what we use for output equality comparison.
- **CommonMark dingus** ([commonmark.org/dingus](https://spec.commonmark.org/dingus/)) — same idea but for a single test driver. We're going one step further.
- **OpenAPI Test Tools (Schemathesis)** — generates conformance tests from a spec; relevant model for tier-1 schema-validation fixtures.
