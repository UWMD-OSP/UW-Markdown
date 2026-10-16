# Financial numerical determinism — Issue #356

Date: 2026-10-15 (America/Phoenix). Contract inspected: main
`a18ed8ee7f502e2bd538c3c96be1584f94c458b9`, tree
`1473f7266602bc9e675b0cdb9ceab37aaaa17d1d`. Related #354/#355;
prior Phase1/2 evidence remains in its existing reviews. No private deal material
or StackUW implementation was retrieved. RFC0088 is a draft, not acceptance.

## Result

**Verified — normative numeric-contract gap, high priority.** The same compiled
reference implementation returns different finite/quantized values, an IRR
result/refusal, and a different quantized-results digest across supported Node
runtimes. Existing host exponentiation does not establish the advertised bit
identity. This is separate from financial metric definitions or generation of
underwriting models. No runtime-dependent normative answer is selected here.

The minimal admitted public calculation is `pow(1.2,31)` at `round_to:12`:

| Observation | Node18.0.0 /18.20.8 /20.0.0 /20.20.2 /22.23.3 | Node24.21.0 |
|---|---|---|
| Raw pow | 284.8515765597234 | 284.85157655972347 |
| Reported `evaluateCalc.value` | 284.851576559723 | 284.851576559724 |
| Existing `computeResultsDigest` | `sha256:61ccb1ceeb458dbd3bad9aa381effd8d6e826a2bf77b53435d76228267f084c4` | `sha256:5ea98e7cfada4cf05903ec3492ddcc733888d3c4f5f65242602d46fea80d55f2` |

The result shape is exactly
`[{calc_id:"power_boundary",computed:true,value:<quantized value>}]`.
This is the actual results-digest API, not a hand-rolled hash, display difference
or digest over forbidden unquantized outputs. No full receipt or signature was
issued, and no original receipt was modified. At the default6 places this
particular input agrees;12 is an explicitly admitted precision, not a new demand.

IRR over `[-1, ...19 zeroes, 6.727499949325601e20]` raises
`CALC-IRR-DIVERGE` under Node18/20/22 and returns10 under Node24. Another endpoint
control returns9.999999999679886 versus10, still agreeing at6 decimals but
disagreeing at12. The synthetic near-bracket cancellation NPV cases include
differences surviving money/default quantization. These severe stress inputs
demonstrate possibility, **not prevalence or materiality in an ordinary deal**.
The adopter's original private example and signed envelope remain unverified.

## Contract and surface inventory

- Protocol VIII.3 and implemented RFC0024: exact IRR bracket, endpoint handling,
  bisection/order/stopping and refusal; exponentiation is not pinned.
- Protocol VIII.5/.5.1 and RFC0023/0079: unrounded binary64 evaluation, one
  half-away quantization, source-token comparison precision, no extra tolerance.
- Protocol VIII.9.1–9.4 and RFC0034: exact day count, ordered dated terms using
  amount times negative power, pinned XIRR, scope/quantization/refusal semantics.
- Protocol II.2 and RFC0078/0083: verification obligations and independent
  implementation boundary. No comprehensive model producer is required.
- Receipt3.2 and5.1/5.3: quantized-results digest, recomputation, precedence and
  engine-identity compatibility. No receipt schema change is assumed.
- `packages/uwmd-verify/src/calc/builtins.ts`, `calc/quantize.ts`,
  `cash-flow-series.ts`, `receipts.ts`: observed reference surfaces. The broad
  builtin table's PMT/PV/FV names do not pin all domains or arithmetic association.

## Deterministic experiment and independent evidence

Adjacent files `2026-10-15-numerical-356.repro.py` and `.probe.mjs` generate
4,310 synthetic cases and invoke the existing compiled reference functions.
The Python math oracle independently expresses the specification's formulas and
bisection; it does not import TS, copy result tables or call Node to perform its
own arithmetic. The orchestrator invokes Node only to collect the *other*
implementation's observations. Python host pow is a comparison implementation,
not the proposed normative solution. `.observations.json` archives runtime/V8
identities, per-surface aggregate counts, the first example for each disagreement
class (including its exact input, binary64 hex and three quantization boundaries),
and the public result/digest case. It does **not** archive the complete 4,310-case
input/output stream. The script regenerates that stream, and uses Python native
`pow` to construct some stress inputs before passing identical inputs to each
Node runtime within that invocation. Regeneration on another Python/libm
combination therefore does not establish identical test input bytes. Before any
of these cases become normative known-answer vectors, freeze their exact input
bytes, record a cryptographic input digest and generation environment, and
establish expected answers independently under the accepted numerical contract.
This investigation does not freeze or approve new expectations.

