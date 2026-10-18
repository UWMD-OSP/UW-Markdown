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
exact result/refusal contract, a measured comparison of pinned range-safe
`pow`/`log`/`exp` procedures against correctly-rounded primitives, separately
pinned existing financial operation graphs, and existing
receipt wire/signature subjects with a new engine version after approved numeric
changes. This is a recommendation, not evidence that a portable kernel has been
selected or demonstrated. Sequential integer products remain an explicit
alternative; their range, stability and resource limits cannot be inherited
silently by negative or fractional powers. No kernel, domain restriction, solver
change or expectation has been adopted. Official StrictMath/fdlibm and MPFR
sources establish feasible strategy precedents, not tested UWMD cross-language
identity. A correctly-rounded guarantee is stronger than exact algorithm
reproduction and is not imposed as an unexamined prerequisite; the next bounded
engineering study must measure accuracy, range, resource and deployment costs.

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

## 2026-10-16 — bounded exact-reference procedure lab

The [isolated lab](../../experiments/numerical-0088/power-procedures/README.md)
adds executable, unaccepted integer/fractional dispatch and three exact integer
operation-graph alternatives. Forty fixed input-word pairs, independent exact
rational midpoint answers/certificates and 120 graph result/trace records are
frozen separately. Python rational arithmetic derives the evidence without
floating pow/libm or an arbitrary decimal precision; independently authored JS
executes basic binary64 operations and checks the frozen outputs and trace hashes.
Six focused Python methods and two JS tests passed on Python3.12.3 /
Node24.14.1, Windows AMD64. Full-suite gates were not run for this chunk.

This advances procedure/domain/resource evidence beyond the completed runtime
reproduction and source audit, neither of which was repeated. Sequential and
squaring results differ on a fixed127-period primitive input; reciprocal-first
and reciprocal-last differ in rounding and range. The rational root reference
is deliberately bounded to exponent numerator magnitude256 and dyadic denominator
at most16; no general fractional/log/exp kernel is supplied. The lab's integer
budget256 and local status names are not UWMD admission/refusal rules. Primitive
nearest/even ties do not substitute for final VIII.5 half-away quantization.

The README pins exact input/evidence/source hashes, candidate special-case order,
operation order, resource limits and explicit downstream NPV/IRR/quantization/
receipt obligations. No normative or production file, frozen conformance value,
receipt/signature artifact, public version, RFC acceptance or release preparation
changes. No experimental recovery payload or new dependency is introduced.

## 2026-10-16 — composed cash and reporting boundary controls

The [cash-graph lab](../../experiments/numerical-0088/cash-graphs/README.md)
adds ten fixed synthetic cash vectors and ten reporting controls, independently
frozen from exact rational arithmetic. Three experimental power alternatives
feed ordered periodic NPV and the accepted IRR bracket/endpoint checks only.
No bisection is performed: a bracket needing it reports `bisection_required`,
without a guessed root or result digest. Dated prederived exponents retain
amount-times-negative-power; a half-year remains `fractional_kernel_required`.

A fixed positive/negative money-boundary pair reports 1.00/1.01 and -1.00/-1.01
under different graphs, using the existing VIII.5 decimal-string shift rather
than rounding the exact binary fraction. Separate frozen result-array preimages
and digests demonstrate consequences after reporting; no receipt is issued.
Exact upper-endpoint controls independently expose endpoint 10 versus no bracket
or an unexecuted bisection. Ordered source cancellation and true rounded
subnormal versus intermediate refusal remain separate controls.

The new Python reference uses no float, Decimal, repr, libm, Node or production
imports. The independent JS runner checks every financial intermediate trace,
reporting preimage and digest against frozen rational evidence. Five new focused
Python methods and two JS tests pass on Python 3.12.3/Node 24.14.1 Windows AMD64.
Only those new tests ran; prior audit/lab/full suites were not repeated. The
README records exact input/source/evidence hashes and proposes supported-runtime/
OS coverage for integrator CI without claiming it already ran.

