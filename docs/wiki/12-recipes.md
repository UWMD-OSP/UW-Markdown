# 12 — Recipes

Task-oriented playbooks for the most common changes. Each lists the files to
touch, the tests to run, and whether an RFC is likely needed
(see [11 — Governance](11-build-release-governance.md)).

> Standard verification after any code change:
> `npm run build && npm test && npm run conformance`. Rebuild before conformance
> (it imports `dist/`).

## Add a calc builtin

**Files:** `packages/uwmd-verify/src/calc/builtins.ts`,
`calc/calc.test.ts`, `packs/excel-emit.ts`.
1. Add the function to the `BUILTINS` table. Validate arg count; raise
   `CALC-TYPE-001` on type/arity errors; propagate `null` for missing data.
2. Add tests in `calc.test.ts` (and consider a property test).
3. If the builtin should be usable in pack formulas, add an Excel mapping in
   `excel-emit.ts`'s `FUNCTION_MAP` — otherwise it raises `EXCEL-EMIT-FN` and
   can't appear in a pack.
4. `npm test`. RFC: likely (changes the calc grammar surface / protocol §VIII).

## Add a derived metric to an existing pack

**Files:** `packages/uwmd-verify/src/builtin-packs/multifamily.ts` (+ Excel named ranges if
new inputs).
1. Append a `ModuleCalcDecl` (`id`, `label`, `unit`, `formula`, `deterministic:
   true`). Reference real field paths ([07 — Data model](07-data-model-reference.md)).
2. Ensure each path the formula reads has an Excel named range
   (`packages/uwmd-excel/src/multifamily.ts` `NAMED_INPUTS`/`NAMED_RANGE_MAP`).
3. `npm test` (the parity test covers it). Add a calc fixture (Verifier-owned) if you
   want conformance coverage. RFC: usually additive/no, but coordinate.

## Add a validator check

**Files:** `packages/uwmd-verify/src/validator.ts`, `protocol.ts`
(`BUILTIN_REMEDIATIONS`), `validator.dq.test.ts`.
1. Implement the check in `validateUWFile`; emit a `ValidationMessage` with a new
   `code`.
2. Register the code's `title`/`description`/`remediation`/`spec_ref` in
   `BUILTIN_REMEDIATIONS` (so every tool surfaces uniform copy).
3. Add a unit test and, if it should be conformance-enforced, a
   `documents/malformed/` fixture with the code in `expected_codes`.
4. RFC: yes if it changes the conformance contract (most new error codes do).

## Add / change a standard section

**Files:** `spec/UW_FORMAT_SPEC.md` (§4.x schema), `protocol.ts`
(`BUILTIN_VIEW_MODELS` entry), possibly `types.ts`, `validator.ts`,
`spec/schemas/`.
1. Define the section schema in the spec (this is **normative → RFC required**).
2. Add a `SectionViewModel` to `BUILTIN_VIEW_MODELS` for rendering.
3. Wire any cross-section consistency checks in `validator.ts` +
   `BUILTIN_REMEDIATIONS`.
4. Add a fixture exercising it. RFC: **yes**.

## Add an asset-class calc pack

See the scaffold in [05 — Calc packs › new asset-class pack](05-calc-packs.md).
Touches verify's `builtin-packs/` and `src/index.ts` (core's `packs/` re-exports), core's `defaults.ts`, Excel layout, conformance.
RFC: **yes** (`docs/rfcs/0003-module-asset-classes.md`).

## Add a Bancroft agent layer

See [06 — Bancroft agents › add a new agent layer](06-bancroft-agents.md).
Touches `context.ts` (`BANCROFT_LAYERS`, `REQUIRED_BY_LAYER`,
`getLayerDependencies`, `getLayerDescription`, `getOutputSchemaDescription`),
`agents/schemas.ts` (if multi-section), `types.ts` (`UWPipelineState`), the agent
starter checks. RFC: yes if it changes the §IX agent-host contract.

A new case needs an owner row in
[`conformance/corpus-index.json`](../../conformance/corpus-index.json)
(Reader, Verifier, one profile, or starter products; see
[09](09-conformance-testing.md)). The runner refuses an unindexed result, and
`npm run gen-conformance-cases` refuses an unindexed portable case.

## Add a reader-corpus fixture (`documents/` directory)

1. Drop `conformance/documents/fixtures/<id>.uwx.md`, and add its
   `[parse]`, `[validate]`, `[render-chat]` and `[render-summary]` owner rows.
2. `npm run build && npm run conformance -- --suite=documents --update` to mint
   `expected/<id>.parsed.json`, the validation verdict and the rendered baselines.
3. **Review the generated diff** before committing. RFC: no.

## Add an editor fixture (`starter/editor/` directory, starter products)

1. `conformance/starter/editor/fixtures/<scenario>/` with `before.uwx.md` +
   `operation.json` (+ optional `context.json`, `options.json`). For a
   negative test, add `expected-error.json` with the expected `code`.
2. `npm run conformance -- --suite=starter-editor --update` to mint `after.uwx.md` (volatile
   fields are auto-stripped).

## Add a calc fixture (`calc/` directory)

1. `conformance/calc/fixtures/<scenario>/` with `deal.uwx.md` +
   `calc.json` (a `ModuleCalcDecl`). Own it `verifier` when it tests a
   dictionary definition, the IRR procedure, or the §VIII.1–VIII.3 notation;
   `module` when it tests a custom declaration.
2. `npm run conformance -- --suite=calc --update` to mint `expected-result.json`.

## Regenerate expected outputs (carefully)

`npm run build && npm run conformance -- --suite=<family> --update` (or
`node scripts/regen-conformance.mjs --suite=<family>`; with no selector both
regenerate every family). `--update` refuses `--tier`, `--profile` and
`--starter-products`, which could leave part of a family stale. Only when you
intend to change the contract; always review the diff. `--update` overwrites
baselines from current output.

## Change a validation/financial threshold default

**Files:** `types.ts` (`DEFAULT_THRESHOLDS`). Per-institution overrides go through
`InstitutionConfig.thresholds` (`.uw.institution.json`), not code. Bump nothing
else unless the change is normative.

## Run an agent against a deal (manual / debugging)

```bash
npm run build
npm run cli -- run examples/Parkview-Apts-Glendale-AZ.uwx.md --agent L6 --context-only
npm run cli -- run examples/Parkview-Apts-Glendale-AZ.uwx.md --agent L6 --prompt
# live (needs ANTHROPIC_API_KEY):
npm run cli -- run examples/Parkview-Apts-Glendale-AZ.uwx.md --agent L6 --live
```

## Scaffold, validate, and inspect a deal

```bash
npm run cli -- init --name "Test Deal" --asset-class multifamily
npm run cli -- validate examples/Parkview-Apts-Glendale-AZ.uwx.md
npm run cli -- verify   examples/Parkview-Apts-Glendale-AZ.uwx.md
npm run cli -- summary  examples/Parkview-Apts-Glendale-AZ.uwx.md
npm run cli -- scope    examples/Parkview-Apts-Glendale-AZ.uwx.md
npm run cli -- refine   examples/Parkview-Apts-Glendale-AZ.uwx.md --targets dscr,debt_yield
```

## Show what verification catches

[`examples/verification/`](../../examples/verification/README.md) holds four
scripts that use only `@uwmd/verify` and `@uwmd/signing`: a valid document, a
wrong stated metric, a tampered receipt and a failed document snapshot
authentication. Each exits 0 only when the verifier reports the verdicts its
scenario documents; CI runs them with `npm run examples:verification` after a
build. The folder runs unchanged outside the repository against the npm
packages.
