# Adding or changing a metric

A metric's definition lives in the normative metric dictionary
(`spec/metrics/builtin.json`, RFC 0078) and its class calc pack, which a parity
test holds equal. A Verifier reproduces it from a document's stated inputs
(Protocol §II.2). Adding a metric or changing one's meaning is normative: it
needs an RFC.

## 1. What the RFC states

- **id and class.** A snake_case id, unique within its class. Select entries by
  class and id, never id alone.
- **formula.** In the Protocol §VIII.1 expression notation, over stated document
  fields only. A metric never assumes a fact the document does not state: an
  absent input gives `null`, not a default (RFC 0103's "never invented").
- **unit and precision.** `%` values are fractions. `round_to` follows
  §VIII.5 (money 2, rates 6, ratios 4) unless the RFC says otherwise, and
  `minimum_stated_decimals` follows RFC 0079.
- **null semantics.** `expression`, or `positive_size_denominator` when the
  formula divides by a registered size (RFC 0100). The latter is derived; the
  parity test checks it.
- **authority.** The published outside source the definition follows (a
  standard, regulator handbook or industry publication), with the section. Where
  practice has variants, name the one chosen and why. Where no standard defines
  it, say so and state the convention.
- **statement homes.** If documents state the figure under another name, add the
  alias to `statement_bindings` (RFC 0099). The registry is closed; nothing is
  inferred from a field name.
- **test vectors.** Hand-computed cases: an ordinary one, zero and negative
  inputs, an absent input, and a rounding boundary.

## 2. The pull request

- [ ] The pack entry (`packages/uwmd-verify/src/builtin-packs/<class>.ts`).
- [ ] The dictionary entry, with `input_paths` from the dependency walker
  (`calc/dependencies.ts`), then `npm run gen-metric-dictionary`.
- [ ] The Excel layout: a named cell for every new input path. Text inputs use
  the `text` format.
- [ ] Class rules that read the metric (`builtin-class-content.ts`, and the
  Python mirror in `uwmd_validation_builtins.py`).
- [ ] The metric dictionary README's "Definitions and authorities" table.
- [ ] Fixtures: the vectors as conformance cases. Re-derive any pinned value the
  change moves and review each diff before writing it.
- [ ] `CHANGELOG.md` and the wiki status page.

## 3. After launch: meaning never changes silently

Once 5.0.0 ships, a published metric id keeps its meaning. To change what a
metric computes:

- **Add a new id** for the new definition, and keep the old one.
- **Deprecate the old id** under the [release rules](RELEASE_RULES.md): it keeps
  computing, documents still verify against it, and it is removed only in a
  later major release.

Corrections that do not change meaning are ordinary fixes, for example a null
guard that refuses a division by zero more clearly. Before launch, definitions
may change in place, as RFC 0103 did.