Reproduce after building the selected source tree:

```sh
python3 docs/reviews/2026-10-15-numerical-356.repro.py \
  /absolute/built/repository /path/to/node20 /path/to/node22 /path/to/node24
python3 -m unittest discover -s implementations/python -v
```

The recorded experiment used Python3.12.3 on Linux/x64 and six locally cached
Node executables (versions in the table above). No network/package installation
was needed for the arithmetic experiment. Its source checkout for compiled code
was `eac353046f082f67f9660a38991f6122a6a99f9b` (approved #349 head), whose
complete tree exactly equals main's tree above. A fresh build of the review
branch is also run as a gate; its production/normative sources are unchanged.

For each Node18/20/22-to-Node24 comparison, the current vector set shows:

| Surface | Raw-only disagreements | Quantized disagreement cases | Outcome disagreement cases |
|---|---:|---:|---:|
| pow | 6 | 2 | 0 |
| NPV | 0 | 71 | 0 |
| IRR | 0 | 2 | 4 |
| PMT | 0 | 1 | 0 |
| PV | 0 | 2 | 0 |
| FV, NPER, log, exp, XNPV, XIRR | 0 | 0 | 0 |

“Quantized” means a difference at **any** of2,6,12 decimal places; it does not
mean every difference survives default money or rate precision. The PMT example
uses2.5 periods, one of the domains whose normative admission needs clarification.
Agreement on the sample does not establish portable transcendental behavior.
Integer-only product controls agree for finite cases across the tested runtimes
and Python; their range failures are reported separately.

Finite Python3.12 experimental values agree with Node24 on this sample. Remaining
Python/raw-JS refusal/nonfinite diagnostics are **not conformance failures or
new implementation defects**: the incomplete Python oracle does not implement
all builtin domains/error serialization, and the raw API may expose nonfinite
values that the public evaluator refuses. Counts must not be presented as a
complete Python Verifier pass. No macOS/Windows/ARM or alternate libm was tested locally. The added three-OS
Python CI job covers the small non-transcendental seed only; it does not claim
a complete verifier or cross-runtime pow/returns identity.

## Candidate product, negative powers and stability

The candidate is tested separately; it is not used by production calculations.
Sequential multiplication in a fixed order is reproducible when its basic
operations/range are fully defined, but changes current results. The Python
current-versus-candidate report shows changes in NPV, IRR, PMT, PV and FV;
some IRR endpoint results become refusals. This is not expectation regeneration.

`(1e155)^(-2)` demonstrates the negative-power problem: forming the positive
product overflows, then its reciprocal is0 rather than representable1e-310.
Multiplying the reciprocal first or scaling the exponent is another operation
graph requiring its own contract. A100-digit Decimal control over the exact
binary64 base also shows a repeated-product accumulation error for
`1.00000001^10000` about2.46 native ULP versus0.46 for native pow on this platform.
Those approximate error measures are diagnostics, not correctly-rounded proofs
or evidence that one procedure is universally better.

The public-boundary extension in the probe evaluates `pow(b,-2)*b*b`, with b
represented as the decimal integer1 followed by155 zeroes (the safe grammar
does not admit scientific numeric literals). Current evaluation reports1 at6
places; the experimental reciprocal-of-positive-product gives0. Losing the
subnormal intermediate can therefore survive final quantization. Public probes
use a parsed existing synthetic fixture and the actual `CalcEvaluationContext`;
the literal expressions do not read or change its financial assumptions.

Separate decisions are needed for fractional/negative periods, log/exp, NPER,
subnormals, overflow, resource bounds, cancellation near zero rate and fractional
date exponents. Do not replace XNPV's multiplication by division or change IRR's
fixed value tolerance/bracket to force agreement. No new monthly growth procedure
is required by the narrower #355 work.

## Independent Python work and #355 assurance boundary

`implementations/python/uwmd_numeric.py` is an unpublished independent seed with
known-answer tests: calc-domain quantization, strict dates, day counts, ordered
cash totals and MOIC. It has no Node imports, manifest or conformance claim.
It is **not a Reader/Verifier**. Reader parsing/token preservation, validation,
roles/periods, ordinary safe arithmetic, applicable dictionary/ledger checks and
receipt canonicalization can progress before #356 is resolved. Affected
transcendental, annuity and return checks remain experimental; no advertised
cross-runtime identity or complete calc-evaluate capability is justified yet.

#355 now prioritizes explicit assurance levels: bound headline returns; optional
declared closing/operating/terminal coverage; individually justified named
financial identities. “Every pro forma row” is not an approved universal
obligation. A proposed coverage report must first define assertion identity,
applicability, inventory/denominator, duplicates/dependencies and mutually
exclusive financially verified/stated-only/failed/unverifiable categories.
Missing required coverage and unsupported claimed checks cannot disappear into
stated-only or a vacuous success. No report or new validation is implemented.

## Bounded follow-up: Python seed year-zero calendar correction

**Verified — implementation defect in the unpublished Python seed only.**
Protocol VIII.3 explicitly admits years `0000` through `9999`, makes year zero a
Gregorian leap year, and requires a character/integer predicate without a host
date parser. VIII.9.1 uses the same calendar. Before correction,
`calendar_date("0000-02-29")` returned `False`, and
`year_fraction("0000-02-28", "0000-03-01", "actual/365f")` raised
`ValueError("invalid calendar date")`. The original seed test also incorrectly
required rejection of `0000-01-01`. This is independent of unresolved powers in
#356 and does not identify a defect in published npm packages.

The seed now checks date characters and Gregorian month lengths with integers,
and computes exact ordinal-day differences over the admitted year range before
the final division. No host date parser is used by production code. The pinned
`30/360us` adjustments remain unchanged. Added controls cover leap year zero,
century and 400-year boundaries, year `9999`, malformed dates, reversed intervals,
unknown conventions and the absence of February special-casing in `30/360us`.
A separate test oracle uses Python's calendar only after shifting both endpoints
by 400 years, preserving the Gregorian cycle while avoiding its year-zero limit.

`python3 -m unittest discover -s implementations/python -v` passed **9 test
methods** on Python3.12.3/Linux x64 after this correction; `git diff --check`
also passed. The integrator independently reran those nine methods and checked
840,000 deterministic calendar/day-count comparisons across all admitted years
against a test-only standard-library calendar oracle (year-zero dates shifted
by 400 years). All passed. This supplements the earlier six-method record
below; it does not establish untested financial procedures. It is not a full Reader/Verifier or cross-runtime numerical identity
claim. No normative text, conformance expectation, quantizer, power procedure,
release version or historical receipt changed.

## Compatibility, priority and remaining decisions

**High-priority foundational correctness investigation.** The result/digest case
can disagree under the same package engine identity solely because the runtime
changed. Existing RCP-07 needs *different engine identities plus disagreement*;
it does not automatically protect this same-identity case. A later accepted
numeric change needs a verifier version/dependent pins and measured receipt
migration, preserving source/signatures and all existing receipt precedence.
Do not retroactively rewrite historical receipts or add runtime identity fields
without approval. Current signing authenticates what was signed, not economic
correctness or universal reproducibility.

No new release is prepared. Before the next interim4.x change that claims to
resolve this issue, approve the numeric contract and compatibility treatment;
do not ship the experiment as a patch to normative powers. Before a coordinated
launch advertises independent financial reproducibility, complete the accepted
kernel/profile and multi-platform/independent evidence. This does not require a
comprehensive forecast engine, every asset class/program or all optional profiles.

Remaining owner decisions: exact numerical guarantee; bounded integer/negative
and fractional/log procedures with domains/range errors; dependency/footprint
tradeoffs; compatibility activation and historical receipts; minimum independent
platform/spreadsheet evidence. RFC0085 provenance and RFC0086/0087 reconciliation
remain separate drafts. Issue343 stays open. No formula, schema, conformance
expectation, public validation result or release version changes here.

## Decision proposal follow-up (no new arithmetic experiment)

RFC0088 §6 now presents concrete owner options D1–D8 and recommends a single
exact result/refusal contract, range-safe correctly-rounded `pow`/`log`/`exp`
primitives, separately pinned existing financial operation graphs, and existing
receipt wire/signature subjects with a new engine version after approved numeric
changes. This is a recommendation, not evidence that a portable kernel has been
selected or demonstrated. Sequential integer products remain an explicit
alternative; their range, stability and resource limits cannot be inherited
silently by negative or fractional powers. No kernel, domain restriction, solver
change or expectation has been adopted.

The draft separates owner direction from RFC acceptance and implementation.
Acceptance still needs a complete primitive special-case/domain/error/resource
contract, feasible kernel strategy, annuity domains, frozen independently derived
vectors, corpus impact and historical receipt compatibility. It explicitly pins
candidate NPV/IRR, PMT/PV/FV/NPER and XNPV/XIRR associations for review without
implementing them. Near-zero-rate cancellation and any stabilized alternatives
remain distinct from correcting the exponentiation dependency. Existing basic
operation order, period/date semantics, quantizer and solver brackets are not
changed by this documentation.

No completed 4,310-vector experiment was repeated or regenerated for this
follow-up. The original local full-suite and subprocess failures below remain
failed. The already completed remote checks cover their exact recorded heads;
they do not constitute approval or execution evidence for these new candidate
procedures. Independent Python Reader/Verifier development and narrow #355
assurance remain separate workstreams; neither requires a model generator.

## Verification record

Local environment: Node24.21.0, npm11.19.0, Python3.12.3, Linux/x64.
Dependencies were reused from the existing installation; workspace `@uwmd/*`
links were created for this checkout. No dependencies/lockfiles changed, so no
`npm ci` was required. The user checkout and other workstreams were untouched.
Git network fetch failed DNS; current-main SHA/tree were independently read from
GitHub API and matched the local worktree base.

| Exact command | Actual local result |
|---|---|
| `npm run build` | PASS, all workspaces |
| `npm --prefix packages/uwmd-verify test -- src/calc/calc.test.ts src/calc/quantize.test.ts src/calc/day-count.test.ts src/cash-flow-series.test.ts` | PASS242/242 in4 files |
| `python3 -m unittest discover -s implementations/python -v` | PASS6 test methods, including subcase controls |
| Numeric reproduction command above with6 cached Node paths | Completed4,310 vectors per runtime; observed disagreements are the investigation result, not a passing conformance claim |
| `npm test` | **FAIL:3999 passed /180 failed**, subprocess/empty-output/EPERM symptoms; retain failure |
| `npm run typecheck:tests` | PASS |
| `npm run validate-schemas` | PASS |
| `npm run conformance` | **FAIL** in the Node test-runner wrapper |
| `node --test --test-isolation=none scripts/conformance-targets.test.mjs` | **FAIL:11 passed /1 failed**; CLI subprocess returned empty JSON |
| `node scripts/run-conformance.mjs --json` | PASS1089/1089 reference checks; no expectations updated |
| `npm run lint` | PASS,0 errors;1 existing unused-variable warning |
| `npm run verify-indexes` | PASS |
| `npm run verify-codes` | PASS |
| `npm run docs:build` | PASS,28.09s initially /16.50s final; EBNF/chunk-size warnings |

`npm run conformance:profiles` **FAILED**: its8 Python driver unit tests passed,
but the Node guard could not spawn Python (`spawnSync python3 EPERM`).
[GitHub CI run 38842852557](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/38842852557)
completed successfully for exact PR #357 head
`b87909878d0f9fd55e212366a8dced7cf05c08ad`: 17 ordinary jobs passed; the optional
explicit-request publication-verification job was skipped. This remote evidence
does not relabel any local failure above as passed. The three OS Python jobs
exercise the numeric seed, not the complete cross-runtime arithmetic experiment.
The Python driver testing the TS reference is not a second Python implementation.
The arithmetic experiment is observational evidence, not the conformance suite.
No independent Microsoft Excel recalculation or signed receipt test was run here.
