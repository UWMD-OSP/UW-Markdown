# Named spreadsheet recalculation — bounded RFC 0088 evidence

These are the original ten synthetic controls from the spreadsheet gate, now
committed with their builder and capture tools. They are research observations,
not new normative answers or a claim of complete pack/export parity. The
original workbook was authored with @oai/artifact-tool; its generated caches
are **not** spreadsheet-engine evidence.

## Run the named first engine

From repository root, build the actual draft public pinned primitives:

```sh
npm ci
npm run build --workspace=@uwmd/verify
python -B -m unittest discover -s experiments/numerical-0088/spreadsheet-parity -p "test_*.py" -v
node --test experiments/numerical-0088/spreadsheet-parity/compare.test.mjs
python -B experiments/numerical-0088/spreadsheet-parity/capture.py --engine libreoffice --output NEW_OUTPUT_DIRECTORY
```

The numerical-research workflow installs libreoffice-calc on Ubuntu and runs
this capture. No project dependency is added. Each run records the full output
of `libreoffice --version`, Node/V8, Python/platform, exact commit and before/after source/
compiled identities (changes refuse capture), conversion commands/exit codes/stdout/stderr, workbook
bytes/hashes, native numeric lexemes and binary64 words or spreadsheet errors,
and the comparison report. Artifact upload runs even after capture failure.

A dedicated profile sets `/org.openoffice.Office.Calc/Formula/Load/OOXMLRecalcMode`
to **0 (always hard recalculate)**. Each disposable input has all20 formula
caches removed plus automatic/full/forced calculation flags. Headless
`--convert-to "xlsx:Calc MS Excel 2007 XML"` writes to a separate output
directory. No existing application profile or workbook is opened. All20
converted result cells must have caches, and all control identities, B:E numeric input types/
words and formulas must remain unchanged. The mutation conversion changes only
B4 from1.2 to1.21; G4 must change. A restored-input conversion must reproduce all20
base cells. Process exit0 without these checks does not pass capture.

