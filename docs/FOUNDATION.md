# The UWMD foundation

UWMD is an open record format and verification standard for commercial
real-estate underwriting. A producer supplies facts and assumptions. A verifier
checks the stated assertions using explicit inputs and accepted procedures.
UWMD does not decide which deal to buy, price missing assumptions or produce an
underwriting judgment. The starter tools help people author and inspect records;
an independent implementation can use the standard without those tools.

## The record and its representations

A full `.uwx.md` record combines readable narrative with structured sections,
identity, provenance and visible revision history. The
[Format](../spec/UW_FORMAT_SPEC.md) defines their meaning. A record declares its
Format version; it does not declare the npm package version that wrote it.
Current source reads Format 3.0 and Protocol 4.1.0; [VERSIONS](../VERSIONS.md)
maps those contracts to package releases.

UW Lite (`.uw.md`) is a constrained human-readable summary. Its projections are
explicitly lossy; compiling a summary cannot recover omitted facts. JSON, XML
and CSV-bundle representations carry the Document Envelope model under their
own mapping contracts. Whole-model canonicalization identifies that model;
Lite financial subjects, raw source bytes and an envelope digest are distinct
scopes. Pick a representation for its documented fidelity, not its extension.

A [document-purpose profile](document-types.md) distinguishes a deal from an
abstract, source note or market observation set. An unknown purpose id is
preserved without treating it as a deal. This is different from claiming an
optional verification procedure that the verifier does not implement.

## What verification establishes

The [Protocol](../spec/UW_PROTOCOL.md) has two base conformance tiers:

- A **Reader** handles the declared format, admitted structure, provenance,
  identity and required preservation/refusal behavior.
- A **Verifier** also reproduces the required stated financial assertions,
  integrity and receipt checks under their explicit contracts.

Optional conformance/verification profiles add bounded obligations. A capability
manifest describes what an implementation actually claims. A zero exit alone
is not a count of checked assertions: inspect failed, unavailable and unchecked
coverage. Missing inputs stay unavailable, not invented zeroes. A source
locator establishes traceability, not the source's accuracy or legal authority.

The metric dictionary defines builtin metric ids by class, explicit input paths,
formula, units, null behavior and comparison precision. Comparison follows the
accepted binary64 and one-time quantization rules. A producer can use a different
model, but cannot place a different meaning under a builtin metric name and
expect it to verify. New conventions require their own accepted contract.

## Integrity, signatures and receipts

Block integrity and document snapshots identify their specified canonical
subjects. Signatures authenticate those subjects against supplied keys.
[Receipts](../spec/UW_RECEIPT.md) pin the subject, inputs, engine and results
needed by their verification contract. These mechanisms do not certify that a
lease is enforceable, a source is true, a signer is a particular person or a
future projection will occur. Keep descriptive actor provenance separate from
authentication and source-namespace authority rules.

## Composition and packages

[UWPart fragments](../spec/UW_COMPOSITION.md) let a record keep a section in a
separate file while preserving the resolved semantic subject. Composite records
can link child records under the stated resolution/collection rules.
[Deal packages](rfcs/0018-document-profiles-and-deal-packages.md) inventory
records and evidence with digests and typed links. Their JSON context view is a
bounded view, not a complete archive and not arbitrary source-file ingestion.
Portfolio sidecars describe cross-record entities and relationships; they do
not make a portfolio aggregation policy implicit.

## Implementations, conformance and tools

The reference TypeScript implementation is `@uwmd/verify`. It has no dependency
on another `@uwmd` package. `@uwmd/core` re-exports it and adds the starter toolkit.
The independent standard-library Python implementation claims the **base
Verifier**, with its own portable conformance evidence; it does not claim the
TypeScript implementation's optional profiles.

The [conformance corpus](../conformance/README.md) contains synthetic fixtures,
expected reports and portable drivers. Passing a finite corpus establishes the
specified cases and claim, not every possible document. CI keeps required
source tests and conformance checks running as the implementation changes.

The toolkit includes a CLI, deterministic calc packs, generic editing APIs,
Lite/representation conversion, signing, receipts, Excel/CSV output, batch and
lake projections, viewer/editor tooling and a local validation/verification MCP
connector. The lake plans projections without supplying a database driver.
There is no required hosted service or vendor runtime. A skill helps an agent
write attributable records; it does not let the agent invent financial math.

RFC0092 pro-forma support is scoped to the reference CLI and public library,
with independent proof frozen at source e2bd0067 through issues #551/#552. No
pro-forma MCP/HTTP binding is claimed. The required Main CI profile gate guards
subsequent source. See [the precise binding/runtime limits](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/wiki/03-core-library.md#rfc-0092-support-scope).
Current source can contain functionality absent from older npm code sharing its
package version; pin the actual source/artifact when relying on source evidence.

## What the 5.0 policy commits to

The official5.0 launch is still separately gated. The following restates the
existing [release rules](playbooks/RELEASE_RULES.md) and
[version policy](../VERSIONS.md); it does not launch or change a version:

- Every `@uwmd` package launches at 5.0.0 and then shares the public UWMD number.
  Format and Protocol remain separate contract streams; VERSIONS maps releases.
- Public API/CLI/normative breaking changes use a major. Additions and fixes
  changing computed results use a minor; patches change neither contract nor
  computed result. Result-changing fixes identify affected metrics.
- A metric id keeps its meaning; a different meaning gets a different id.
  Validation codes are not renumbered or reused.
- Each record's declared Format selects its rule set. Every 5.x Verifier retains
  earlier 5.x rule sets. Outcome-changing fixes receive a new Format minor;
  stricter security/soundness fixes are the stated exception across retained
  rule sets (accepted RFC0111, Protocol§XII.5).
- After launch, the published deprecation minimum is one minor and 90 days before
  a breaking removal, with the documented security exception. Governance and
  release approval still apply.

These are postlaunch commitments. Before 5.0 there is no backward compatibility
obligation, migration plan or artifact-repair promise. No release, publication,
hosting or registry listing is authorized by this page.

## What is deliberately not promised

There is no promise of source truth, legal/tax/regulatory suitability, credit
approval, investment performance, a complete underwriting model, unlimited input
size, automatic source conflict resolution, every jurisdiction or every binding.
A future/planned document type is not implemented by naming it. Draft RFCs are
not standards. Starter defaults and display conventions do not silently become
normative verification rules. The toolkit is not a hosted underwriting product.

Maintenance follows filed issues; the release process is not a promise to ship
a new feature every month. There is no adoption target or usage SLA. Read the
[current known limits](KNOWN-LIMITS.md), and use the
[growth paths](HOW-UWMD-GROWS.md) to propose a concrete missing contract.
