# Independent Python base Verifier

Issue [#354](https://github.com/UWMD-OSP/UW-Markdown/issues/354). This unpublished
implementation uses Python's standard library. Runtime code does not call Node,
read expected results, import TypeScript or use an external service. The numerical
primitives are the independently implemented accepted RFC0088 procedure; their
Sun notices and exact constant words remain in uwmd_fdlibm.py.

The discovery manifest claims the **Verifier tier** and the base capabilities
parse, validate, calc-evaluate and all nine verify-* obligation flags. Optional
profiles are empty. This includes no pro-forma support claim; #551/#552 remain
separate. It also claims no module, signature, stochastic, portfolio or complete
representation profile. A signature without a supplied backend remains
unverifiable/RCP-08. No PyPI publication, package name or Python floor is decided.
Local verification uses Python3.12.3; CI selects Python3.12 on Windows, Linux and
macOS and retains the runtime's setup output and conformance report.

## Run

Run from this checkout with its matching normative spec data:

```sh
python -B implementations/python/uwmd.py manifest
python -B implementations/python/uwmd.py calc synthetic.uwx.md calculations.json --json
python -B implementations/python/uwmd.py validate synthetic.uwx.md --json
python -B implementations/python/uwmd.py verify-metrics synthetic.uwx.md --json
python -B implementations/python/uwmd.py verify-cash-flows synthetic.uwx.md --variant base --json
python -B implementations/python/uwmd.py verify-capital-stack synthetic.uwx.md --json
python -B implementations/python/uwmd.py verify-lease-up synthetic.uwx.md --json
python -B implementations/python/uwmd.py verify-waterfall synthetic.uwx.md --json
python -B implementations/python/uwmd.py verify-property-cash-flows synthetic.uwx.md plan.json --json
python -B implementations/python/uwmd.py verify-receipt receipt.json synthetic.uwx.md --json
python -B implementations/python/uwmd.py verify-reserve-accounts synthetic.uwx.md --json
python -B implementations/python/uwmd.py verify-reserve-draws synthetic.uwx.md plan.json --json
```

Each command emits the accepted JSON result and exit contract. The two reserve
commands fail on failed or unverifiable results; the other verify commands exit1
on failed outcomes/refusals and0 on reported unverifiable/not_applicable outcomes.
There is no source write. Standalone replacement-funding, source-role/currency
inspection and bounded block-hash inspection remain available as described in
their modules; they do not add optional-profile claims.

For a full base-record check, import async `uwmd_verifier.verify_source` with
this directory on the Python import path. It snapshots source/explicit external
plans, applies complete validation and provenance policy first, checks every
current base subject and accepts explicitly supplied receipts/input digests.
Its result is a local convenience wrapper, not a new standard wire contract.
A verified result attests only the performed standard checks; it does not prove
source truth, economic completeness or underwriting approval.

`UWMD_SPEC_DIR` may name this exact standard's spec/ directory outside a checkout.
Missing normative data is an internal error naming the path and variable, never
an empty dictionary or silently successful check. No second schema/dictionary
copy lives here.

The structured Reader/Verifier does not interpret Lite as an empty structured
record: its commands refuse an unclaimed Lite bridge with the existing
REPRESENTATION_UNSUPPORTED_MEDIA_TYPE code. Receipt subject accounting separately
handles the current Lite financial canonical form and its exact decimal-percent
scaling. Envelope2.0 XML/CSV/ZIP library APIs remain in uwmd_envelope.py; their
presence does not advertise the entire representation profile.

## Evidence and boundaries

```sh
python -m unittest discover -s implementations/python -v
python conformance/runner/runner.py --impl "python implementations/python/uwmd.py" --tier verifier --no-skip --receipt-engine org.uwmd.python --receipt-engine-version 0.0.0-dev --manifest-out python-verifier-conformance.json
```

CI requires every Reader/Verifier case, zero failures, zero skips and zero
unverifiable profiles on all three operating systems. RFC0127's explicit engine
pair is test configuration: Receipt5.3 gives another engine's finite disagreement
RCP-07/unverifiable. Same-engine disagreements remain failed, and procedure
refusals remain failed for every engine. No engine identity is spoofed. Stated
RCP-03 evidence, recomputed ids and exact exits remain checked.

Portable projections cover their selected fields. Additional controls exercise
all current structured-example statement homes, original source precision,
raw sizes only at registered property homes, source/model separation, ordered
binary64 sums, fixed native quanta, no-fallback selections, same-day rows,
terminal-only clawback, exact coverage copies, year9999 horizons, source authority,
signature preflight order and backend exceptions. The existing source-validator
parity check and pinned-procedure controls remain separate evidence.

Base verification is implemented from the current accepted Format/Protocol,
metric dictionary and RFCs. It reproduces stated figures without generating a
projection, defaulting a missing fact, inferring cash coverage or changing a
financial convention. Module-dependent computations remain outside the unclaimed
Module profile; unknown named-pack receipt coverage remains RCP-05 even when
visible dictionary results agree. No signature authentication is inferred from
source or result digests.