The official [LibreOffice configuration schema](https://github.com/LibreOffice/core/blob/master/officecfg/registry/schema/org/openoffice/Office/Calc.xcs)
defines0 as always hard recalculation on OOXML load; its default1 is never.
[Command-line documentation](https://help.libreoffice.org/latest/en-US/text/shared/guide/start_parameters.html)
defines the conversion/profile parameters. Recorded engine version, rather than
the runner label or moving documentation, identifies the actual experiment.

## Comparison contract and findings

The candidate is the actual public draft `pinnedPow/pinnedExp/pinnedLog`
module. No host primitive, stable rearrangement or alternate solver is substituted.
Comparison calls the existing RFC0079 `compareStatedMetric` using each saved
numeric cell's original OOXML token, with no formatted-display precision
inference, relative tolerance or double rounding. Raw values/words are retained.

| Controls | G comparison minimum / ceiling | H comparison minimum / ceiling |
|---|---|---|
| power-report12, negative-power, subnormal-power, log, exp |12 /12 synthetic declared scalar precision |12 /12 |
| overflow-exp |nonfinite primitive, separately classified |same exceptional boundary |
| internal-npv |6 /6 synthetic declared precision |6 /6 |
| quantizer-tie |2 /2, unchanged VIII.5 half-away |2 /2 |
| stack-ads, stack-ads-zero |0 /2 currency |2 /4 ratio, native H explicitly stated to2 places |

These scalar controls do not invent dictionary entries; their declared synthetic
precisions test the accepted comparison procedure. ADS graph order is the
workbook's stated closed form; this is not an amortization-schedule census.
H references start from the unrounded ratio/value, not pre-rounded G.

Every differing native cell word, finite precision disagreement or exceptional
representation is an **export-contract-finding**, even when the precision
comparison agrees. A spreadsheet error for EXP overflow is distinct from raw
pinned Infinity and the existing public calc refusal. A spreadsheet error on
the overflowing POWER denominator is distinct from UWMD's finite final zero.
A zeroed subnormal can agree at12 decimals while still differing in raw identity.
No error is silently converted into zero or into a public UWMD refusal.

A successful capture means the named experiment executed and findings were
recorded. It does **not** mean every cell agrees. CI retains mismatches as
findings instead of changing UWMD arithmetic or quietly failing to record them,
as required by the existing consumer-composition README. Acceptance must assess
those concrete findings; this ten-control workbook does not certify all emitted
formulas, NORM.INV, capital stacks or full export-contract completeness.

## Optional second engine: one owner action

**Open the committed `experiments/numerical-0088/spreadsheet-parity/controls.xlsx`
in Excel, press Ctrl+Alt+Shift+F9, save under a new name, and return that path.**

Only do this if a second named engine is needed. No hidden COM calculation is
attempted. The prior xlPending(2) attempts are an execution-boundary failure,
not numerical evidence.

The integrator then runs:

```sh
python -B experiments/numerical-0088/spreadsheet-parity/capture.py --engine excel --saved "RETURNED_PATH.xlsx" --output NEW_OUTPUT_DIRECTORY
```

The capture reads the saved ZIP/XML without opening Excel, freezes the returned
file, requires complete result caches and unchanged original inputs/formulas,
and compares identically to LibreOffice. It requires Microsoft Excel Application
and AppVersion metadata in the saved file and records both. That saved AppVersion
is a version identifier, **not** a claim of exact product build; optional
`--excel-version "EXACT_OWNER_REPORTED_VERSION_AND_BUILD"` records stronger
owner-supplied version evidence separately. No installed Excel registry or
another machine's version is substituted for the engine that saved the file.
The hard recalculation is owner-attested; capture cannot prove keystrokes from
OOXML. An untouched authored workbook or changed inputs/formulas is refused.

## Rebuild the authored input

`build.mjs OUTPUT_DIRECTORY` reads committed controls.json and uses the same
@oai/artifact-tool builder/formatting as the original scratch experiment.
The retained builder was independently reproduced with @oai/artifact-tool2.8.99: all ten identities, input words, formulas and generated caches match; this is authoring verification only.
Run with a runtime providing that authoring package (the workspace dependency
loader does), or set UWMD_ARTIFACT_TOOL to that package entry file; no repository/package dependency is added. The builder writes one
controls.xlsx plus inspect/render support in the chosen directory. ZIP timestamps
need not reproduce byte hashes; all ten identities, inputs and formulas must.
The workflow deliberately uses the committed input and independently clears its
caches; authoring-package calculation never becomes a named-engine oracle.

No RFC acceptance, production numerical/receipt change, conformance rebaseline,
version, release or publication occurs here.

## First executed named-engine result

[Research run39108657829](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/39108657829)
at09b729d389f6fcf896b06f3227cd164378f4f8d4 executed LibreOffice24.2.7.2
420(Build:2). All three conversions exited0, G4 changed for B4=1.21, and all20
base cells restored exactly. Thirteen cells agree at RFC0079 comparison precision,
one differs, and six are spreadsheet errors. Thirteen cells are export-contract
findings in total (raw-word differences overlap those categories).

The finite precision disagreement is H4: native POWER/ROUND exports
284.851576559724, while the pinned graph quantizes to284.851576559723 at12 places.
This is an observed composed export difference; saved-cell evidence alone does
not identify whether native primitive, internal precision or ROUND caused it.
G6/H6 (subnormal power), G9/H9 (EXP overflow) and G10/H10 (overflowing NPV
denominator) are #NUM!; their distinct UWMD outcomes remain explicitly reported.
Quantizer tie and both DSCR outputs agree at their comparison precision. No
arithmetic/precision setting is changed in response.

That first capture preceded independent review's added typed-input and complete
before/after closure guards. Those guards are now required; final-head workflow
execution supplies the strengthened capture, with its own recorded head/version.
The first run is not relabeled as if it had those later guards. Capture artifacts
are retained with each research run; generation and mismatch classification are
reproducible by the commands above. No Excel second-engine evidence is claimed.
