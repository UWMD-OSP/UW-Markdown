# Governance

UW Markdown is currently an owner-led open-source project. The rules below keep
solo development fast while defining the protections that apply if other people
begin contributing.

## Current mode: owner-led development

The project owner is [jaredmaxey](https://github.com/jaredmaxey). While the owner
is the only contributor actively maintaining the project, the owner may:

- change code, specifications, schemas, tests, documentation, and release plans
  directly;
- accept and implement an RFC immediately;
- merge owner-authored pull requests without a waiting period or separate
  approval; and
- cut releases when the applicable automated checks pass.

RFCs remain useful design records, but there is no mandatory public-comment
window in owner-led mode. No waiver is required for an owner decision.

## External contributions

An external contribution is work submitted by anyone other than the project
owner. External contributions are welcome and use pull requests.

Every external pull request requires owner review before merge. The owner may
request changes, accept the contribution, or decline it. Contributors agree that
merged work is licensed under the repository's MIT License.

The collaborative rules below activate automatically after the first external
pull request is merged. The owner may activate them earlier by updating this
file.

## Collaborative mode

Once collaborative mode is active:

### Editorial and implementation changes

Typo fixes, clarifications with no normative impact, tests, refactors, bug fixes,
and implementations of already-accepted designs require:

- a pull request;
- passing applicable automated checks; and
- one maintainer approval.

### Normative changes

A normative change alters what a conforming implementation must do, including
MUST/SHOULD requirements, standard fields, schemas, calculation grammar,
conformance expectations, or breaking public API changes.

A normative change requires:

- an RFC in `docs/rfcs/`;
- a public comment period of at least 14 days;
- project-owner approval; and
- a reference implementation in the same pull request or a linked follow-up.

The owner may extend the comment period when outside implementations need time
to evaluate the change. Emergency security fixes may be merged immediately and
documented afterward.

## Roles

### Project owner

The project owner has final authority over scope, normative decisions, releases,
maintainer appointments, and disputed pull requests.

### Maintainers

Maintainers have commit or review authority for areas listed in
[`MAINTAINERS.md`](./MAINTAINERS.md). A maintainer may be appointed by the owner
after demonstrating sustained, constructive work on the project.

### Contributors

A contributor is anyone whose external pull request has been merged. Contributors
may propose RFCs, review designs, implement tools, and participate in project
discussion.

## Disputes

Discussion happens in the relevant issue, RFC, or pull request. The project owner
makes the final decision when consensus is not reached and records a short
rationale.

## Conformance corpus

The conformance corpus is normative. In collaborative mode, changes that alter
expected conforming behavior follow the normative-change process. A new fixture
that only demonstrates already-specified behavior follows the ordinary pull
request process.

## Modules

This document governs modules maintained in this repository. Third-party modules
choose their own governance.

## License

The project is MIT licensed. A license change requires project-owner approval
and any contributor permissions legally required for the affected work.

## Amendments

In owner-led mode, the owner may amend this document directly. In collaborative
mode, amendments use the normative-change process.