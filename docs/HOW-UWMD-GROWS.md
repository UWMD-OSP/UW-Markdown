# How UWMD grows

Start with the meaning you need to exchange or check. Reuse a current field,
section, representation or profile when it already expresses that meaning.
A new filename, product workflow or property marketing label does not by itself
need a new standard. See the [foundation](FOUNDATION.md),
[document catalog](document-types.md) and [known limits](KNOWN-LIMITS.md).

The standard's growth paths are below. Maintainers review implementation;
[governance](../GOVERNANCE.md) controls acceptance of normative RFCs. In current
owner-led mode the owner accepts them. Collaborative mode adds the published
comment/review process. A third-party extension's author controls that
extension, but cannot declare it an official builtin or silently redefine the
base standard. A draft proposal is not an implemented capability.

| Need | Use this path | Who decides and the playbook | What the path preserves |
|---|---|---|---|
| A new official property type | Official asset class | Accepted RFC; [ADD_ASSET_CLASS](playbooks/ADD_ASSET_CLASS.md) | Every official class gets the full builtin kit: sections, dictionary, pack, defaults, example and Excel parity. Descriptive subtype/scenario never selects calculations. |
| A financial figure or a different definition | Dictionary metric | Accepted RFC with exact convention and vectors; [ADD_METRIC](playbooks/ADD_METRIC.md) | Explicit class/id, inputs, units, nulls and comparison precision; no inferred input or unstated numerical choice. |
| Independently relied-on facts from a different document purpose | Document profile | Accepted RFC; [ADD_DOCUMENT_TYPE](playbooks/ADD_DOCUMENT_TYPE.md) | Source identity/locators, missing/conflict semantics, lifecycle and explicit contribution to record sections. A profile is not a new asset class or pack. |
| A subject that is not a property | Non-property document profile | Accepted RFC; [NON_PROPERTY_SUBJECT](playbooks/NON_PROPERTY_SUBJECT.md) | Honest subject identity and its own admitted sections/checks; do not invent a property address to pass property validation. RFC0082 is still draft. |
| Private or third-party meaning outside the builtin contract | Namespaced module or `x_` extension | Its author defines the extension; official adoption needs review; [THIRD_PARTY_MODULE](playbooks/THIRD_PARTY_MODULE.md) | Existing base semantics and explicit unresolved/degraded capability reporting. Preserving an unknown fact is not verifying it. |
| A finite testable claim about a subset of obligations | Conformance profile | Accepted normative scope plus synchronized runner/manifest work; [ADD_CONFORMANCE_PROFILE](playbooks/ADD_CONFORMANCE_PROFILE.md) | Base Reader/Verifier obligations, explicit selected cases and truthful required/optional coverage. |
| A new optional procedure that checks stated relationships | Verification profile | Accepted RFC with deterministic procedure and refusals; [ADD_VERIFICATION_PROFILE](playbooks/ADD_VERIFICATION_PROFILE.md) | Explicit admission, conventions, dependencies, report/exit contract and source nonmutation. No host-specific model or automatic underwriting decision. |

A new representation or transport binding carries an existing model or operation.
It needs its own normative mapping and conformance rather than a new financial
meaning. Use the [Envelope](../spec/UW_ENVELOPE.md),
[representation specs](../spec/UW_XML_MAPPING.md) and
[binding index](../spec/bindings/README.md) as precedents; keep fidelity and
unavailable behavior explicit.

## From an issue to a working contract

1. Show the smallest synthetic input and the missing meaning or incorrect check.
   Identify the current section/profile and exact observed behavior.
2. Follow the matching playbook. A new financial convention needs an explicit
   choice before code or expected numbers; cite existing text when it already
   settles the question. Do not infer a convention from a field's name.
3. For a normative change, write an RFC with a decision table, spec/schema and
   executable contract changes, fixtures and a reference implementation plan.
   The acceptance process is separate from a successful build.
4. Ship the accepted contract, implementation, conformance and usable examples
   together. Verify source bytes/model nonmutation, negative cases, limits and
   every claimed binding. Update capability claims only after the proof exists.
5. Keep the catalog, playbooks, CHANGELOG and version mapping current. A planned
   family is a growth route, not a delivery date or a promise of support.

## Current growth boundaries

The loan-quote, offering-memorandum and appraisal profiles in draft RFC0129 are
proposals. Borrower underwriting (RFC0082) and ground-lease tenure (RFC0067)
remain drafts too. Source notes and package evidence can preserve unsupported
facts while a contract is designed; they must not imply that an implementation
checked those facts. The [known-limits page](KNOWN-LIMITS.md) links concrete
follow-ups for interests, lease projections, payoffs and other boundaries.

UWMD is maintained through filed issues. Growth does not depend on reaching an
adoption count and does not require every adopter to use the starter products.
The postlaunch stability commitments are the existing
[release rules](playbooks/RELEASE_RULES.md), not an open-ended roadmap guarantee.
Until the separately approved 5.0 launch, the current prelaunch 4.x rule applies.
