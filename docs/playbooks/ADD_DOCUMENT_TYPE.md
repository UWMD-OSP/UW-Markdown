# Adding a document type

Use a document-purpose profile when independently attributable facts feed
underwriting figures or loan sizing, or another party needs those facts without
the original file. Start with the [catalog](../document-types.md). Reuse an
existing profile or a UWPart section when it already carries the whole meaning.
A PDF, a filename, a property class and a verification claim are different
choices; none alone calls for a new document profile.

## 1. The RFC

A new normative profile needs an RFC and acceptance under
[GOVERNANCE](../../GOVERNANCE.md). Existing acceptance is not supplied by this
playbook. State:

- Its purpose, intended reliance and boundaries; why current profiles do not fit.
- A lowercase opaque profile id, following `lease-abstract-v1` and
  `market-data-v1` (RFC0018/0022), and its independent version contract. Explain
  which later edits need a new profile version; do not silently change an id's
  meaning. Prelaunch work follows the prelaunch policy; postlaunch versioning
  follows [release rules](RELEASE_RULES.md).
- Exact identity, payload schema and carrier mapping. A profile marker in
  frontmatter or a package descriptor is not automatically a property inside a
  closed payload schema. Unknown purpose ids are preserved without interpreting
  them as a deal (RFC0018); verification-profile admission is a separate rule.
- A closed list of permitted groups and candidate destination sections/fields,
  with units, currency, periods and basis. State what is deliberately not mapped.
- Every proposed numeric operation and its already accepted convention. If a
  required formula or legal/financial choice is unspecified, leave it unresolved
  for acceptance; an extractor never invents it.

## 2. Source and lifecycle contract

- [ ] Require stable document/source identities and a locator for every material
  asserted fact, resolving to package evidence or an immutable external source.
  Preserve source bytes/digests and distinguish the source's date from extraction.
- [ ] Define missing, ambiguous and unreviewed facts without substituting zero,
  false or an invented assumption. If reusing lease term envelopes, use their
  exact `not_stated`, `ambiguous`, `not_reviewed` statuses only for null values;
  non-null terms carry a locator and no null status. A different envelope needs
  its own explicit accepted schema, not an assumed universal convention.
- [ ] Preserve conflicting sources as separate attributed assertions. Define an
  amendment's identity, governing-document link, effective date and supersede
  behavior. Keep existing append-only provenance and visible history rules;
  never choose the newest file by modification time or infer legal precedence.
- [ ] Distinguish executed documents, proposals, reports and amendments. Actor
  labels are descriptive provenance, not identity authentication or authority.
- [ ] Specify package member roles, typed `abstracts`/`contributes_to` or other
  existing registered links, byte and semantic digests, and unsupported handling.
  A new edge meaning needs its own contract; do not invent an alternate registry.

## 3. Projection and implementation

- [ ] Define any named section projection as explicit candidate edits, with an
  omission/conflict report and admitted inputs. Match meaning, units, dates and
  basis; never alias asking price to purchase price, a quote ceiling to a result,
  or an appraisal opinion to underwritten value.
- [ ] Specify the Lite projection and its losses, or explicitly state that none
  is available. Do not promise automatic import to a deal or every binding.
- [ ] Add the schema to `spec/schemas/` and its index; synchronize normative
  Format/Protocol text, executable contracts and public exports in one change.
- [ ] Implement standalone validation and typed refusal errors in `@uwmd/verify`,
  with exports through core and the browser-safe surface when applicable. Keep
  verifier dependency boundaries; add no network lookup to verification.
- [ ] Describe CLI, library, MCP, HTTP and independent-implementation support
  separately. Claim only the bindings and conformance actually supplied.

## 4. Evidence and completion

- [ ] Add synthetic examples with source snippets and exact locators, no personal
  or actual deal data. A source-note fixture is not evidence of legal authority.
- [ ] Add indexed conformance fixtures for clean values, every null status,
  missing locators, duplicate identities, conflicts, date/unit/basis mismatch,
  unsupported purpose handling and amendments. Test lossy projections and refusal
  behavior, not just the happy-path JSON schema.
- [ ] Prove package round trips, digest tamper refusal and source nonmutation.
  Prove Lite behavior if claimed. Distinguish structural validation, financial
  verification and authentication; a profile need not introduce calculations.
- [ ] Update catalog status only after acceptance and implementation; update the
  wiki, CHANGELOG and applicable capability manifests truthfully.

Before a PR, run build, workspace tests, test types, conformance, schemas, lint,
docs and the package/repository guards in AGENTS.md. No release, registry listing
or deployment follows automatically from a new document type.
