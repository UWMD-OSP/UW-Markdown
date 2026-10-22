# Adding an official asset class

Every official asset class is a **builtin with the full kit**, equal to
multifamily (RFC 0080, Product principle 1). There are no official module
classes, namespaced official ids or separate class packages. A property type
that does not get the full kit is not official: it is a
[third-party module class](THIRD_PARTY_MODULE.md).

## 1. The RFC

An RFC (`docs/rfcs/0000-template.md`), because the class changes the format,
the protocol, the metric dictionary and conformance at once. It states:

- **the class id** (snake_case, not namespaced) and why no existing class covers it;
- **the primary size** and any secondary sizes (Protocol §XIII.1), the
  denominator of every per-unit metric;
- **the class sections**: their fields, closed vocabularies, which are
  required (`CLS-03`) and the field contracts (`CLS-04`);
- **the metrics**: each with its formula, unit, precision and outside authority
  (see [Adding a metric](ADD_METRIC.md));
- **the class rules** (`CC-<CLASS>-NN`): assertion, severity and reason;
- **defaults and stage overlays**: what the cascade may supply and what each
  pipeline stage requires;
- **the mixed-use component slot**: what a component of this class carries.

## 2. The kit, in one pull request

The implementation lands as one PR, so no release ships a half-built class.
File paths are the reference implementation's; an independent implementation
needs the same pieces.

**Format and protocol**

- [ ] `spec/UW_FORMAT_SPEC.md`: the class in the `asset_class` vocabulary
  (§2.2), the Part IV section(s), the Part V class rules and any stage
  requirement (§5.1).
- [ ] `spec/schemas/section-<id>.schema.json` for each class section, indexed in
  `spec/schemas/README.md` (`npm run verify-indexes` checks this).
- [ ] `spec/UW_PROTOCOL.md` §XIII: the size-registry row.

**Reader and validator** (`packages/uwmd-verify/src/`)

- [ ] `types.ts` `ASSET_CLASS_MEMBERS` and `asset-class.ts`.
- [ ] `protocol.ts` `SIZE_INTENSIVES`: the primary and secondary sizes.
- [ ] `builtin-class-content.ts`: the section schemas (kept identical to
  `spec/schemas`; a test compares them), class rules, view models and the
  calculation inventory. `builtin-class-validation.ts` enforces them.
- [ ] `validator.ts`: stage readiness and any cross-section check.
- [ ] If the class has sizes beyond the generic table, consider whether the
  Format §5.5 size contract (RFC 0100) should list them.

**Calculations**

- [ ] `builtin-packs/<id>.ts`, registered in `builtin-packs/index.ts`; receipts
  then resolve the pack.
- [ ] `spec/metrics/builtin.json`: one entry per metric, regenerated into the
  package with `npm run gen-metric-dictionary`. The parity test holds the
  dictionary and the pack equal.
- [ ] `packages/uwmd-excel/src/<id>.ts`, registered in `layouts.ts`: the workbook
  layout. Every formula input needs a named cell. Excel and the calc engine agree
  exactly (invariant 4).

**Starter support** (`packages/uwmd-core/src/`)

- [ ] `defaults.ts` and the cascade, so `uwmd scope` works.
- [ ] `init.ts`, so `uwmd init` scaffolds the class (only sections a blank stub
  can satisfy).
- [ ] Mixed-use: the component slot (Format §4.23).
- [ ] Other consumers that enumerate classes: `uwmd-batch`, `uwmd-lake`, the
  web editor catalog (`tools/web-editor/src/catalog.ts`), the Lite bridge.

**Independent implementation**

- [ ] `implementations/python`: the class's inventories and rules
  (`uwmd_validation_builtins.py`) and its builtin list. The Python suite and the
  portable runner (`conformance/runner/runner.py`) must stay green.

**Evidence**

- [ ] An example in `examples/` with every class section, verified by
  `uwmd verify` (its stated metrics recorded in `conformance/metrics/expected.json`).
- [ ] `conformance/builtin-classes/`: a clean control, a fixture per class rule,
  and refusal cases for each field contract.
- [ ] `conformance/size-intensive/`: the registry and CSV size-column cases
  cover the class.
- [ ] Rows in `conformance/corpus-index.json` for every new case.

**Docs and records**

- [ ] The metric dictionary README's "Definitions and authorities" table.
- [ ] The docs-site page, `CHANGELOG.md`, the wiki status page, and `VERSIONS.md`
  when the release carries it.

## 3. Done means

```bash
npm run build && npm test && npm run conformance
npm run validate-schemas && npm run lint && npm run verify-indexes
cd implementations/python && python -m unittest -q
```

All green, the example verifies with no `failed` or `unverifiable` statement it
did not intend, and the RFC's Decisions table matches what shipped.
