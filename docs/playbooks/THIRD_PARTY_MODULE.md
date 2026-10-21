# Third-party modules

Modules are how people outside the project extend UW Markdown without changing
the standard. Since RFC 0080, modules exist **only for third parties**: every
official asset class is a builtin ([Adding an official asset class](ADD_ASSET_CLASS.md)).

## What a module is

A module is a manifest (`spec/schemas/module-manifest.schema.json`, Protocol §X)
that can:

- declare its own asset classes (`declares_asset_classes`), each with a
  `fallback` builtin for readers without the module (Protocol §X.2);
- add sections, calculations, validations, thresholds and view models, for its
  own classes or to *enhance* builtin ones (`asset_classes`);
- depend on other modules (`depends_on`) and require a protocol, format and
  conformance tier.

Required members: `manifest_version`, `id`, `name`, `version`, `description`,
`authors`, `license`, `requires_protocol`, `requires_format` and
`requires_conformance`.

## Identity

- **Namespaced, reverse-DNS ids** you control, for the module and every class it
  declares (Format §2.2a): `com.example.datacenters`, `com.example.specialty_facility`.
- A declaration whose id is a builtin is refused: enhance a builtin through
  `asset_classes` instead. A namespaced id that only shadows a builtin name, such
  as `com.example.data_center`, is `INVALID-ASSET-CLASS-002`.
- Two loaded modules declaring one id is `MOD-ASSET-CLASS-CONFLICT-001`. Reverse
  DNS names one owner.

## How a reader resolves your class

Protocol §X.2.2 gives exactly three outcomes:

1. **Resolved.** The module is loaded, and the document is read fully.
2. **Degraded.** Only a declaration with a `fallback` is held. The host may
   render with the fallback's view models, must report the result as degraded,
   and emits `MOD-FALLBACK-001` (warning).
3. **Unresolved.** Neither is held: `MOD-MISSING-001` (error). The document's
   `modules` list tells the reader what to load.

## What a module class does not get

These limits are deliberate (Protocol §X.2.4, RFC 0080):

- **No builtin calc pack, so no receipts from one.** A module supplies its own
  calculations; anything it does not supply, the class does not have.
- **No size-registry row.** CC-13 and the CSV size columns do not apply, and
  builtin per-unit metrics do not compute. A third party must never change what
  `price_per_unit` divides by.
- **No defaults, so no `uwmd scope` cascade, and no Excel layout.**
- **No mixed-use component slot and no builtin stage overlays.**

If a class needs these, it should become official through an RFC.

## Signing and checking

- Sign a manifest with `signModule` from `@uwmd/signing`; a host verifies it
  with `verifyModuleSignature` from `@uwmd/verify` (Protocol §X.1). A signature
  identifies the signer. It does not say the module's rules are right (§X.1.5).
- `uwmd modules validate <manifest>` checks a manifest against the schema;
  `uwmd modules list` shows the registry a set of manifests forms.
- `conformance/modules/` (`accept`, `reject`, `asset-classes`, `registry`) shows
  manifests a host must accept and refuse.

## Governance

[GOVERNANCE.md](../../GOVERNANCE.md) governs modules maintained in this
repository only. A third-party module chooses its own governance, license and
release process.
