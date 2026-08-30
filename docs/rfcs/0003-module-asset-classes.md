---
rfc: 0003
title: Custom asset-class declarations from modules
status: implemented
author: jaredmaxey
created: 2026-04-26
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0003: Custom asset-class declarations from modules

## Summary

`AssetClass` is hard-coded as a closed enum in
[`types.ts:18`](../../packages/uwmd-core/src/types.ts). Every new asset
class — gas stations, life-sciences, manufactured housing, data centers —
requires a spec bump. This RFC proposes letting modules **declare** new
asset-class identifiers, with namespacing rules that prevent collision and
a host-side resolution model that keeps determinism.

## Motivation

The closed enum is correct for the v1 release: it eliminates the question
"what does `data_center` mean?" by simply not allowing it. But it forces
every adopter who wants a new asset class to either:

1. Lobby for it to land in the core enum — slow, doesn't scale.
2. Reuse an existing class incorrectly — e.g. data centers as `industrial`,
   which then breaks the validation rules (a data center has no warehouse
   square footage, but an industrial validator may require it).
3. Fork the spec — defeats the whole interoperability goal.

A module is already the right boundary for "extends the standard." It can
declare new sections, calculations, validations. The asset class is the one
extension point modules cannot reach.

## Proposed change

### Asset-class identifier namespacing

A custom asset class identifier **MUST** be reverse-DNS, lower-snake-case
between dots, and contain at least two dots:

```
org.uwmd.data_center
com.example.specialty.boutique_office
```

Built-in asset classes (the current enum values) are reserved as
unnamespaced identifiers. The grammar:

```
asset_class := builtin | custom
builtin     := 'multifamily' | 'office' | 'retail' | 'industrial'
             | 'self_storage' | 'hospitality' | 'mixed_use'
             | 'senior_housing' | 'student_housing' | 'land'
custom      := dns_segment ('.' dns_segment){2,}
dns_segment := [a-z][a-z0-9_]*
```

A parser **MUST** reject identifiers that are neither a built-in nor a
valid namespaced identifier with `INVALID-ASSET-CLASS-001`.

### Module declaration

`ModuleManifest.asset_classes` becomes the registry surface:

```ts
export interface ModuleAssetClassDecl {
  /** The namespaced identifier this module introduces. */
  id: string;
  /** Human-readable display name. */
  display_name: string;
  /** The closest built-in for fallback rendering by readers that don't load this module. */
  fallback?: AssetClass;
  /** Required sections specific to this asset class. */
  required_sections?: string[];
  /** Optional sections specific to this asset class. */
  optional_sections?: string[];
}

export interface ModuleManifest {
  // ...
  /** Custom asset-class declarations introduced by this module. */
  declares_asset_classes?: ModuleAssetClassDecl[];
  /** Built-in asset classes this module enhances (existing field, semantics unchanged). */
  asset_classes?: AssetClass[];
}
```

A `.uw.md` file whose `asset_class` is namespaced **MUST** declare in
frontmatter the modules it relies on:

```yaml
asset_class: org.uwmd.data_center
modules:
  - id: org.uwmd.data_center_module
    version: ">=0.1.0 <1.0.0"
```

### Host resolution

When parsing a file with a custom asset class, the host:

1. Looks up the declaring module from the file's `modules` list.
2. If the module is loaded and registers `asset_class.id`, the host treats the file as that asset class.
3. If the module is unavailable but a `fallback` is declared, the host **MAY** render with the fallback's view models, **MUST** mark the file as `degraded` in its parse result, and **MUST** emit `MOD-FALLBACK-001` (warning).
4. If neither the module nor a fallback is available, the host emits `MOD-MISSING-001` (error).

This keeps determinism: every host that has the module loaded produces the
same result; every host that doesn't either falls back identically or errors
identically.

### Library

- `AssetClass` becomes:
  ```ts
  export type BuiltinAssetClass = /* the current 10 values */;
  export type CustomAssetClass = string;  // validated at parse time
  export type AssetClass = BuiltinAssetClass | CustomAssetClass;
  ```
- New `parseAssetClass(raw: string): { kind: 'builtin' | 'custom'; id: string } | ProtocolError`.
- `ModuleRegistry.registerAssetClass(decl)` — registers a declaration so subsequent file loads can resolve it.

## Compatibility analysis

