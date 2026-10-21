# Adding a non-property subject

A UW document describes a deal on a property. Its identity is a property's
identity: `property_address` is required (Format §2.2), `asset_class` is a
property class, and the section registry and metric dictionary are built on
property income. A record whose subject is not a property, such as a loan to an
operating company, does not fit any of that. It needs a **document profile**.

RFC 0082 (`borrower-underwriting-v1`, a senior term loan to an operating
company) is the worked proposal for this path. **It is a draft.** Until the
owner accepts it, none of its fields, sections or `BRW` codes exist in the
standard, and no implementation should emit or accept them.

## 1. Pick the right path

| The subject is | Path |
|---|---|
| A property type the standard does not know yet | [An official asset class](ADD_ASSET_CLASS.md) or a [third-party module class](THIRD_PARTY_MODULE.md) |
| A property, with figures the standard has no section for | `x_*` extension sections (Format §4.21), then an RFC if the figures should be verified |
| Not a property at all: no address, no asset class, cash flow that is not rent less expenses | A new document profile (this playbook) |

Two shortcuts do not work, and a record must not use them:

- **Inventing an address and a class.** The record is then false, and every
  NOI-based check reads the subject's figures as a property's.
- **A namespaced custom asset class** (RFC 0003). It is still an asset class,
  and the document still requires `property_address`.

Until a profile is accepted, the honest form of a non-property record is
`x_*` sections. They are surfaced but never verified, and the record should
say so.

## 2. The RFC

A new profile changes the format, the protocol and conformance, so it needs an
RFC (`docs/rfcs/0000-template.md`). It builds on the profile mechanism of
RFC 0018. RFC 0022's `market-data-v1` is the implemented precedent: a document
with no property identity, its own required fields and its own section.

The RFC states:

- **The profile id**, versioned (`<name>-v1`), and the subject it describes.
- **Identity.** The frontmatter fields the profile requires and the property
  fields that MUST be absent (RFC 0082: a `borrower` block is required;
  `property_address`, `asset_class`, `quick_metrics` and the other property
  fields are refused).
- **Sections.** The new sections with their fields, and which existing
  sections stay allowed, which are required, and which MUST NOT appear because
  they are defined over property income or value.
- **What does not apply.** A profile with no asset class gets no
  metric-dictionary entries, primary size, stage table or packs. The property
  checks that read a forbidden section are not evaluated. `CC-13` and `CC-14`
  are `skipped / not_applicable`, as they already are for every
  non-deal-underwriting profile.
- **Stated or derived, field by field.** Every derived figure has one
  normative definition. A producer whose agreement defines a figure
  differently MUST NOT state it under the profile's name; it can carry its
  own definition in an `x_*` section.
- **Verification.** A non-property profile cannot reuse the metric dictionary,
  which is keyed by asset class. It gets a separately invoked stated-figure
  verifier in the shape of Protocol §VIII.11 (RFC 0064). That verifier
  reproduces the document's figures from its own stated inputs and never
  projects, fills in or infers a figure (RFC 0078). Anything the standard has
  no convention for yet, such as RFC 0082's interest accrual, is listed as
  **not verified** rather than checked against one producer's convention.
- **The code family** (RFC 0082: `BRW-NN`), its owner and severity, and which
  codes are validator findings and which are verifier findings.
- **Versions.** A new profile is additive, so the format version stays the
  same. The protocol takes a minor version when it adds required Verifier
  behavior. No version label is set in the RFC; the maintainers set it at
  release preparation.
- **Representations.** Say what UW XML, Excel, UW Lite and the CSV bundle do
  with the profile. Excel must keep calc parity for every verified figure
  (invariant 4). A representation that cannot carry the profile refuses it with
  a typed error rather than producing a property summary.

The RFC also cites adopter evidence where it exists, and is clear that the
evidence is not owner acceptance.

## 3. The implementation, after acceptance

The implementation lands as one PR. Paths are the reference
implementation's, following the `market-data-v1` precedent.

**Format and protocol**

- [ ] `spec/UW_FORMAT_SPEC.md`: the profile's identity rules, its sections in
  Part IV, and its codes in Part V.
- [ ] `spec/UW_PROTOCOL.md`: the code family registration (§III.6a), the
  Reader's required fields per profile (§II.1), and the verifier's section
  (§VIII).
- [ ] `spec/schemas/uw-<profile>.schema.json` and any verification-result
  schema, indexed in `spec/schemas/README.md`.

**Reader, validator and verifier** (`packages/uwmd-verify/src/`)

- [ ] `protocol.ts`: the profile id constant beside
  `DEAL_UNDERWRITING_PROFILE` and `MARKET_DATA_PROFILE`, plus the code registry
  and remediation entries.
- [ ] `<profile>.ts`: the profile's parsing, its structure rules and its
  verifier, as `market-data.ts` does for RFC 0022. It is exported from the
  package and the browser entry.
- [ ] `validator.ts`: the frontmatter and section rules beside the `CC-13` and
  `CC-14` profile preconditions. A deal-underwriting document's findings must
  not change.

**Tools and representations**

- [ ] The CLI command for the verifier (`packages/uwmd-core/src/cli.ts`), with
  §VIII.11's exit codes.
- [ ] `packages/uwmd-excel`: the sections with live formulas in both
  directions, and parity tests for every verified figure.
- [ ] The Lite bridge's typed refusal, and the web editor's handling of the
  profile.

**Independent implementation**

- [ ] `implementations/python`: the same structure rules and verifier, green
  under the portable runner.

**Evidence**

- [ ] A worked example in `examples/` (RFC 0022's lesson: a profile ships with
  an instance).
- [ ] A named conformance suite: valid cases, one reject case per structure
  rule, one failed case per verifier check, and an unverifiable case.
- [ ] A case showing that an existing deal-underwriting fixture's findings are
  byte-identical with the profile implemented.
- [ ] Rows in `conformance/corpus-index.json` for every new case.

**Docs and records**

- [ ] The wiki pages the profile touches, the wiki status page and
  `CHANGELOG.md`.

## 4. Done means

```bash
npm run build && npm test && npm run conformance
npm run validate-schemas && npm run lint && npm run verify-indexes
cd implementations/python && python -m unittest -q
```

All green. The example verifies. Every figure the RFC lists as not verified is
reported that way and never as verified. The RFC's Decisions table matches what
shipped.
