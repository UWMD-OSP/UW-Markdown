# Roadmap

UWMD grows through explicit, testable contracts for commercial real-estate
underwriting records. The [foundation](docs/FOUNDATION.md) describes what exists;
[How UWMD grows](docs/HOW-UWMD-GROWS.md) explains how to extend it. This page
describes directions rather than delivery dates or release prerequisites.

## Current foundation

The standard has Format 3.0, Protocol 4.1.0, a metric dictionary, complete
tagged Envelope 2.0 representations and Reader/Verifier conformance tiers.
Twelve official property classes have full builtin support. The independent
Python implementation covers the base Verifier; optional profiles need their
own implementation and evidence.

The reference toolkit supplies authoring, verification, representations,
receipts, signing, workbooks, reporting and collection projections. Bounded
pro-forma verification is available through the CLI and public library.
Loan-quote, offering-memorandum and appraisal fact profiles expose attributable
facts and read-only candidates through the library and complete Lite views;
their fact-operation CLI/MCP/HTTP bindings and Lite compilation are unsupported.
Read the [document catalog](docs/document-types.md),
[source-fact scope](docs/document-facts.md) and [known limits](docs/KNOWN-LIMITS.md).

Current source can contain changes absent from an older npm artifact sharing
its package version. Pin the actual source/artifact and inspect build identity.
[VERSIONS](VERSIONS.md) records publication state and package pairings.

## Growth paths

### Official property types

Add complete asset classes when the standard needs their meaning. Each official
class gets sections, dictionary metrics, a pack, size registry, defaults,
an example and Excel parity. Modules remain the extension path for third parties.
Follow [ADD_ASSET_CLASS](docs/playbooks/ADD_ASSET_CLASS.md).

Property interests, redevelopment transitions and other class boundaries should
be described explicitly rather than inferred from marketing names or subtypes.
Known-limit issues provide concrete inputs for those future contracts.

### Dictionary metrics

Extend the dictionary with exact inputs, formulas, units, null behavior and
comparison precision. Keep ids stable in meaning and distinguish two financial
definitions with different ids. A numerical convention needs an accepted
decision and deterministic vectors before implementation.
Follow [ADD_METRIC](docs/playbooks/ADD_METRIC.md).

### Source documents and attributable facts

Expand the [document catalog](docs/document-types.md) where an independently
relied-on document purpose needs its own admitted facts, locators and lifecycle.
Keep source statements, marketing claims, appraised opinions and adopted deal
inputs distinct. Missing evidence stays missing; candidate edits remain reviewable.
Follow [ADD_DOCUMENT_TYPE](docs/playbooks/ADD_DOCUMENT_TYPE.md).

Bindings for existing fact profiles and additional document families can follow
with their own complete admission, conflict, projection and conformance work.
A listed planned family is not an implemented capability.

### Non-property subjects

Develop explicit subject identity and applicable sections for records whose
subject is not a property. Borrower underwriting (RFC 0082) remains a draft;
do not invent a property address to satisfy property validation.
Follow [NON_PROPERTY_SUBJECT](docs/playbooks/NON_PROPERTY_SUBJECT.md).

### Third-party extensions

Use namespaced modules or `x_` extensions for meaning outside the builtin
contract. Preserve base semantics and make unresolved capability visible.
Official adoption remains a separate standards decision.
Follow [THIRD_PARTY_MODULE](docs/playbooks/THIRD_PARTY_MODULE.md).

### Conformance profiles and independent implementations

Add finite, testable claims with explicit required and optional obligations.
Keep the base Reader/Verifier requirements intact. Independent implementations
can add optional profiles once their own cases and capability claims are proved.
Follow [ADD_CONFORMANCE_PROFILE](docs/playbooks/ADD_CONFORMANCE_PROFILE.md).

### Verification procedures

Extend bounded verification for explicitly stated relationships, financing and
returns as the necessary conventions are accepted. Levered and after-tax
assertions need their own financial conventions; their names alone define none.
Lease projections, payoffs, draw interest and holdback releases remain explicit
growth boundaries in the known-limits list.
Follow [ADD_VERIFICATION_PROFILE](docs/playbooks/ADD_VERIFICATION_PROFILE.md).

Representations and transport bindings carry existing models or operations.
They need their own fidelity, refusal and conformance contracts. Starter-product
usability improvements follow reproducible authoring and verification findings.

## How work lands

Start with a small synthetic example and identify the missing meaning or
incorrect check. Reuse an existing field, section, profile or representation
where it already expresses the need. Normative work follows the RFC process
with synchronized specification, schema, implementation and conformance changes.
Update the catalog, playbooks and capability claims to match tested support.

Scope follows completeness; adopter needs help prioritize it. Maintenance follows
filed issues. Growth does not require an adoption count, a particular producer,
a hosted service or use of the starter toolkit.

## Release boundary

5.0.0 remains the separately approved official launch, with every `@uwmd`
package moving together. Prelaunch releases use 4.x with no backward-compatibility
obligation. Format and Protocol remain separate contract streams.
Postlaunch commitments are the existing
[release rules](docs/playbooks/RELEASE_RULES.md). This roadmap authorizes no
release, publication, deployment, listing or repository/account setting change.