Candidate dispatch/refusal policy and numerical results remain unaccepted.
Accepted bracket, endpoint order, stopping/tolerances, final quantizer, source/
block/signature subjects, receipt precedence, engine/version labels and frozen
conformance are unchanged. RCP-07 still requires different-engine disagreement;
same-engine runtime disagreement is not excused. No fallback evaluator, automatic
historical rehash, RFC 0085 policy, new dependency or release preparation is added.

## 2026-10-16 — actual procedure comparison and full-word integer alternative

The [new bounded comparison](../../experiments/numerical-0088/integer-dispatch/README.md)
now specifies three actual end-to-end designs, rather than only reproducibility
requirements: A, the pinned eight-file fdlibm procedure across exponent classes;
B, an MPFR4.2.2/GMP6.3.0 exact binary64 word/subnormal adapter; and C, an explicit
full-word integer reciprocal-first binary graph with A's fractional/log/exp path.
The RFC recommends **developing A**, conditionally on complete independent ports,
accuracy and contract evidence. The smallest owner choice is procedure-specific
exact answers versus B's stronger primitive correct-rounding contract. This is
proposal direction, not numerical adoption or RFC acceptance.

C now executes every finite integral binary64 exponent in at most 1024 iterations
and 1077 basic operations, including initial negative-power reciprocal. It has no
old 256 lab cap or safe-integer narrowing. Twenty-four frozen word controls retain
huge odd/even signs, signed underflow, unused-square overflow, fractional-kernel
absence and the independently proved graph-versus-correct-rounding difference.
No C speed or bundle saving is measured; the remaining A kernel is still needed,
so a shorter integer graph alone does not justify a distinct numerical contract.

B pins official archive/content hashes and exact input loading, range, operation
ternary/subnormalize and word encoding. Six focused Python methods include an
exact rational subnormal double-rounding counterexample to the 53-bit/get_d
shortcut. The MPFR/GMP sources were read inertly; no library was built, installed
or executed, and no complete source-closure audit or universal work bound is
claimed. A's original e_pow hash was rechecked, without repeating the completed
eight-file audit. Exact bytes, primary-source URLs, license and signature-check
limits are in the new sources manifest and README.

Freeze check, six new Python methods and 24 direct JS classification/result/trace
controls pass on Python 3.12.3/Node 24.14.1, Windows 11 AMD64. Only new focused tests
ran; preceding labs/audit/full workspace checks were not repeated and every prior
experiment blob is unchanged. The integrator owns pending targeted runtime/OS
coverage; it cannot certify unimplemented A/B or C fractional kernels.

The comparison keeps accepted financial associations, solver/tolerances, VIII.5,
receipt precedence, source/signature subjects and pre-release clean-break policy
explicit. It introduces no production import, new runtime dependency, normative
expected answer, corpus rebaseline, compatibility layer, version or release work.
The 5.0 launch timing and RFC0085 provenance remain owner-controlled and separate.


## Astra review intake and independent verification

External review: “Review RFC 0088 reproducibility”, reviewed PR #357 head
`e33a2a6dcc5b0c87107f51c4615083acc33e1942`. Retrieved read-only from the existing
review chat on 2026-10-16 (America/Phoenix). Its complete final text has UTF-8
SHA-256 `decd80e44c4efc0b95e202f8b277fb9147487ff71dbd87d561b30eb153df2134`.
It is external evidence, not owner approval or automatically verified authority.
The owner provisionally prefers A for further research; B remains an alternative
for a correctly rounded primitive objective; C has not justified its added graph.
No RFC status, financial convention, expectation, receipt rule, version or release
state changes in this follow-up.

Current code/specification/corpus reconciliation is main
`3eee0fbab3f5682dc345804782994dc22d321fae` (#372 merged, exact-main CI
38989037136 successful). The review's old runtime/source evidence is historical
where explicitly labeled. The earlier complete six-row research artifacts were
already independently checked; they are not re-run as a new historical audit.

### Independent classification

