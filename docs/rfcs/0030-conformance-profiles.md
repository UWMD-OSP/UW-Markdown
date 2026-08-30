---
rfc: 0030
title: Make partial conformance mechanically checkable
status: draft
author: jaredmaxey
created: 2026-08-30
affects:
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0030: Make partial conformance mechanically checkable

## Summary

§II.5 already says an implementation MAY claim partial conformance through
`ViewerCapability` flags rather than a tier number. Nothing checks that claim.
No fixture states which capability it exercises, so an adopter who implements
the calc engine but not the edit engine has no way to run "the parts that apply
to me" — they either fail the corpus or document an exception in prose.

This RFC makes the claim checkable: every conformance case declares the
capabilities it requires, the driver reads the implementation's manifest and
skips (visibly, never silently) the cases it does not claim, and each validator
code family is assigned an owning capability. It also removes two requirements
the corpus asserts but no spec section states — the in-memory `ParsedUWFile`
projection, and the refinement engine — and repairs §III.6a, which says every
issue code belongs to one of three families while the reference validator ships
eighteen.

## Motivation

The first external adopter to run the corpus end-to-end (underwriter.cc,
vendored at `32a0df8`, protocol 1.2.0) reported four divergences. Every one of
them is a defect on our side, and all four have the same root cause: the corpus
encodes requirements the spec does not state, and the spec offers no mechanism
to opt out of the parts that do not apply.

**1. `conformance/tier-1-reader/README.md:59` makes an implementation detail
normative.** It requires a reader's parse output to "canonicalize to the same
`<id>.parsed.json`", and those files are a serialization of `@uwmd/core`'s
in-memory `ParsedUWFile` — `annotation` with its short `ts`/`v` keys, `meta`
with every optional field explicitly `null`, a section-keyed map. §II.1 requires
a reader to *surface* structured data and says nothing about shape. A
conformance requirement that lives in a README and exceeds the protocol is not
a requirement; it is an accident. It also freezes a core type: any refactor of
`ParsedUWFile` silently becomes a breaking protocol change.

**2. §III.6a is stale and self-contradicting.** It states that every issue code
"MUST belong to one of three families" — `CC-NN`, `FV_*`, `META_*`. The shipped
`BUILTIN_REMEDIATIONS` registry emits eighteen: `CC`, `FV`, `DQ`, `MU`, `CS`,
`CS-WATERFALL`, `INT`, `POL`, eight `MOD-*` families,
`INVALID-ASSET-CLASS`, and `UNSUPPORTED_YAML_FEATURE`. `FV_*` was renamed to
`FV-NN` in v1.1 and §III.6a still names the old form. `META_*` ships nowhere.
The reference validator is non-conforming to the section that describes it, and
adopters are told to route issues by a prefix contract that does not hold.

**3. Fixture placement acts as a normative requirement.** §II.6 defines
self-certification as running "every fixture in the corresponding
`conformance/tier-N-*/` directory." `conformance/tier-3-calc-host/refinement/`
therefore reads as mandatory for a calc host, but §II.3's four requirements are
parse the grammar, implement the builtins, be deterministic, and refuse
out-of-grammar constructs. Refinement appears in none of them; `refinement.ts`
and `extractDependencyGraph` are `@uwmd/core` library features. The RFC 0004
driver already agrees — it generates zero refinement cases out of forty-four —
so two of our own conformance surfaces disagree about what is required.

**4. Validator families have no tier or capability owner.** `INT-01` requires
recomputing a content-hash chain; `POL-01`/`POL-02` require an edit-policy
engine; `CC-04` requires cross-section arithmetic. §II.1.6 nonetheless requires
a Tier-1 Reader to "surface validation issues using the remediation copy from
`BUILTIN_REMEDIATIONS`", which reads as owing all of them. A read-only reader
cannot satisfy that without implementing an edit engine it does not have.

The common thread is that partial conformance is currently established by
prose. Two implementations claiming "Tier 1 plus some of Tier 3" can mean
different things, which is exactly the drift §II.6a's shared driver exists to
prevent.

## Proposed change

### 1. `capabilities` becomes required for driver-checked implementations

`ImplementationManifest.capabilities` is optional today, which leaves the driver
unable to filter. §II.6a gains:

> An implementation driven by the conformance driver **MUST** populate
> `capabilities` in its `manifest` output. An absent or empty list **MUST** be
> treated by the driver as claiming every capability — a missing claim is not a
> license to skip.