- **Existing `.uw.md` files** — no breakage. Files using built-in asset classes continue to parse identically.
- **Tier-1 readers** that don't load modules — they encounter a custom asset class, follow the fallback path. With a fallback declared, the file still renders (degraded); without one, it errors. Either outcome is deterministic.
- **Tier-2 editors** — preserve the `asset_class` and `modules` keys on round-trip.
- **Tier-3 calc hosts** — calculations attached to a custom asset class come from the module; if the module is loaded, they work. No core change needed.
- **Tier-4 agent hosts** — same as calc hosts; agent layer declarations come from the module.
- **Modules** — manifest schema gains the additive `declares_asset_classes` field. Existing modules without it continue to load.

No deprecation path required — additive.

## Conformance impact

New fixtures in `conformance/tier-1-reader/fixtures/`:
- `custom-asset-class-with-module/` — file declares `org.uwmd.data_center`, module is in the test fixtures dir, expected parse + render uses module's view models.
- `custom-asset-class-fallback/` — same file, module not loaded but `fallback: industrial` declared, expected `MOD-FALLBACK-001` warning + render via industrial view model.
- `custom-asset-class-missing/` — module not loaded, no fallback, expected `MOD-MISSING-001` error.
- `invalid-asset-class-syntax/` — file with `asset_class: DataCenter`, expected `INVALID-ASSET-CLASS-001` error.

Existing fixtures using built-in asset classes pass without modification.

## Reference implementation

- **Files affected:**
  - `packages/uwmd-core/src/types.ts` — `AssetClass` type split.
  - `packages/uwmd-core/src/parser.ts` — asset-class identifier validation.
  - `packages/uwmd-core/src/module-registry.ts` (new) — register/resolve declarations.
  - `packages/uwmd-core/src/protocol.ts` — `ModuleAssetClassDecl`, extend `ModuleManifest`.
  - `spec/UW_FORMAT_SPEC_v1.md` — namespacing grammar.
  - `spec/UW_PROTOCOL_v1.md` — Part X resolution rules.
  - `spec/schemas/module-manifest.schema.json` — additive field.
- **API surface:** `parseAssetClass`, `ModuleRegistry`, plus the new manifest field.
- **Test plan:** unit tests on `parseAssetClass`. Integration test loads a fixture module manifest, registers a custom asset class, parses a file referencing it, asserts the file's view-model resolution uses the module's declarations.

## Implementation notes (deviations from the proposal)

Shipped 2026-08-27, on top of the module runtime RFC 0006 added the same
day. Format spec §2.2a is the identifier grammar; protocol §X.2 is
resolution; protocol goes to **1.8.0**.

**1. `AssetClass` is NOT widened, and this is the important one.** The
RFC proposed:

```ts
export type AssetClass = BuiltinAssetClass | CustomAssetClass;  // CustomAssetClass = string
```

In TypeScript that collapses to `string`. Silently — it compiles, and
every downstream check that depended on the union being closed simply
stops doing anything: `ASSET_CLASS_MEMBERS`' exhaustiveness anchor
(which exists precisely so a new class cannot be added without updating
the runtime list), every `getPackForAssetClass` / `getLayoutForAssetClass`
narrowing, and the RFC 0027 size-intensive and RFC 0029 stage-overlay
tables. Adopting the RFC as written would have traded a whole class of
compile-time guarantees for a type alias.

So `AssetClass` stays the closed builtin union, and a separate
`UWAssetClassId = AssetClass | (string & {})` is used at the one boundary
where a custom class is legal: `UWFrontmatter.asset_class` and module
declarations. Anything that needs a *builtin* still asks for `AssetClass`
and still narrows. The `(string & {})` arm keeps editor autocomplete on
the builtin members.

**2. Three segments minimum, not two.** The RFC's grammar says "at least
two dots", which its own examples honor but its prose ("at least two
dots" vs. `{2,}` repetitions) reads ambiguously. Three segments is the
shipped rule: `com.data_center` reads as a namespace with no owner.

**3. `INVALID-ASSET-CLASS-002` checks the final segment.** The RFC's
unresolved question asked what stops `com.example.multifamily` and
recommended checking "the full identifier, not just trailing segment" —
but a full-identifier check is vacuous, since a builtin never contains a
dot. The shipped rule refuses a *final segment* matching a builtin, and
the code comment says plainly that this is stricter than
collision-avoidance requires: the namespace already prevents collision.
It is there because such an identifier reintroduces the ambiguity the
closed enum removes, and because host-side suffix matching is a bug that
will happen. `com.example.multifamily_senior` remains available.