| Astra finding | Classification | Fresh evidence and exact limit |
|---|---|---|
| Recomputing an original success can return failed/RCP-03 before engine attribution | **Verified** | The unchanged public receipt API returns immediately when computeReceiptResults throws. Fourteen synthetic receipt controls distinguish finite disagreement, forced refusal, subject/held-input corruption, absent references, signatures and late results_digest. The forced pack swap is control-flow evidence, not itself an A-induced transition. |
| This precedes signature checks | **Partially verified** | A supplied backend is not executed on refusal, even if it would reject. Missing-backend RCP-08 is checked earlier. Receipt §5.1 invalid-signature precedence and §5.3 engine-disagreement language need joint reconciliation with the exception path. Behavior is preserved. |
| A new engine version plus existing RCP-07 covers every value/refusal change | **Contradicted** | Finite successful disagreement reaches RCP-07; recomputation exception reaches failed/RCP-03 first. Subject/input checks are early, while results_digest corruption is checked only after successful agreement. |
| irr(0,0) returns -0.999 | **Verified** | Both endpoint NPVs equal zero; lower endpoint is returned before bisection. This is the current procedure, not evidence of a unique economic root. |
| irr(1e-200,1e-200) returns 4.5005 | **Verified** | Endpoint NPVs are positive, but their product underflows to positive zero. The bracket test is bypassed and the absolute 1e-9 value tolerance accepts the first midpoint. No solver repair or flow normalization is authorized. |
| The exceptional NPV can return finite zero while public pow refuses | **Verified, with API qualification** | The denominator overflows to Infinity, division yields zero and the financial result is finite. A source-bound rate reaches evaluateCalc; scientific notation is not an admitted expression literal. Raw Infinity, primitive guard and final quantization are separate layers. |
| Final rounding cannot repair unspecified upstream arithmetic | **Verified** | Existing frozen money/rate/12-decimal controls remain unchanged. Primitive nearest/even and the current decimal-string half-away quantizer are different procedures. No tolerance, source-precision or double-rounding change is made. |
| Complete A/B execution had not been demonstrated by old green research CI | **Verified historically; current A evidence is bounded** | The earlier matrix tested the implemented integer/cash labs. This follow-up adds a complete isolated A raw closure and separate native/platform measurements. It does not execute B, prove universal accuracy, implement a full independent Python kernel or demonstrate spreadsheet parity. |
| A is nearly rounded rather than universally correctly rounded | **Verified bounded counterexamples** | Exact-rational certificates establish 178 mathematical answers independently. A agrees on 173 words and retains five one-ULP discrepancies, including exp(1) and selected powers. This disproves a universal correct-rounding claim, not establishes a global one-ULP bound. |
| Dictionary-only scope is insufficient | **Verified inventory; partially verified impact** | All production roots below are inventoried. The full indexed measurement passes 1,089 baseline/candidate assertions with unchanged protected bytes, but explicit capture/unexercised-site gaps prevent complete compatibility claims. |
| Evidence was partly deferred until after acceptance | **Verified and corrected in the draft** | RFC §7 now requires isolated independent implementations, financial/receipt impact and domain/resource evidence before owner acceptance; production integration and release remain separate gates. |
| Selecting public refusal policy, solver stability repairs, receipt precedence and activation | **Needs owner decision** | No current behavior is silently changed. The evidence identifies concrete alternatives and consequences; A preference is research direction only. |