Fail-closed against the claimant: forgetting the field runs the whole corpus
rather than silently exempting the implementation from all of it.

### 2. Cases declare the capabilities they require

The RFC 0004 case format gains one optional field:

```jsonc
{
  "id": "tier-2/section-supersede-risk-rating",
  "tier": "2",
  "requires_capabilities": ["edit-supersede"],
  "command": "edit",
  "...": "..."
}
```

A case with no `requires_capabilities` is required of every implementation. A
case whose required capabilities are not all claimed is reported as a TAP skip:

```
ok 12 - tier-2/section-supersede-risk-rating # SKIP capability not claimed: edit-supersede
```

Skips are counted separately in the TAP summary and in the `--manifest-out`
JSON. A skipped case is never reported as a pass, and the summary states how
many were skipped and which capabilities caused it. "Passes the corpus" without
the accompanying skip count stops being a sentence an adopter can say.

The driver gains `--no-skip`, which turns any skip into a failure. CI runs the
reference implementation under `--no-skip`, so the mechanism cannot quietly
erode our own coverage.

### 3. Every validator code family gets an owning capability

§III.6a's three-family table is replaced by a registry with an owner column:

| Prefix | Family | Owning capability |
|---|---|---|
| `CC-NN` | Cross-section consistency | `validate` |
| `FV-NN` | Single-section financial validity | `validate` |
| `DQ-NN` | Data quality | `validate` |
| `MU-NN` | Mixed-use composition | `validate` |
| `CS-*` | Capital stack | `validate` |
| `INT-NN` | Integrity / hash chain | `integrity` |
| `POL-NN` | Edit policy | `edit-replace` or `edit-supersede` |
| `MOD-*` | Module runtime | `module-load` |
| `CALC-*` | Calc engine | `calc-evaluate` |
| `INVALID-ASSET-CLASS-NN` | Asset-class identifiers | `validate` |
| `PROTO-*` | Protocol-level refusals | (none — always required) |

`META_*` is formally retired; it ships nowhere and its stated purpose is covered
by `DQ-NN`.

The table is not the anti-staleness mechanism — a duplicated list is what went
stale in the first place. §III.6a instead states the *rule* (a code MUST carry a
registered family prefix, and each family MUST name an owning capability), and a
test asserts that every code in `BUILTIN_REMEDIATIONS` belongs to a family the
spec registers. The spec and the registry cannot diverge without CI going red.

### 4. `integrity` and `refinement` join `ViewerCapability`

```ts
| 'integrity'    // Recomputes content_hash / parent_hash chains (§IX.2). Owns INT-NN.
| 'refinement'   // Projects a calc-expression dependency graph. Not required by any tier.
```

`refinement` is declared explicitly non-normative: no tier requires it, and the
refinement fixtures are tagged `requires_capabilities: ["refinement"]` rather
than relocated. Tagging beats moving — the fixtures stay where a reader looks
for them, and their optionality becomes a fact the driver enforces instead of a
convention a directory name contradicts.

### 5. §II.1.6 is scoped to the `validate` capability

Current text requires every Tier-1 Reader to surface validation issues. New
text:

> 6. An implementation claiming the `validate` capability **MUST** surface
>    validation issues using the remediation copy from `BUILTIN_REMEDIATIONS`,
>    and **MUST** emit only codes whose family is registered in §III.6a. A
>    Tier-1 Reader that does not claim `validate` owes no validator codes.

Parsing and validating were already separate capability flags; this makes §II.1
agree with them.

### 6. The parse baseline becomes a specified projection

`expected/*.parsed.json` is redefined as the **parse conformance projection** —
a wire format the driver compares, specified in the protocol rather than
inherited from a TypeScript type:

```jsonc
{
  "frontmatter": { /* every frontmatter key, verbatim */ },
  "sections": { "<section_id>": { "meta": { /* _meta, verbatim */ },
                                  "content": { /* block content, verbatim */ } } },
  "superseded": [ /* same shape, document order */ ],
  "pipeline_log": [], "custom_calculations": [], "custom_scenarios": [],
  "extensions": [], "prose": []
}
```

