# Adopter feedback loop: intake, triage and the case against a report envelope

Review date: **2026-10-04** (America/Phoenix). Status: **implemented on
branch `claude/adopter-feedback-loop`. Process and tooling only.** No Format,
Protocol, schema, conformance, calc or financial-semantics change.

The adopter-facing result is [Reporting problems and feedback](../FEEDBACK.md).
This record keeps the inventory, the drift found, and the evaluation behind
the decision **not** to define a machine-readable feedback envelope.

## Starting point

Reconciled against `main` at `510329b` (equal to `origin/main`). Format 2.0,
Protocol 2.21.0, core/CLI 2.17.0.

### Intake mechanisms that already existed

| Mechanism | State |
|---|---|
| `.github/ISSUE_TEMPLATE/bug.yml`, `feature.yml`, `spec-question.yml` | Present, and named correctly by CONTRIBUTING.md, but only partly functional (below) |
| `.github/ISSUE_TEMPLATE/config.yml` | Absent. Blank issues were enabled, and nothing steered a vulnerability away from a public issue. |
| Repository labels | GitHub's nine defaults only |
| Security reporting | SECURITY.md: email `security@uwmd.org`, 5-business-day acknowledgement. GitHub private vulnerability reporting is **disabled**. |
| GitHub Discussions | Disabled. The public RFC comment venue is still an open owner decision ([handoff](../handoff/HUMAN-public-rfc-venue.md)). |
| PR template | Present. It said "Link the issue this resolves", without saying how. |
| Issues filed | One ever (#146, closed). |
| StackUW findings | Reached the repo as owner-relayed briefs and re-vendor findings carrying StackUW's own IDs (`UPSTREAM-002`…`UPSTREAM-021`). Those IDs are cited in the CHANGELOG, RFCs 0032/0037/0038/0066/0069, and test names. None went through an issue. |

### Drift found

1. **Three of the five labels the forms applied did not exist.** `needs-triage`
   (bug and feature forms), and `spec` and `needs-discussion` (spec form).
   GitHub drops a form label that doesn't exist without an error, so every
   report would have arrived unlabelled. A guard run against `main`'s forms and
   the live label list reports exactly these four applications.
2. **The forms asked for too little to reproduce a problem.** The bug form
   asked for `npm ls @uwmd/core` but no Format or Protocol version, no
   reporting implementation, and no spec citation. The spec form listed one
   schema (`module-manifest.schema.json`) and none of the receipt, Lite,
   composition, interchange or binding specs. The feature form's component list
   predated excel, report, lake, signing, batch and the reference modules.
3. **No guidance on confidential data.** Nothing warned against attaching a
   real deal to a public issue.
4. **No defined return path.** No label or documented step showed a reporter
   whether a report was reproduced, accepted, fixed, released or turned into an
   RFC.

### Found during inventory, not fixed here

- `uwmd --version` falls through to the help text and exits 0, so no version
  is printed. `uwmd manifest` is the working version command, and the forms
  use it. Flagged as a separate task.
- `ProtocolErrorCategory` in `protocol.ts` has ten members, but
  `spec/schemas/protocol-error.schema.json` and Protocol §XI list eight; the
  two missing are `package` and `portfolio`. This is `drift` under the new
  taxonomy. Whether the fix is editorial or needs an RFC depends on whether
  RFCs 0015/0018 specified those categories. Flagged as a separate task.
- README "Who's building on it" still names underwriter.cc, while ROADMAP
  calls it "StackUW (formerly underwriter.cc)". Left for the owner, because
  naming an adopter's product publicly is the adopter's call.

## What changed

| File | Change |
|---|---|
| `.github/ISSUE_TEMPLATE/bug.yml` | Now *Bug or interoperability report*. Asks for the kind of problem, the reporting implementation, the UWMD versions (`uwmd manifest`, or the implementation's own §II.6a manifest, plus the document's `uw_version`), affected components, asset class/module/profile, expected behavior **with its spec citation**, observed behavior, a minimal reproduction, diagnostics (validate/verify/receipt/runner JSON), impact, workaround, environment and related links (including the reporter's own tracker ID). Requires confirmations for de-identified data and non-security. |
| `.github/ISSUE_TEMPLATE/spec-question.yml` | Now *Spec question or ambiguity*. Covers every normative document, plus the kind of question (ambiguity, contradiction, gap, proposed change, intent), **readings and who follows them**, example, proposal, compatibility and related links. |
| `.github/ISSUE_TEMPLATE/feature.yml` | Now *Capability request*. Adds **who needs it** (the demonstrated consumer), existing surfaces checked, and a layer choice that marks Format and Protocol as RFC-bound. |
| `.github/ISSUE_TEMPLATE/config.yml` | New. Disables blank issues, and adds contact links for security, the feedback guide and the RFC process. |
| `.github/labels.json` | New. The single list of 16 labels. Five existing defaults are reused (`bug`, `documentation`, `enhancement`, `duplicate`, `wontfix`); `spec` and `needs-triage` keep the names the forms already used. |
| `.github/workflows/labels.yml` | New. On a push to `main` that touches the manifest, it creates or updates each label. It never deletes one. Merging the change is what creates the labels, so no manual setup step remains. |
| `scripts/issue-forms.mjs`, `scripts/verify-issue-forms.mjs`, `scripts/issue-forms.test.mjs` | New `npm run verify-issue-forms` guard, with a new CI job. It holds the forms, the label manifest, `docs/FEEDBACK.md` and every document that links to a form to each other, and repeats the parts of GitHub's form syntax that a typo can break. On its first run it found an unquoted `: ` that made the new bug form invalid YAML. |
| `package.json`, `package-lock.json` | `yaml` (ISC, no dependencies) added as a root devDependency for the guard. |
| `docs/FEEDBACK.md` | New adopter guide: where to report, evidence, the deal-data boundary, the lifecycle and its visible states, labels, the RFC test, maintainer triage steps, and why there is no report envelope. Published at `/about/feedback`. |
| `CONTRIBUTING.md`, `SECURITY.md`, `README.md`, PR template | Point at the forms and the guide. The PR template explains `Fixes #N` and `awaiting-release`. |
| `tools/docs-site/scripts/prebuild.mjs`, `.vitepress/config.ts` | Copy and link-map entries, plus a sidebar entry for the guide. |
| `docs/wiki/11-build-release-governance.md`, `docs/wiki/13-status.md`, `ROADMAP.md`, `CHANGELOG.md` | Record the workflow and where adopter findings now enter. |

## The classification test

The taxonomy is in the guide. The one rule that carries the weight, quoted
from GOVERNANCE.md's definition of normative, is: **does resolving the report
change what a conforming implementation must do?** If not, it is a defect
(`bug`, `drift` reconciled to already-established behavior,
`conformance-gap`, `documentation`) and goes through an ordinary PR. If so, it
gets `needs-rfc`. That includes any fix that has to select new semantics
because the existing contract is genuinely ambiguous, such as choosing between
readings that different conforming implementations follow.

**No source hierarchy.** The specs, the normative schemas and the normative
conformance corpus are one joint conformance contract. The guide declares
none of them superior to the others. A disagreement among them is drift.
Triage first establishes the behavior the contract already governs, reading
all the normative sources together with the introducing RFC, its fixtures,
the CHANGELOG and the release records. It then corrects whichever artifact
departs from that behavior. When the evidence doesn't establish the behavior,
or reconciling the sources would change required behavior, the report gets
`needs-rfc`. UPSTREAM-003 (2.3.0) is one case where the spec text held the
intended behavior and the schema was corrected. It sets no general rule that
the spec prevails.

Every previous StackUW finding classifies cleanly under this test:

| Finding | Classification under the new taxonomy | What happened |
|---|---|---|
| UPSTREAM-002 | `spec` → `needs-rfc` | RFC 0032 |
| UPSTREAM-003 | `drift` (a schema `required` array disagreed with the intended manifest behavior) | Fixed by PR |
| UPSTREAM-005 | `spec-ambiguity` + `needs-rfc` | RFC 0037 |
| UPSTREAM-006 | `spec-ambiguity` + `needs-rfc` | RFC 0038 |
| UPSTREAM-014 | `enhancement` + `needs-rfc` | RFC 0069 |
| UPSTREAM-015 | `bug` (packs read a §4.5 object as a scalar) | Fixed by PR, with regression tests |
| UPSTREAM-016 | `spec-ambiguity` + `needs-rfc` | RFC 0066 |
| UPSTREAM-020 | `bug` (release records not final at the tag) | Fixed by PR (release tooling) |
| UPSTREAM-021 | `conformance-gap` (fixtures passed a fence-order reader) | Fixed by PR, no contract change |

## Is a machine-readable feedback envelope warranted?

**1. What existing structures can be reused?** All of the facts a report
needs already have a normative, machine-readable form:

| Need | Existing surface |
|---|---|
| Which implementation, which versions, which capabilities | `ImplementationManifest` (Protocol §II.6a, `implementation-manifest.schema.json`), printed by `uwmd manifest` and required of any implementation driven by the shared runner |
| Which document version | Frontmatter `uw_version` / `uw_lite_version` |
| What went wrong, routably | `ValidationResult` issues carrying registered family prefixes (§III.6a says adopters route issues by prefix), the `coverage` channel (RFC 0037), and `ProtocolError` (`protocol-error.schema.json`) with stable codes |
| What was computed, from which input | Receipts (RFC 0016): `subject.digest`, pack/engine/protocol versions, results and `results_digest` |
| Conformance disagreement | The language-agnostic runner's `--manifest-out` report (implementation id@version, per-case results, skipped-by-capability) |

**2. What is genuinely missing?** No single command bundles those outputs,
nothing de-identifies a document, and `uwmd --version` doesn't work. All three
are tooling gaps. None of them is a missing contract.

**3. Is GitHub sufficient for the MVP?** Yes. Every adopter finding to date
(the table above) was written by a person and resolved by a person, and none
needed machine import. Issue forms collect the same facts in a structured,
searchable way, with free text where a person adds value.

**4. Is there an interoperability requirement between independent
implementations?** No. A protocol object exists so that two implementations
agree on its meaning. A feedback report has one kind of producer and one
consumer, a maintainer, and that consumer is not an implementation. No second
implementation has asked to exchange reports.

**5. Which layer would it belong to?** If demand appears, it would be
non-normative tooling: for example, a CLI command that writes the manifest,
the validation JSON and the input digest of a *reduced* document into one
file. It would compose existing normative outputs, never define a new spec
object. Automated de-identification is the hard part. Deciding which values in
a deal are confidential is judgement, and a tool that claims to do it risks
false assurance, so it would need its own design review.

### Protocol assessment

**No normative protocol change is needed for the MVP.** No RFC is drafted.

Revisit when any of these is demonstrated:
- maintainer tooling that must import reports automatically;
- report volume that manual triage can't keep up with;
- two independent implementations that need to exchange diagnostic bundles
  with each other, not with maintainers.

Even then, the first step is the tooling bundle above. A normative envelope
would need an RFC naming its consumer and the interoperability problem it
solves.

## Owner decisions left open

- **A private channel for confidential, non-security reproductions.** Today the
  only private channel is the security mailbox. The guide tells reporters to
  describe a report's structure publicly and work with a maintainer on a
  synthetic reproduction. It promises no private intake.
- **GitHub private vulnerability reporting.** It is disabled. SECURITY.md's
  email route is unchanged, and enabling the feature would add a second route.
- **The public RFC comment venue.** It remains open
  ([handoff](../handoff/HUMAN-public-rfc-venue.md)). Until it closes,
  `needs-rfc` issues are where RFC discussion happens.