The [fresh current-behavior harness](https://github.com/UWMD-OSP/UW-Markdown/blob/6260e9fefd48f96b4b22a9e9396cfc34d43b609f/experiments/numerical-0088/astra-review/reproduce.mjs)
and adjacent observations freeze two IRR branch traces, nine exceptional-value
controls, fourteen receipt precedence controls and signed-payload identity
consequences. They invoke freshly built, unchanged production APIs. The signature
backend is a stub for call-order observation, never authentication evidence. A
new engine marker changes the receipt signing payload even when subject and
results digests agree; original artifacts remain untouched.

### Production numerical consumer inventory

| Owning code / functions | Numerical dependency and assurance boundary |
|---|---|
| verify/calc/builtins.ts: pmt, npv, pow, log, exp, fv, pv, nper, irr | Periodic amount/divisor powers, annuity closed forms, log quotient and existing bracket/bisection. Public type/null/domain/result guards remain distinct from raw IEEE helpers. |
| verify/cash-flow-series.ts: xnpvOf, xirrOf and their public verifiers | Ordered amount times negative power; exact day-count construction and final division into a binary64 exponent; base Verifier obligations. Integral-looking year fractions do not permit changing multiplication to division. |
| verify/capital-stack.ts: trancheAnnualDebtService, verifyCapitalStack | Amortization power and derived ADS/structural assertions. Do not replace a prescribed closed form with a schedule solver. |
| verify/waterfall.ts: hurdleBalance, computeWaterfall, verifyWaterfall | Discount/forward hurdle powers, compounded preference balances, party XIRR and clawback consequences. Base Verifier obligations, not merely optional authoring. |
| verify/calc/prng.ts and stochastic.ts | Normal-tail logarithm, sqrt-based triangular/normal sampling, evaluator per draw and sample-standard-deviation sqrt. Preserve PCG64 and existing VIII.8.3 normal-tail tolerance. |
| verify/calc/sensitivity.ts, module rules/calculations, metric verification and receipts | Inherit evaluator behavior, selections, public results/refusals and quantization. Dynamic module formulas require complete coverage; the current 171 builtin definitions alone do not exercise all consumers. |
| core/debt.ts: pmt, deriveDebt | Separate starter amortization and monthly-first rounding. It is not normative generation required of a verifier, but remains a reference-tool compatibility obligation. |
| verify/calc/quantize.ts, stated-precision and dated/capital-stack checks | Existing decimal-string shift, unit/round_to defaults, source-token precision, signed-zero handling and final-only comparison. |
| verify/waterfall.ts: roundTo; validator recovery checks | Separate existing scaled power/Math.round rules. Inventory and measure them; do not silently fold a quantizer correction into primitive pinning. |
| core derived/dcf/rentroll/sourcesuses and UI/report formatting | Additional starter rounding and display conventions; distinguish arithmetic/reporting from presentation. Excel emits formulas and needs actual scoped recalculation evidence. |

The static inventory includes all package numerical sites, with BigInt-only
powers excluded from floating replacement. The isolated measurement replaces
only floating powers and Math.log/Math.exp in memory; sqrt and all original
financial operation associations, branches, tolerances and quantizer algorithms
remain unchanged. All loaded dist and protected source/spec/fixture hashes are
retained. No source, build product or corpus expectation is edited.

### Exact candidate impact and receipt compatibility evidence

The [indexed impact artifact](https://github.com/UWMD-OSP/UW-Markdown/blob/6260e9fefd48f96b4b22a9e9396cfc34d43b609f/experiments/numerical-0088/impact/README.md)
contains all 1,089 exact case keys/owners, input and expectation identities,
per-case observation/status differences, declared coverage gaps and full frozen
compressed streams. Both modes pass 1,089 assertions with zero failures/updates.
The 14,145 primitive observations align by site and exact inputs; 671 raw words
change (periodic IRR 1, dated IRR 668, dated NPV 2). No captured reported-number or
state/refusal change is observed. Six retained source-string differences are
strictly timestamps from starter editing, not numeric procedure changes.

These results do not prove all outputs unchanged: 108 cases have no visible
actual binding, other captures can omit unasserted values, and only 10 of 20
eligible floating numerical sites are exercised. Sixteen receipt cases capture
receipt fields with unchanged observed subject/results digests and results; two
refusal cases issue no receipt. No signature-validity claim follows from that.
Targeted financial/receipt probes separately address previously unexercised
builtins and the original stress counterexamples; they are not new normative
fixtures or a corpus rebaseline.

The [complete raw candidate](https://github.com/UWMD-OSP/UW-Markdown/blob/6260e9fefd48f96b4b22a9e9396cfc34d43b609f/experiments/numerical-0088/pinned-fdlibm/README.md)
retains all eight exact source files/notices, rationally derived constant words,
explicit per-site word semantics, all seven executable bodies, wrapper/domain
separation and a conservative 76-loop-body scalar bound. The
[native corroboration](https://github.com/UWMD-OSP/UW-Markdown/blob/6260e9fefd48f96b4b22a9e9396cfc34d43b609f/experiments/numerical-0088/native-reference/README.md)
uses 4,204 frozen operands, strict compiler/environment checks and explicit
historical-C adapters. Compiler agreement is not a mathematical accuracy oracle.
The existing research workflow retains exact Node/OS/architecture/compiler,
input/source hashes and complete outputs. Read exact final run/artifact evidence
on #357 before claiming completed native/cross-runtime execution.

### Remaining pre-acceptance gates

- Independently review every constant, word site, raw special case, wrapper and
  structural resource bound; complete full independent implementation coverage
  and justify the chosen accuracy objective beyond a finite sample.
- Extend complete financial trajectories and actual-value/refusal captures to
  unexercised consumers, dynamic modules and unasserted outputs. Do not turn a
  green assertion or absent delta into universal compatibility evidence.
- Resolve success-to-refusal attribution and authentication/error precedence,
  source/module consequences, receipt wire/identity needs and clean-break
  activation. Retain old bytes, subjects and signatures; separately authorize
  any new issuance rather than rehashing history.
- Preserve current IRR weaknesses unless a separate financial decision changes
  sign tests, scaling, branches, bracket, tolerances or stopping. Settle exact
  public domains/refusal timing without blanket internal finite guards.
- Obtain browser and actual spreadsheet recalculation evidence for every
  advertised scope. Existing Stochastic tolerance remains unchanged.
- Owner acceptance of the complete evidenced revision, then separately controlled
  production integration/activation and independent version/release decisions.
  No schema/corpus change, release preparation or 5.0 allocation is authorized.


### Genuine candidate receipt transitions beyond the indexed corpus

The [targeted frozen study](https://github.com/UWMD-OSP/UW-Markdown/blob/dcf8eab50d7f0fd6829b02cf1f3138c0089a7fd7/experiments/numerical-0088/impact/README.md#focused-financial-and-historical-receipt-study)
executes 48 public financial controls, five starter debt cases and 24 historical
receipt checks. All ten numeric sites unexercised by the indexed corpus are now
reached across these two complementary studies. Complete branch/domain and
actual-value coverage is still not claimed.

The finite power case changes reported twelve-decimal output from
284.851576559724 to 284.851576559723; default six-place output agrees. Original
endpoint IRR changes from 10 to CALC-IRR-DIVERGE. Candidate issuance refuses
RCP_COMPUTATION_FAILED. Reverification of its unchanged original receipt returns
failed/RCP-03 for either engine marker and never invokes supplied accepting or
rejecting signature stubs. Missing backend yields RCP-08 earlier. The finite power
disagreement reaches RCP-07 for different engines with an accepting stub, while
an invoked rejecting stub yields RCP-01. Full source, old/new receipt fields,
subjects/results digests, signing payloads and call evidence are frozen.

The first targeted receipt attempt correctly refused a fixture with no UWX fence;
its failed streams remain explicitly separate. The corrected valid-source study,
not that attempt, supplies the 24 historical receipt controls. No cryptographic
validity claim is inferred from stubs, and no historical artifact is changed.


### Frozen native corroboration and exact execution identity

Research run38993665625 and ordinaryCI38993665613 completed successfully for
published0c2f01cd. The research job actually checked out PR test merge
a6d05240e80325019a87bac6a5426a6b61fccc8d (main3eee plus0c2f), not the head
commit itself; source hashes match the reviewed head. Nine original artifact
ZIPs and a read-only verifier now preserve the complete observations under
`experiments/numerical-0088/native-reference/evidence/run-38993665625/`.
Independent integrator verification confirms4204 inputs in each of3native
and6Node streams:3435 exact non-NaN words and769 NaN-class comparisons. GCC13.3,
Clang18.1.3 withUBSan and AppleClang21 onarm64 reproduce all five independently
certified one-ULP mathematical discrepancies. This corroborates procedure results
under those builds; it proves neither universal correct rounding nor a global
error bound. Archive digests match the GitHub artifact API. Original missing
native provenance fields remain explicitly missing. A provenance-only collector
follow-up records checkout/tree, Node/V8, binary/source hashes and exact commands
for future runs, while the workflow now explicitly checks out the reviewed head.
No historical observation or expected answer was regenerated. The final updated
head requires its own CI; the green historical runs do not certify later edits.

### Approved integration identity and immutable replay

After #373 merged, ordinary CI run 39000455194 failed the historical
receipt-source hash comparison; all behavioral observations still agreed. The
original 8,149-byte observations file remains frozen at SHA-256
`60ea71d476eb290ba40af0fe59d4a3fc640ade24b8c5e9b84cf22f9ed79d21a5`.
The isolated replay now pins the complete historical and approved-current
six-file identity maps separately in `integration-identities.json`, then compares
every remaining behavioral field exactly. Only the reviewed receipt-source
identity differs, following #373; no result, refusal, backend-call count,
conformance expectation or financial procedure was regenerated. Unrecorded
source changes, byte tampering, behavioral changes and the former write option
are refused. Six focused guard controls run beside the existing replay in CI.

The earlier nine-platform kernel run remains evidence for its recorded source
commit. Its executable candidate/input/collector/workflow closure is unchanged;
new replay accounting is tested by ordinary CI and does not create a new claim
of cross-platform kernel execution.

### Independent Python raw-kernel evidence

The isolated `python-fdlibm` lab adds a separately structured adaptation of the
pinned C and explicit Python word/IEEE-operation semantics. Its original local
observation remains frozen with actual commit/tree and source/input hashes.
All4204 inputs agree with three archived C streams; the178 mathematical checks
retain exactly the five known one-ULP discrepancies. Eleven boundary/resource/
refusal controls pass locally. Constant words are common evidence, not an
independent constant derivation. This closes a raw implementation gap, not a
complete Python financial evaluator, solver/quantizer/receipt proof or RFC
acceptance. Ordinary CI adds conditional tests and separately labeled evidence
in the existing three Python jobs, pinned to the actual reviewed head; no extra
platform jobs or production activation. Original numerical evidence stays intact.

### Complete bounded financial trajectories (unaccepted)

The [composed trajectory study](https://github.com/UWMD-OSP/UW-Markdown/blob/d8e16f7dc34c0b92729f55d32a8ec8b0aa050f80/experiments/numerical-0088/financial-trajectories/README.md)
connects the independent Python raw kernel to current periodic NPV/IRR,
actual/365f XNPV/XIRR and PMT procedures. Nineteen fixed word-input cases retain
4,730 complete candidate operation/evaluation/bracket/iteration/update/exit
rows. Separate JS graphs agree with Python under an explicitly separate
NaN-class comparison projection; original NaN bits remain in the raw archives.
Actual unmodified production agrees with the host graphs and baseline loader;
actual isolated power injection agrees with the candidate graphs. Every finite
reported result and eight boundary controls agree with the production decimal-
string quantizer through an independent rational reporting reference.

The original capture pins checkout5c034dd0/tree80d24a81, CPython3.12.3 Windows
AMD64 and Node24.14.1/V8 13.6.233.17-node.44. Twenty-one compressed artifacts
preserve all raw traces, distinct comparison projection, actual API outputs,
loader events/transforms and command logs. The sole final result/refusal change
in these controls is the known endpoint10 to CALC-IRR-DIVERGE transition;
its exact21flow words link to the preserved actual receipt RCP-03/RCP-07/backend
controls. Those receipt executions are reused evidence, not newly performed
cryptographic authentication or a new precedence rule.

Ordinary Node20 CI reuses its build/Python runtime for focused controls, immutable
archive/source verification and a separate complete observation archive. Record
actual run/head/runtime/artifact identities before calling that execution green.
The earlier raw-kernel three-platform results are independent evidence; neither
they nor this original one-host capture supplies three-platform financial proof.
Remaining gates include other financial graphs/day counts, whole-domain accuracy,
complete stated-figure/receipt integration and advertised spreadsheet parity.
No iteration-cap exhaustion was observed. Owner acceptance of the complete
procedure/accuracy/refusal contract and separate production activation remain
required; no arithmetic, schema, fixture, receipt, package version or launch state
changes in this study.

### Composed receipt and real-signature closure (unaccepted)

The [isolated composed-receipt study](https://github.com/UWMD-OSP/UW-Markdown/blob/3e968cdf/experiments/numerical-0088/composed-receipts/README.md)
adds actual issuance and verification under the pinned numerical candidate after
accepted main `afcc615897aca301c7b5ec070bba7c0bd253e4ef` / RFC 0090. It reuses
one frozen independent Python multi-period IRR result without rerunning the
4730-row study. Newly issued unmodified, baseline-loader and candidate receipts
agree exactly; the reported word is `3fb6c64e16bf6113`. The same existing engine
name and explicitly synthetic experiment versions exercise finite agreement and
engine-metadata distinctions without allocating a production identity.

The original capture records checkout `f29258a2` / tree `b8a2bda3`, Windows
AMD64, CPython 3.12.3, Node 24.14.1 / V8 13.6.233.17-node.44 and OpenSSL 3.5.5.
Thirteen compressed raw artifacts retain 19 actual candidate controls, complete
receipts/signing payloads, backend calls, 1886 candidate primitive events and
85 loader transformations, plus separate unmodified/baseline observations.
The 105 source/reference and 86 compiled-JS identities are unchanged before and
after execution. Every edited or re-signed receipt is a new synthetic artifact
using a deliberately public disposable Ed25519 test key; none authenticates a
historical original or establishes issuer trust.

Separate post-capture verification binds all 19 receipt objects to their exact
accepted `canonicalize({...receipt, signature: null})` signing payloads and their
source bytes, independently of the observed `receiptSigningPayload` call. It
checks 18 real signature outcomes (14 valid, four invalid; one other control is
unsigned), and three in-memory detached-payload negatives. A finite synthetic
wrong-value control with a newly valid signature preserves same-engine RCP-03
versus other-version RCP-07/RCP-03; a retained invalid signature gives RCP-01.
This is an explicit result-tampering control, not a newly observed natural
host/candidate finite disagreement.

The exact old endpoint source/receipt is reused solely as input to newly signed
clones. Candidate recomputation refusal produces RCP-03 before backend invocation
for both byte-valid and invalid signatures; no original signature is claimed.
Earlier unavailable-backend, subject, reference and pack exits retain their
accepted behavior. The experiment preserves existing precedence, including this
refusal-before-backend behavior; it proposes no authentication workaround.

The [separate integration accounting](https://github.com/UWMD-OSP/UW-Markdown/blob/3e968cdf/experiments/numerical-0088/integration/README.md)
keeps the original Astra identity file and historical trajectory manifest/raw
artifacts byte-exact. A successor Astra map pins accepted-afcc Protocol/index
identities, with all numerical/receipt implementation hashes unchanged; the
actual API replay still matches every frozen behavioral field. A separate
trajectory verifier admits only the exact historical-to-afcc Protocol identity
transition and requires every other source/helper/input/reference to match. No
old capture is relabeled as an afcc execution or rebaselined. This one-host
closure does not supply full cross-platform financial/receipt proof, universal
accuracy, all graph/day-count/stated-figure coverage, issuer trust or RFC
acceptance. Owner procedure/accuracy/refusal choices and production activation
remain open under the major-5 launch policy.

### Composed accuracy and cancellation checkpoint (unaccepted)

The [bounded cancellation study](https://github.com/UWMD-OSP/UW-Markdown/blob/b2c16fcf/experiments/numerical-0088/cancellation-accuracy/README.md)
adds36 new exact scalar PMT/PV/FV controls, including both neighbors/ties of the
binary64 `1+rate` collapse boundary, signed zero and integer periods1/360. It
preserves exact-rational real-formula certificates, the ordered graph with an
ideal correctly rounded power, independently executed pinned JS/Python graphs,
and actual builtin/evaluator/decimal-string-quantizer outcomes. The ideal-power
graph is a mathematical counterfactual of the already-rounded base, **not** an
executed MPFR adapter, new financial graph or primitive-B implementation claim.

In this bounded domain, A and the ideal-power graph agree on all36 raw words;
30 differ from whole-real-formula RN-even. After the existing12-place VIII.5
procedure,21 finite values differ and five nonfinite raw results are refused
while the exact-real reference remains finite. At rate word `3ca0000000000000`
(+2^-53), one-period PMT refuses, while PV/FV report0 instead of reference1;
the latter have exact relative real error1. The next positive rate word gives
reported PMT0.5/PV2 instead of reference1. Both input-base rounding and later
cancellation are material: correctly rounding only the power primitive cannot
restore a discarded rate or imply whole-formula accuracy.

Two additional natural WindowsNode24.14.1 host/candidate changes occur at
negative rate word `bc90000000000001`, one period: host PMT raw-infinity/refusal
becomes candidate reporting0.25, and host PV reporting0 becomes candidate4;
the exact-real references report1. These are local measured financial
reporting/refusal differences, not the historical IRR endpoint or newly executed
receipt differences. Original receipts and all old4204/178/4730 evidence remain
unchanged. Any receipt consequences still require their own actual API evidence.

Capture4573db25/tree2d4019c5 records WindowsAMD64, CPython3.12.3 and
Node24.14.1/V8 13.6.233.17-node.44. Sixteen compressed artifacts preserve591583
raw bytes and200 complete ordered rows per candidate graph implementation;
103 source/reference and86 compiled-JS identities remain unchanged. The rational
oracle is bounded to listed word inputs, exact unit/zero scalar amounts, integer
periods1/360 and12-place reporting; midpoint search is at most63 iterations.
Its38,169-bit maximum exact certificate is a research resource observation,
not a proposed production domain/work limit or a universal accuracy proof.

**D1/D5 recommendation:** keep A as the lean provisional procedure direction,
but do not equate primitive accuracy with an end-to-end financial accuracy
promise. Before accepting that promise, choose whether known large composed
errors/refusals are acceptable under an explicitly limited exact-procedure
contract, or require a separately stated financial accuracy objective plus
evidenced graph/domain changes. Choosing B alone cannot resolve these examples.
No zero-rate cutoff, stable formula, tolerance or new refusal rule is selected.
Existing financial graph/solver conventions remain unchanged in this draft.

Published9c0322a7 ordinaryCI39061421563 has17 successful jobs and one skipped
publication observation: production Node20/22 and WindowsNode20 gates, three
Python foundation/raw-kernel jobs and the named repository/tooling guards.
LinuxNode20 also executed the previous19-control actual receipt matrix and
immutable historical trajectory checks. These are scoped regressions; this new
36-case study was absent from that head. Green17 does not establish exhaustive
primitive accuracy, all financial graphs/day counts, a global composed error
bound, spreadsheet recalculation or owner acceptance. Optional research
39061421580 was cancelled, never passed. Frozen historical cross-platform
artifacts retain their original source/runtime scopes.


## Current owner-rule continuation (2026-10-17)

The owner removes all prelaunch compatibility, migration, artifact-retention and
version-recommendation work. Earlier such obligations are superseded; no old
receipt/artifact replay is a required acceptance gate. Current read-only source
integrity, deterministic numerical correctness and launch authentication/refusal
precedence remain necessary. RFC0088 staysdraft;A staysprovisional.

The existingNPER14 evidence is reused without reexecution. The new
[all-three-day-count study](https://github.com/UWMD-OSP/UW-Markdown/blob/1a52efd965a6acebbcac2f82108e2a2b618aafca/experiments/numerical-0088/dated-conventions/README.md)
adds48 cases/21,969 complete rows, actual production year-fraction and XNPV/XIRR
boundaries, independently derived calendars, full solver exits and VIII.5 reports.
All three accepted conventions and early/maximal four-digit years are covered.
One natural finite reporting difference is observed locally; no receipt proof is
claimed for it. See its manifest for exact committed head/source/runtime scope.

The decision packet is now theRFC's current table: (1) financial accuracy/domain/
refusal objective beyond primitive determinism, (2) current launch signature-
authentication versus recomputation-refusal precedence, and (3) completing claimed
consumer/platform/spreadsheet evidence before acceptance. No compatibility regime,
package recommendation or old-artifact retention choice remains.