What leaves the normative set: `annotation` (a parser artifact — the fence
annotation is recoverable from `meta`), `lineStart`/`lineEnd` (byte offsets into
one implementation's reader), single-entry-versus-instance-map variance, and
optional `_meta` fields serialized as explicit `null`. Absent and `null` are
distinguishable in the source document, so the projection carries a key only
when the document does.

Because the driver compares by subset, an implementation that also emits its own
richer shape still passes. `@uwmd/core` keeps `ParsedUWFile` unchanged as an
internal type.

This does not eliminate an adopter's exporter — a cross-implementation driver
needs *some* agreed wire shape, and value-equivalence against an unspecified
shape is not checkable by a third party. It makes the exporter small, stable,
and specified, rather than a reimplementation of our internals.

### 7. §II.6 is reworded

> To self-certify, run every case whose `requires_capabilities` are a subset of
> the capabilities claimed in the implementation's manifest, and verify the
> output matches. A self-certification claim **MUST** be published together
> with the capability list it was run against.

Directory membership stops being a normative signal.

## Compatibility analysis

**Existing `.uw.md` / `.uwx.md` files** — unaffected. No format change; the
format spec is not touched.

**Tier-1 Reader** — strictly loosened. §II.1.6 becomes conditional and the parse
projection shrinks, so no previously-conforming reader becomes non-conforming.
A reader that validated and did not list `validate` must add the flag: a
manifest edit, not a behavior change.

**Tier-2 Editor** — unaffected. `POL-NN` was always theirs; this states it.

**Tier-3 Calc Host** — loosened. Refinement was never required by §II.3;
declaring that explicitly cannot break a conforming host. A host that *does*
implement refinement should add the flag to keep running those cases.

**Tier-4 Agent Host** — unaffected.

**Modules** — unaffected. No manifest-schema change; `MOD-*` ownership is
recorded, not altered.

**Receipts** — unaffected.

**The reference implementation** — `@uwmd/core` gains two capability flags and
regenerates the tier-1 parse baselines. Because comparison is by subset, its own
output is a superset of the new projection and continues to pass.

Nothing here is a breaking change requiring a deprecation window. The one
observable break is for a hypothetical third-party driver that reimplemented
§II.6's "every fixture in the directory" rule; that reading is what this RFC
retires, and §II.6a exists precisely so nobody has to write that driver.

## Conformance impact

**Regenerated:**

- `conformance/tier-1-reader/expected/*.parsed.json` (7 files) — reduced to the
  parse conformance projection.
- `conformance/runner/cases/*.case.json` (44 files) — gain
  `requires_capabilities`; regenerated by `scripts/gen-conformance-cases.mjs`,
  and the existing `--check` mode keeps them honest in CI.

**Retagged, not moved:**

- `conformance/tier-3-calc-host/refinement/` — `requires_capabilities:
  ["refinement"]`.

**New fixtures:**

- `conformance/profiles/01-reader-only/` — a manifest claiming `parse` alone.
  Asserts the driver skips every `validate`, `edit-*`, `calc-*`, and `integrity`
  case, and that the skip count is reported rather than folded into passes.
- `conformance/profiles/02-calc-no-edit/` — the underwriter.cc shape: `parse`,
  `validate`, `calc-evaluate`, no `edit-*`. Asserts tier-2 cases skip while
  tier-3 cases run, which is the combination cumulative tiers cannot express.
- `conformance/profiles/03-absent-capabilities/` — a manifest with no
  `capabilities` key. Asserts every case runs.
- `conformance/profiles/04-no-skip-flag/` — asserts `--no-skip` turns a skip
  into a failure.
- A unit assertion that every code in `BUILTIN_REMEDIATIONS` carries a family
  prefix registered in §III.6a — the check that keeps the taxonomy from going
  stale a second time.

Corpus: 274 → approximately 285 assertions.

## Reference implementation

**Files affected:**

- `spec/UW_PROTOCOL_v1.md` — §II.1.6, §II.5, §II.6, §II.6a, §III.6a.
- `packages/uwmd-core/src/protocol.ts` — `ViewerCapability` gains `integrity`
  and `refinement`; a `VALIDATOR_CODE_FAMILIES` registry mapping prefix →
  owning capability; `REFERENCE_IMPLEMENTATION_MANIFEST` gains the two flags.
- `packages/uwmd-core/src/protocol.test.ts` — the family-registry assertion.
- `conformance/runner/runner.py` — read `capabilities` from the existing
  `read_manifest`, filter cases, emit TAP skips, count them in the summary and
  the JSON manifest, add `--no-skip`.
- `scripts/gen-conformance-cases.mjs` — emit `requires_capabilities` from a
  fixture-group → capability table.
- `scripts/run-conformance.mjs` — the tier-1 comparison switches to the parse
  conformance projection.
- `conformance/tier-1-reader/README.md` — delete the sentence that made
  `ParsedUWFile` normative; point at the protocol section instead.
- `.github/workflows/ci.yml` — the driver step gains `--no-skip`.

**API surface:** two new `ViewerCapability` members and one new exported
registry (`VALIDATOR_CODE_FAMILIES`). Both additive. `ParsedUWFile` is
unchanged.

**Test plan:** the four `conformance/profiles/` fixtures prove the skip
mechanism in both directions (skipped when unclaimed, run when claimed, run when
the manifest is silent, fatal under `--no-skip`). The registry assertion proves
spec and code agree. Regenerating the tier-1 baselines and watching the
reference implementation still pass proves the subset comparison holds.

## Alternatives considered

**Declare `ParsedUWFile` normative and specify it properly.** Honest about the
status quo and cheapest to write. Rejected: it makes a TypeScript interface a
protocol surface, so renaming a field or dropping `lineStart` becomes a protocol
break, and it exports parser artifacts (`annotation`'s `ts`/`v` short keys) as
though they were meaning. The projection ought to be smaller than any
implementation's internals, not equal to one.

**Tier numbers only; no capability filtering.** Rejected: tiers are strictly
cumulative — §II.3 requires all of Tier 2 — so an implementation with a complete
calc engine and no edit engine must claim Tier 1, discarding a true statement
about most of what it does. That is the exact case in front of us, and §II.5
already chose capabilities over tier numbers for it.

**Let each adopter maintain a skip list.** Rejected: it is what we have now,
renamed. A skip list is unfalsifiable — nothing distinguishes "not applicable"
from "not implemented" — and two adopters' lists are not comparable, which
defeats the point of a shared corpus.

**Update §III.6a's table and stop there.** Rejected: the table went stale
*because* it duplicated a list that lives in code. Rewriting it without the CI
assertion buys a year, maybe, and leaves the fixture-ownership problem —
the larger half of the four reported divergences — untouched.

**Split the corpus into per-capability directories.** Rejected: it churns every
fixture path, breaks every existing vendored reference, and re-encodes the same
mistake in a new place — directory membership as a normative signal. Tagging
leaves paths stable and puts the requirement in a field the driver reads.

## Unresolved questions

**The `source` vocabulary conflict is deliberately out of scope.** Format §2.6
defines two source vocabularies, §3.1 a third, §4.16 a fourth, and
`BUILTIN_EDIT_POLICIES` a fifth — and only `manual` means the same thing in all
of them. Because `resolvePolicy` returns `null` for unmatched sources and
`checkAuthority` treats `null` as permitted, a producer following §2.6 literally
gets unpoliced writes and never triggers `supersede_on_edit`. That is a
correctness and authorization defect with its own migration cost, and it
deserves its own RFC rather than riding along with a conformance-plumbing
change. This RFC assigns `POL-NN` an owning capability; it does not touch what
`source` strings mean.

**Should `integrity` be one capability or two?** `signing` already exists for
`_meta.signature` verification (RFC 0010). Hash-chain recomputation and
signature verification are separable — a host might do the first and not the
second — but the reverse is incoherent, since a signature over a block whose
hash is unverified proves little. Modeling that dependency is left to
implementation discovery.

**Does a skip belong in the TAP plan count?** TAP 14 counts skipped points as
part of `1..N`, which is what this RFC assumes. If aggregating two
implementations' reports turns out to want skips excluded from the denominator,
that is a driver-side change with no spec impact.

## Prior art

**JSON Schema 2020-12 `$vocabulary`** maps vocabulary URIs to a required boolean,
so a schema states which parts of the standard a processor must implement to
process it — the same "declare your subset, and let the tooling check it" move
this RFC applies to a test corpus.

**SQL:2003 feature packages** define a mandatory Core plus numbered optional
features (`F###`), with vendors publishing which they support. It is the
closest analogue to capability-owned fixture groups, and its lesson is the one
driving §II.6's rewording: the conformance claim has to name the feature set it
was run against, or it means nothing.