**4. `modules` is a warning, not an error.** The RFC says a namespaced
file "MUST declare" its modules. Shipped as `MOD-DEPENDENCY-UNDECLARED`
(warning): the document is well-formed, and a host that holds the module
reads it correctly. Making it an error would refuse a document that is
*readable by the reader in front of it*, which no other rule in this
format does.

**5. Resolution is not validation, and the two are kept apart.**
`validateUWFile` checks only what is true for every reader — the syntax
and the missing-`modules` obligation. Whether a class *resolves* depends
on the host's loaded modules, and folding that into validation would
make the same file valid or invalid depending on who ran it.
`MOD-FALLBACK-001` / `MOD-MISSING-001` come from `resolveAssetClass`, and
format spec §5 says explicitly that they are not validation rules.

**6. Holding a declaration is not holding the module.** Added because
the RFC's step 3 ("if the module is unavailable but a `fallback` is
declared") leaves open where the declaration comes from if the module is
gone. `resolveAssetClass` takes `knownDeclarations` separately from the
registry and will only ever *degrade* from them — never resolve. A
cached declaration gives a display name and a fallback; what "loaded"
means is the module's calculations and validations.

**7. `MOD-ASSET-CLASS-CONFLICT-001` is new.** The RFC covered display-name
conflicts (`MOD-DISPLAY-CONFLICT-001`, info) but not two modules
declaring the same *identifier*, which is the serious case: reverse-DNS
names one owner, so it means squatting, and picking one silently makes
resolution depend on load order.

**8. Conformance fixtures live in `conformance/modules/`**, not
`tier-1-reader/fixtures/`. This is module machinery, and it sits beside
the other module suites. Four document scenarios plus four manifest
rejections — and three of the four documents are **byte-identical**, with
only the host's loaded modules differing. A cross-scenario invariant
asserts that they stay identical, because the moment someone "fixes" a
failing scenario by editing its deal file, the demonstration that the
verdict depends on the reader and not on the document is void.

**9. Custom classes get no builtin pack, layout, or size intensive**, and
§X.2.4 says so. Wiring one into the §XIII registry would let a third
party change what `price_per_unit` divides by, which is where a silent
denominator change does the most damage.

The RFC's remaining unresolved question — whether the corpus should ship
a reusable fixture custom class — is answered yes, at
`conformance/modules/asset-classes/*/module.json`.

## Alternatives considered

1. **Open enum (any string accepted).** Rejected — loses determinism. Two hosts seeing `data_center` could mean different things; the namespacing rule fixes ownership at the identifier level.

2. **URI-style identifiers (e.g. `https://uwmd.org/asset-classes/data-center`).** Rejected — overspecified. URIs imply HTTP resolution semantics we don't want; reverse-DNS gets the namespacing benefit without that baggage.

3. **Subclass tree (e.g. `industrial.data_center`).** Considered. Solves the fallback problem implicitly (parent class is the fallback). Rejected because not all custom classes have a clean built-in parent — a life-sciences building isn't really a subclass of `office` or `industrial`. The explicit `fallback` field handles this case better.

4. **Modules can't declare new asset classes; spec bumps still required.** The status quo. Rejected — doesn't scale, see Motivation.

## Unresolved questions

- **Identifier squatting.** What stops `com.example.multifamily` from being declared? Recommend: `INVALID-ASSET-CLASS-002` if a custom identifier ends in (or matches) a built-in. The reserved names list should be checked against the full identifier, not just trailing segment.
- **Display-name conflicts.** Two unrelated modules could both declare `display_name: "Data Center"`. The host displays whichever module is loaded; if both are loaded, host policy decides. Recommend host emits `MOD-DISPLAY-CONFLICT-001` (info) when this happens.
- **Conformance corpus** — should it ship a fixture custom asset class for testing purposes? Recommend yes, under `conformance/fixtures/modules/` so it's reusable across tier-1/2/3 fixtures.

## Prior art

- **MIME types** — closed top-level types (`text`, `image`, …) plus open subtypes via the `vnd.*` and `prs.*` prefixes. Same shape: closed at the top, open below.
- **Reverse-DNS namespacing** — used by Java packages, Android intents, OSGi bundles. Mature, well-understood.
- **Schema.org extensions** — uses URI-style identifiers; their experience documents the cost of HTTP-resolvable identifiers (see Alternatives 2).
- **Linux Foundation TODO Group / SPDX** — manages a registry of license identifiers that's open to additions but maintains a canonical list. The closest analog to where we'd want a UW Markdown asset-class registry to live.
