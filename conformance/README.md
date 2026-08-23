# Conformance corpus

This directory contains the fixtures and expected outputs that any conforming
implementation of UW Markdown self-certifies against. It is the canonical
test corpus — analogous to the
[CommonMark spec corpus](https://spec.commonmark.org/dingus/) or
[OpenAPI's compliance suite](https://github.com/OAI/OpenAPI-Specification/tree/main/tests).

The corpus is organized by **conformance tier** (see
[`UW_PROTOCOL_v1.md`](../spec/UW_PROTOCOL_v1.md) Part II for tier definitions):

```
conformance/
├── tier-1-reader/      Parse + display, read-only
│   ├── fixtures/       Well-formed .uw.md files an implementer parses
│   ├── malformed/      Files exercising validator / integrity / policy codes
│   │                     (CC-NN, FV-NN, DQ-NN, INT-NN, POL-NN, META_*)
│   │                     plus optional <id>.policies.json siblings for
│   │                     POL-* fixtures
│   └── expected/       Expected JSON parses + display strings + chat-format renders
├── tier-2-editor/      Round-trip writes, supersede semantics
│   └── fixtures/       <scenario>/{before.uw.md, operation.json, after.uw.md}
│                         Optional siblings: context.json (EditContext),
│                         options.json (ApplyEditOptions, e.g. {integrity: true,
│                         maintainGaps: true}), expected-error.json (negative
│                         path — assert applyEdit rejects with a specific code)
├── tier-3-calc-host/   Custom calculation evaluation
│   ├── fixtures/       <scenario>/{deal.uw.md, calc.json, expected-result.json}
│   └── refinement/     <scenario>/{deal.uw.md, expected-graph.json}
│                         Exercises extractDependencyGraph() against a fixture
├── tier-4-agent-host/  AI agent layers producing write_uw_section calls
│   ├── fixtures/       <scenario>/{before.uw.md, expected-after-shape.json}
│   └── profile/        <scenario>/{expected-layer-profiles.json}
│                         Asserts BANCROFT_LAYERS layer→consumed_profile contract
├── lite/               UW Lite representation + deal-summary-v1 bridge
│   ├── fixtures/       Well-formed .uw.md Lite documents that must parse
│   │                     cleanly AND compile; each freezes five artifacts in
│   │                     expected/ (see below)
│   ├── malformed/      Parse-time errors (LITE_*) with <id>.expected.json
│   │                     declaring expected_codes; optional "must_parse": false
│   │                     asserts parseUWLite throws instead
│   ├── compile/        Documents that parse cleanly but must FAIL the bridge
│   │                     (LITE_COMPILE_*), same <id>.expected.json shape
│   ├── equivalence.json  Groups of fixtures that differ only along axes
│   │                     UW_LITE_SPEC_v1 §6 excludes; all must share one digest
│   └── expected/       Per fixture: <id>.canonical.json (RFC 8785 financial
│                         canonical form), <id>.digest.txt (sha256 over its exact
│                         UTF-8 bytes), <id>.rendered.uw.md (canonical rendering),
│                         <id>.compile.json + <id>.uwx.md (deal-summary-v1
│                         compilation), <id>.projection.json + <id>.projected.uw.md
│                         (UWX→Lite projection with its omission report)
├── receipts/           Verification receipts (RFC 0016, spec/UW_RECEIPT_v1.md)
│   ├── issue/          <scenario>/{deal.uw.md|deal.uwx.md, expected-receipt.json}
│   │                     Issuance is deterministic apart from issued_at, which
│   │                     the runner stubs
│   ├── verify/         <scenario>/{deal.*, receipt.json, expected-verdict.json}
│   │                     expected-verdict.json declares one of verified /
│   │                     failed / unverifiable plus expected_codes (RCP-NN)
│   └── refuse/         <scenario>/{deal.*, expected.json} — issuance must throw
│                         a typed ReceiptError with expected_code, never emit a
│                         caveated receipt
├── market-data/        Market data as an attributable UW document (RFC 0022)
│   ├── valid/          <scenario>/{doc.uwx.md, expected.json} — a market-data
│   │                     document parses to the expected identity/observations
│   ├── reject/         <scenario>/{doc.uwx.md, expected.json} — parse must
│   │                     refuse with the expected typed code (a market doc
│   │                     carrying a deal_id, duplicate field paths, …)
│   ├── resolve/        <scenario>/{case.json, deal.uwx.md, docs/, expected.json}
│   │                     — selectCurrentMarketData over several documents:
│   │                     most-recent as_of wins, ambiguity refuses, staleness
│   │                     is reported rather than silently served
│   └── promote/        <scenario>/{case.json, doc.uwx.md, expected.json} —
│                         promoteMarketObservation writes an observation into a
│                         deal with provenance and confidence preserved
├── modules/            Declarative module manifests (see modules/README.md)
│   ├── accept/         <id>.module.json — loadModuleManifest accepts the full
│   │                     declared surface (calcs, agent layers, round_to, …)
│   └── reject/         <id>.module.json + <id>.expected.json — malformed
│                         manifests refuse with the expected typed code
├── packages/           UW Deal Packages, RFC 0018 (see packages/README.md)
│   ├── accept/         <id>.manifest.json + <id>.expected.json — manifest
│   │                     validation accepts, including extension link types
│   └── reject/         <id>.manifest.json + <id>.expected.json — dangling
│                         links, duplicate member ids, … refuse with the
│                         expected code; archive/zip invariants are asserted by
│                         the runner without baselines
├── composition/        Composable UWX documents (RFC 0021). The suite exists
│   │                     to prove I-1: an externalized record and its inline
│   │                     twin share one canonical form and one digest
│   ├── resolve/        <scenario>/{record.uwx.md, parts/, inline.uwx.md,
│   │                     expected.json} — resolution matches the inline twin
│   │                     on canonical form + digest, never on source bytes
│   ├── unresolved/     A missing fragment leaves the section externalized —
│   │                     never a partial rent roll that still totals
│   ├── reject/         One fixture per COMP-* refusal (dup key, count
│   │                     mismatch, section mismatch, malformed part)
│   ├── composite/      <scenario>/{case.json, expected.json} — graph shape,
│   │                     depth bound, cycle detection, stale-vs-failed
│   ├── inherit/        <scenario>/{case.json, expected.json} — nearest
│   │                     ancestor wins; equidistant ancestors refuse
│   ├── rollup/         <scenario>/{case.json, expected.json} — verifyRollup's
│   │                     three-state verdict; a failed child short-circuits
│   │                     before any arithmetic runs
│   └── lite-projection/  The UWX→Lite projection names externalized sections
│                         in its omission report and matches the inline twin
└── capital-stack/      Typed capital stack (RFC 0026, format spec §4.24).
                          Scenario kind is dispatched by the files a directory
                          carries: {case.json, expected.json} exercises
                          verifyCapitalStack's three-state verdict (a "variants"
                          key contrasts pref cash-vs-accrued); {agree.uw.md,
                          mismatch.uw.md, expected.json} exercises the
                          generalized CC-03 in both directions; {deal.uw.md,
                          expected.json} asserts a typed validator refusal
                          (CS-WATERFALL-UNSUPPORTED); and {deal.uw.md,
                          expected-metrics.json} is the no-stack single-loan
                          regression pin — every pack metric must equal its
                          pre-RFC value exactly
```

The `lite`, `receipts`, `market-data`, `modules`, `packages`, `composition`,
and `capital-stack` suites are named rather than numbered: UW Lite is a
*source representation*, a receipt is a *detached artifact*, market data and
deal packages are *companion document kinds*, module manifests and composition
are *protocol machinery*, and the capital stack is a *verified section* — none
is itself a protocol conformance tier. All run by default; select one alone
with `--tier=<name>` (e.g. `--tier=lite`, `--tier=capital-stack`).

Two receipt properties are asserted as invariants rather than baselines:

- **Re-issuance stability (§4).** Re-issuing over an unmodified record must
  reproduce the same `subject.digest` and the same `results`.
- **Three-state verdicts (§5).** A verifier must land on exactly one of
  `verified` / `failed` / `unverifiable`, and must not collapse `unverifiable`
  into either of the others. `verify/04-unknown-pack` is the case
  implementations are most likely to get wrong.

Two Lite properties are asserted as invariants rather than baselines, so they
hold for any conforming implementation regardless of frozen output:

- **Rendering round-trip (§7).** Parsing a canonical rendering must reproduce
  the source document's financial canonical form.
- **Display equivalence (§6).** Labels, headings, prose, field order, bullet
  character, whitespace, comma grouping, and equivalent numeric spellings are
  excluded from the canonical form, so fixtures differing only along those axes
  must hash to one digest.

Digests are computed by the runner with stock `node:crypto` rather than the
library's own hash helper, so a frozen digest is meaningful evidence to a
third-party implementer rather than a restatement of our implementation.

## How to self-certify

1. Implement (or update) your tool against the published
   [`UW_PROTOCOL_v1.md`](../spec/UW_PROTOCOL_v1.md).
2. For each tier you claim, run every fixture in that tier through your tool.
3. Compare your output to the corresponding `expected/` output.

**Tiers 1–3 use byte-exact comparison** (after JSON canonicalization and
volatile-field stripping where applicable). **Tier 4 uses shape assertions** —
LLM nondeterminism makes byte equality impractical, so the expected output is
a JSON Schema fragment describing the shape of an acceptable agent response.

## Running the reference test runner

The reference implementation ships a runner at
[`scripts/run-conformance.mjs`](../scripts/run-conformance.mjs) that exercises
the corpus against `@uwmd/core`. CI runs tiers 1–3 on every PR.

```bash
# Default: tiers 1, 2, 3
node scripts/run-conformance.mjs

# Specific tiers
node scripts/run-conformance.mjs --tier=1,3

# Tier 4 is operator-driven (lint-only — does not invoke an LLM)
node scripts/run-conformance.mjs --tier=4

# Bootstrap / refresh expected outputs from the current library
node scripts/run-conformance.mjs --update

# Machine-readable output
node scripts/run-conformance.mjs --json
```

Volatile fields stripped before byte comparison: `last_modified`,
`_meta.timestamp`, `ts=` fence attributes, and `_meta.content_hash`
values (hashes canonicalize over the timestamp, so they vary per run
even when content is stable). These change every run and are not
normative.

## Adding a fixture

Fixtures are normative once merged. To add one:

1. Open a PR with the fixture file and its expected output.
2. Explain in the PR description what scenario the fixture covers and why it
   isn't already covered by existing fixtures.
3. Reviewers will run the fixture against `@uwmd/core` (the reference
   implementation) and against at least one third-party implementation to
   confirm the expected output is correct, not just what the reference happens
   to produce.

See [`../CONTRIBUTING.md`](../CONTRIBUTING.md) for the full contribution
process.

## Regenerating expected outputs

The `expected/` files are generated by running the reference CLI against the
fixtures. To regenerate after a non-breaking improvement:

```bash
node scripts/regen-conformance.mjs
```

If a regeneration changes any expected output, that's a normative change to
the protocol — call it out explicitly in the PR description and bump the
protocol version in `UW_PROTOCOL_v1.md`.
