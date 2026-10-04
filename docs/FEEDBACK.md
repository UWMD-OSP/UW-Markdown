# Reporting problems and feedback

This guide is for anyone who produces or consumes UW Markdown: products that
export `.uwx.md` records, independent implementations of the protocol, and
people using the reference packages directly. It explains how to report a
problem so a maintainer can reproduce it, how to keep confidential deal data
out of public issues, and how to follow a report through to a fix, a release or
an RFC.

Reports from adopters are requirements evidence. They decide where the format
and protocol go next. A report is not a contract, though: what UWMD requires is
still decided through the [RFC process](../docs/rfcs/README.md).

## Where to report

| You have | Use |
|---|---|
| A security vulnerability, including a crafted document that hangs or crashes a parser | Email **security@uwmd.org** ([SECURITY.md](../SECURITY.md)). Never a public issue. |
| A UWMD package, CLI command, tool or conformance fixture that does not do what the spec says | [Bug or interoperability report](https://github.com/UWMD-OSP/UW-Markdown/issues/new?template=bug.yml) |
| Two implementations that read, accept or compute the same document differently | [Bug or interoperability report](https://github.com/UWMD-OSP/UW-Markdown/issues/new?template=bug.yml) |
| Spec text that is unclear, contradicts a schema or itself, or is silent on a case | [Spec question or ambiguity](https://github.com/UWMD-OSP/UW-Markdown/issues/new?template=spec-question.yml) |
| Something you need to express, verify or do that has no home | [Capability request](https://github.com/UWMD-OSP/UW-Markdown/issues/new?template=feature.yml) |
| A ready-made normative proposal | An RFC pull request ([process](../docs/rfcs/README.md)). Opening an issue first is fine. |

If you're unsure which form fits, pick the closest one. Triage moves a
misfiled report to the right category.

## What to include

The forms ask for these items. Each one exists because a maintainer can't
reproduce or classify the report without it.

- **Your implementation and its version.** Give the product or tool that hit
  the problem, with a version or commit. When you vendor or pin UWMD packages,
  that version and the UWMD version can differ, and both matter.
- **UWMD versions.** `npx @uwmd/cli manifest` prints the
  @uwmd/core version and the Protocol and Format versions it implements. An
  independent implementation exposes its own manifest under Protocol §II.6a. A
  document's Format version is its `uw_version` frontmatter (`uw_lite_version`
  for Lite). Documents do not carry a Protocol version, so report the one your
  implementation runs.
- **Where the spec says so.** Cite the section, schema property or conformance
  fixture that requires the behavior you expected. That citation is what
  separates a bug from a spec question (see
  [Does it need an RFC?](#does-it-need-an-rfc)).
- **A minimal reproduction.** Give the smallest document, calc declaration,
  edit operation or plan that shows the problem, and the exact commands to run.
- **Diagnostics.** `uwmd validate <file> --json` and `uwmd verify <file> --json`
  print the issue codes. Codes carry a registered family prefix (Protocol
  §III.6a), so `CF-02` or `CALC-XIRR-DIVERGE` tells a maintainer more than the
  message does. For a disputed number, a receipt of the *synthetic*
  reproduction (`uwmd receipt issue`) records the pack, engine and protocol
  versions and the computed results. For a conformance disagreement, the
  language-agnostic runner's `--manifest-out` report lists each case result
  ([runner](../conformance/runner/README.md)).
- **Your own tracker ID.** If your team tracks upstream problems with its own
  ID, such as an `UPSTREAM-NNN`, put it in *Related links*. The fix, the
  CHANGELOG entry and any RFC can then cite it, and both sides can find the
  same history.

## Keeping deal data out of public issues

Issues on this repository are public and indexed, and an issue's edit history
is public too. Assume anything you post can't be fully withdrawn.

**Real deal data is validation evidence, not public material.** A document
derived from a real transaction does not belong in an issue, and it does not
enter the conformance corpus. When a report leads to a new fixture, the fixture
is synthetic: invented inputs that reproduce the behavior, never a private
deal's amounts.

To turn a confidential document into a public reproduction:

1. **Find the smallest failing piece.** Remove every section the problem does
   not need, then every field. Re-run after each cut. Most reproductions need
   one to three sections.
2. **Replace identity.** Change `deal_id`, property and party names, addresses,
   tenant names, loan numbers and file names to placeholders.
3. **Replace amounts.** Use round invented figures that still trigger the
   problem. If it depends on a specific value, such as a boundary date or a
   rounding edge, keep only that value and say why.
4. **Check `_meta` and notes.** Provenance can carry actor and agent IDs,
   internal user names, notes, `market_data_ref` values and timestamps. Strip
   them or replace them with placeholders.
5. **Check the output too.** Validation messages, `value` fields, receipts and
   rendered output repeat document figures. Post output from the reduced
   document, not from the original.
6. **Re-run on the reduced document** and confirm it still reproduces before
   you post.

If the problem won't reproduce without confidential data, say so in the issue.
Describe the structure instead: which sections and fields are present, their
types and shapes, the codes emitted, and the versions. A maintainer will work
with you on a synthetic reproduction. To show that later reports concern the
same private input without sharing it, you can post its SHA-256 digest
(`sha256sum deal.uwx.md`), or the `subject.digest` of a receipt. Don't post the
receipt itself, because it contains the computed figures.

If confidential data does end up in an issue, tell a maintainer. Comment
revisions can be deleted from edit history, and the owner can delete an issue.

## What happens next

Every report moves through the same steps:

```text
received → triage → reproduced and classified → decision → fix, RFC, docs or workaround → released → closed
```

Status is visible on the issue itself: its open or closed state, its labels,
maintainer comments and the pull requests and RFCs linked in its timeline.
Label changes do not send notifications, so **every change of state also gets
a comment** that says what changed and what happens next.

| State | How it shows on the issue |
|---|---|
| Received | Open, labelled `needs-triage` |
| Needs information | `needs-info`, with a comment listing exactly what is missing. Replying with it puts the report back in triage. |
| Reproduced | `reproduced`, with a comment naming the commit and command used |
| Working as specified | Closed as *not planned*, labelled `working-as-specified`, with the section that requires the behavior. If the spec could be clearer, a `documentation` follow-up may be opened. |
| Accepted as a defect | Open, classified as `bug`, `drift`, `conformance-gap` or `documentation` |
| Needs a normative change | `needs-rfc`. The RFC links the issue, which stays open until the RFC is accepted, decided or rejected. |
| Fixed on `main` | Closed as *completed* by the pull request that fixed it, linked in the timeline |
| Awaiting release | The closed issue keeps `awaiting-release` while the fix sits in a package or Protocol version that has not shipped. Documentation and site fixes go live on merge and skip this step. |
| Released | `awaiting-release` is removed, with a comment naming the released version and its [CHANGELOG](../CHANGELOG.md) entry |
| Rejected or out of scope | Closed as *not planned*, labelled `wontfix`, `adopter-specific` or `duplicate`, with the reason |

The project has a single maintainer and makes no response-time commitment for
ordinary issues. Security reports have the acknowledgement commitment in
[SECURITY.md](../SECURITY.md).

## Labels

After triage, a report carries one **category** label, plus `needs-rfc` when
resolving it changes what conforming implementations must do. While
`needs-triage` is present, the category is the one set by the form you chose.

| Label | Meaning | RFC? |
|---|---|---|
| `bug` | The implementation departs from behavior the spec already requires. | No |
| `drift` | Spec, schemas, `protocol.ts`, implementation or conformance corpus disagree with each other. | No, when clear spec text settles it and the stray artifact is brought back to it. Yes, when the text doesn't say which one is right. |
| `conformance-gap` | The behavior is specified, but the corpus does not pin it, so a wrong implementation could still pass. | No (governance: a fixture for already-specified behavior is an ordinary PR) |
| `documentation` | Documentation is wrong or missing. Behavior is unchanged. | No |
| `spec` | A spec question the form set, which triage always replaces with a category. | Not decided yet |
| `spec-ambiguity` | The text supports more than one conforming reading. | Yes, if implementations follow different readings (see below) |
| `enhancement` | A requested capability. | Only with `needs-rfc` |
| `adopter-specific` | The behavior belongs to the reporting implementation, not to UWMD. | No; usually closed |
| `needs-rfc` | Resolving the report changes what a conforming implementation must do. | Yes |

**Status labels:** `needs-triage`, `needs-info`, `reproduced` and
`awaiting-release`. **Closing labels:** `working-as-specified`, `duplicate`
and `wontfix`.

The labels and their descriptions are defined in
[`.github/labels.json`](../.github/labels.json). A workflow creates and updates
them from that file when it changes on `main`, and `npm run verify-issue-forms`
checks that the forms, this guide and that file agree.

## Does it need an RFC?

The test comes from [GOVERNANCE.md](../GOVERNANCE.md): **does resolving the
report change what a conforming implementation must do?** Changes of that kind
touch MUST/SHOULD requirements, standard fields, schemas, calc grammar,
conformance expectations or breaking public API.

- **No: it restores already-specified behavior.** Fixing an implementation
  bug, adding a fixture that pins existing requirements, correcting
  documentation, and bringing a stray artifact back in line with clear
  normative text all go through an ordinary pull request. Recent examples are
  the early-year day-count fix (Protocol §VIII.9.1 already said proleptic
  Gregorian), the RFC 0066 fixtures that a fence-order reader used to pass,
  and the 2.3.0 implementation-manifest schema, whose `required` array
  contradicted §II.5's clear text ("the spec wins").
- **Yes: it changes the contract.** That covers a new field or code, a changed
  severity or result, or a new calc behavior. It also covers picking one
  reading of ambiguous text when conforming implementations follow different
  readings, and settling a disagreement between normative artifacts when the
  text doesn't say which one is right. Each of these gets `needs-rfc`, and
  maintainers don't change the spec until an RFC is accepted.

The report's evidence (versions, reproduction, readings, who is affected)
becomes the RFC's Motivation, and the RFC links the issue.

## Triage, for maintainers

1. **Screen.** If the report discloses a vulnerability, move it to the
   [SECURITY.md](../SECURITY.md) process and remove the details from the
   issue. If it contains confidential deal data, delete the content and its
   revisions, and ask the reporter for a reduced reproduction.
2. **Check completeness.** If versions, a spec citation or a reproduction are
   missing, add `needs-info` and comment with the specific items.
3. **Reproduce on current `main`.** Use the reporter's versions as well when
   they differ. Comment with the commit and command, and add `reproduced`.
   If it doesn't reproduce, say what you ran.
4. **Classify.** Keep or replace the category label so exactly one remains,
   and decide `needs-rfc` with the test above. Remove `needs-triage` and
   comment with the classification and the next step.
5. **Resolve.** Link the fixing pull request with `Fixes #N`. If the fix is
   to a package or Protocol version that has not shipped, add
   `awaiting-release` when the issue closes. For a normative change, open
   the RFC and cite the issue and the reporter's tracker ID in its
   Motivation.
6. **Close the loop at release.** When a release ships, search
   `is:issue is:closed label:awaiting-release`. Comment on each with the
   version and its CHANGELOG entry, then remove the label.

## Why there is no machine-readable report format

UWMD does not define a feedback or bug-report envelope, and it doesn't need
one yet. A report's reader is a maintainer, not another implementation, so
there is no interoperability contract to standardize. The facts a report needs
already exist as normative, machine-readable outputs: the implementation
manifest, validation results with registered codes, `ProtocolError`, receipts
with input and result digests, and the conformance runner's report. The forms
ask for exactly those outputs. The evaluation behind this decision, and the
evidence that would reopen it, is recorded in the
[adopter feedback review](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/reviews/2026-10-04-adopter-feedback-loop.md).
