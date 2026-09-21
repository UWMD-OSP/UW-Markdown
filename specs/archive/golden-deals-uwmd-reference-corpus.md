# Golden Deals UWMD reference corpus

Status: completed on 2026-09-21.

## Objective

Build a private, source-attributable UWX reference layer for the Golden Deals
repository and a deterministic harness that compares it with each fixture's
frozen Artifact B. The corpus is an adopter test bed, not public UWMD
conformance. A private failure may be reduced into a public synthetic
conformance fixture only after it demonstrates a product defect and all private
facts have been removed.

The implementation order is contract-first: prove the complete harness with
`CONTROL-00`, then author one deal at a time. Artifact A and Artifact B remain
independent oracles. No UWX record, receipt, or calc output may overwrite or
regenerate them.

## Repositories and ownership

- UWMD implementation: this repository.
- Private corpus: the owner-supplied Golden Deals repository.
- StackUW output remains exclusively under each deal's existing `03-uwmd/`
  directory and is never hand-edited.
- Hand-authored reference records use `03-reference-uwmd/` so they cannot be
  confused with StackUW Artifact C.

## Version contract

The harness case metadata pins the tested release, core, CLI, protocol, and
format versions. It reads release state from this repository's authoritative
`VERSIONS.md`, compares that state with the pin, and then compares the CLI
`manifest` response with both. It must not scrape a version from a normative
spec document and must not invent implementation-version fields inside UWX
records.

The current approved pin is release/core/CLI `2.12.0`, Protocol `2.17.0`, and
Format `2.0`.

## Corpus layout

Each implemented fixture receives:

```text
deals/<ID>/03-reference-uwmd/
  <fixture>.uwx.md
  calculations.json
  crosswalk.json
```

Refusal fixtures without Artifact A/B use an `expected-refusal.json` contract
instead of empty calculation and crosswalk files. That contract names the typed
refusal, required gaps, forbidden confident sections, and any built-in pack that
must not be substituted.

`crosswalk.json` contains exactly one row per Artifact B assertion. Every row
must contain:

- Artifact B assertion ID;
- disposition;
- exactly one UWMD path or calculation ID;
- expected value copied from Artifact B and mechanically checked against it;
- comparison rule and explicit tolerance;
- provenance classification.

The harness rejects duplicate, missing, extra, or stale rows. The final corpus
must account for all 532 currently frozen Artifact B assertions.

If a frozen Artifact B definition points to the wrong workbook cell, its row is
retained with disposition `baseline_defect`, no asserted UWMD path/calculation,
the unchanged Artifact B value, and a precise defect explanation. The harness
counts that row as covered but not asserted; it never bends the UWMD record to
match a mislabeled oracle and never mutates the frozen baselines.

## CONTROL-00 proof

CONTROL-00 proves the architecture before GD01 begins:

1. Verify the Artifact B source hash still names the frozen deterministic
   `control00.py` source.
2. Verify the implementation pin against `VERSIONS.md` and `uwmd manifest`.
3. Parse and validate the Format 2.0 UWX record.
4. Audit crosswalk schema and one-to-one coverage of all 28 Artifact B
   assertions.
5. Resolve source-backed path assertions from the parsed UWX record.
6. Evaluate all calculation assertions with the UWMD deterministic calc host.
7. Issue and verify a standard multifamily calc-pack receipt at a fixed
   timestamp. The receipt test proves record verification behavior; it is not
   the Artifact B oracle and does not attest that stated inputs are true.
8. Discover registered representations and, for each selected `model`-fidelity
   representation, require UWX -> representation -> UWX to preserve the
   financial canonical form / semantic digest according to that
   representation's contract. The CONTROL-00 set is UW JSON, UW XML, and the
   UW CSV bundle. Source or intentionally lossy view representations are not
   subject to this assertion.
9. Confirm the harness never modifies Artifact A, Artifact B, or the authored
   UWX fixture during a run.

## Deal map

- GD01: ordinary multifamily acquisition and debt; first live-deal proof after
  CONTROL-00.
- GD02: bridge financing and a Year-3 refinance. Represent the stated periods
  and financing evidence, but do not invent a generic sequential-refinance
  surface if the current format cannot carry the economics.
- GD03: retail/commercial leases, including the source-backed commencement
  judgment.
- GD04: remain blocked until the development pro forma exists.
- GD05: LIHTC/rent-restriction facts, phased conversion, and the three-year
  restriction tail. Unsupported legal/economic mechanics are explicit gaps,
  not inferred fields.
- GD06: use the protocol's existing separation of concerns:
  - `portfolio.uwx.md` as the composite parent;
  - `northlake.uwx.md`;
  - `oakview.uwx.md`;
  - `portfolio.uwportfolio.json` for RFC 0015 cross-document entity
    relationships;
  - an RFC 0018 package manifest where package/source-evidence behavior is
    tested;
  - an RFC 0021 rollup receipt for the 41.54% / 58.46% allocations and portfolio
    aggregation assertions.
  Composition, relationships, packaging, and rollup verification remain
  distinct artifacts.
- GD07: remain blocked until price, leases, and program are supplied.
- GD08: refusal fixture. Assert that no standard calc-pack verification receipt
  (and no financial receipt based on an inapplicable built-in pack) is issued.
  Do not claim that the protocol can issue no receipt of any kind.
- NEG01: parser/structural refusal only; never fill its missing inputs.

## RFC 0045 boundary

No real-deal fixture claims RFC 0045 property cash-flow assembly until its
frozen source provides a complete, gap-free monthly or quarterly lease-up
period set and explicit coverage of every supplemental cash-flow cell. Annual
Artifact A models are not inferred into that contract.

## Baseline and privacy invariants

- AI performs no financial math. All evaluated outputs come from the UWMD calc
  host or the frozen Artifact A/B pipeline.
- Raw source files and resident/person names never enter the reference records,
  crosswalks, test output, or public fixtures.
- Artifact A is immutable during a run. Artifact B values are read-only
  expectations and are never sourced from UWX.
- A failed or inapplicable financial pack cannot be converted into a confident
  result by filling gaps.
- Crosswalk tolerances are explicit per assertion; there is no hidden global
  epsilon.

## Protocol version drift

RFC 0061 corrected the stale `2.15.0` and `2.8.0` labels to the authoritative
Protocol `2.17.0` and extended `verify-versions` to keep both document labels in
lockstep with `VERSIONS.md` and `PROTOCOL_VERSION`.

## Completion

CONTROL-00 and every evidence-ready case pass. GD04 and GD07 are explicit
evidence-blocked outcomes: no development pro forma exists for GD04, and GD07
lacks frozen price, leases, and program. They are neither failed cases nor
silently skipped work. The suite reports both blockers on every full run.

## Definition of done

- CONTROL-00 passes every proof above from one command with no network access.
- Each ready deal has a Format 2.0 reference record (or the exact portfolio
  artifact set for GD06), calculations, and a mechanically complete crosswalk.
- All 532 Artifact B assertions are accounted for exactly once.
- Blocked and refusal fixtures remain blocked/refusing for the documented
  reason.
- UWMD build, test, conformance, schema, lint, lockfile, and package gates pass
  for every UWMD repository change.
