# Contributing to UW Markdown

UW Markdown is an open standard. The format, the protocol, the reference
library, and the conformance corpus are all maintained in this repo. Patches,
spec proposals, conformance fixtures, and tools are all welcome.

## Ways to contribute

- **Report a bug or an interoperability problem** in a UWMD package, tool or
  conformance fixture: use the
  [*Bug or interoperability report*](https://github.com/UWMD-OSP/UW-Markdown/issues/new?template=bug.yml) form.
- **Ask about the spec, or propose a spec change**: use the
  [*Spec question or ambiguity*](https://github.com/UWMD-OSP/UW-Markdown/issues/new?template=spec-question.yml)
  form (see "Filing a spec change" below).
- **Request a capability or propose a new tool**: use the
  [*Capability request*](https://github.com/UWMD-OSP/UW-Markdown/issues/new?template=feature.yml)
  form before opening a PR. Tools live in `tools/` or as separate
  `packages/<tool-name>/` directories.
- **Add a conformance fixture**: see "Adding a conformance fixture."
- **Implement against the spec**: third-party implementers self-certify against
  the conformance corpus and describe the tiers and profiles they implement.

Security vulnerabilities go to security@uwmd.org ([SECURITY.md](./SECURITY.md)),
never to a public issue.

### If you build on UW Markdown

If you produce or consume UWMD documents in your own product, read
[Reporting problems and feedback](./docs/FEEDBACK.md) before filing. It covers
what evidence makes a report reproducible, how to reduce a confidential deal to
a public reproduction, what each issue label means, and how a report becomes a
fix, a release or an RFC.

## Repository layout

```
spec/                         Normative documents (format spec, protocol spec, JSON schemas)
packages/                     npm workspaces — reference library and starter packages
examples/                     Synthetic .uwx.md records and UW Lite .uw.md summaries
conformance/                  Per-tier fixtures + expected outputs
tools/                        Web viewer/editor, VS Code extension and docs site
.github/                      CI, issue forms, issue labels (labels.json), PR template
```

## Local development

```bash
git clone https://github.com/UWMD-OSP/UW-Markdown.git
cd UW-Markdown
npm ci
npm run build
npm test
```

Run `npm ci` from the repo root for workspace packages
(`packages/*`, including `@uwmd/verify`, `@uwmd/core` and `@uwmd/cli`). The root
`package-lock.json` is the single source of truth for those.

The starter tools under `tools/*` are intentionally *not* npm workspace
members (different toolchains: VitePress, Vite, vsce). Each commits its
own `package-lock.json` and you install them with `npm ci` inside
their directory.

The reference library lives at `packages/uwmd-verify/` (the standard) and
`packages/uwmd-core/` (the starter toolkit on top, which compiles against
verify's `dist/`). To work on them directly:

```bash
npm run build -w @uwmd/verify            # build verify before core
npm run build -w @uwmd/core -- --watch   # rebuild on save
npm test -w @uwmd/verify -- --watch      # tests in watch mode
npm test -w @uwmd/core -- --watch
```

## Filing a spec change

Spec changes — to `UW_FORMAT_SPEC.md`, `UW_PROTOCOL.md`, or
`spec/schemas/*` — are higher-stakes than code changes because third parties
build on top of these documents. The process depends on whether the change is
**editorial** or **normative** (see [GOVERNANCE.md](./GOVERNANCE.md) for the
full distinction):

- **Editorial** (typo, clarification, broken cross-reference, no behavior
  change for any conforming implementation) — open a PR directly. Fast-track.
- **Normative** (changes what an implementation MUST/SHOULD do, adds or
  removes API surface, alters validation semantics) — requires an RFC.

To file a normative change:

1. Copy [`docs/rfcs/0000-template.md`](./docs/rfcs/0000-template.md) to a new
   file `docs/rfcs/NNNN-<short-slug>.md` (next free number).
2. Fill in every section — Summary, Motivation, Proposed change, Compatibility
   analysis, Conformance impact, Reference implementation, Alternatives,
   Unresolved questions, Prior art. RFCs missing sections get bounced.
   Apply the [prelaunch policy](AGENTS.md#prelaunch-policy): before 5.0,
   the compatibility section states that there is no public compatibility
   baseline; it does not require migration, deprecation or artifact retention work.
3. Open a PR titled `RFC NNNN: <short title>`.
4. The project owner accepts, requests changes, or rejects the proposal. In
   owner-led mode there is no mandatory waiting period; after collaborative mode
   activates, normative RFCs remain open at least **14 days**.
5. See [`GOVERNANCE.md`](./GOVERNANCE.md) for the current governance mode.

See [`docs/rfcs/README.md`](./docs/rfcs/README.md) for the full process and
status values.

## Adding a conformance fixture

Fixtures live under a content directory such as `conformance/documents/fixtures/`,
`conformance/calc/fixtures/` or `conformance/starter/<editor|agent|refinement>/fixtures/`,
with expected outputs in the matching `expected/` directory. To add a fixture:

1. Place the input `.uw.md` (or before/after pair, or calc input, depending on
   the tier) in the relevant `fixtures/` directory with a numeric prefix.
2. Generate expected outputs by running `@uwmd/core` against the fixture:
   ```bash
   npm run cli -- parse <fixture> > <expected>.parsed.json
   npm run cli -- render <fixture> --format chat > <expected>.rendered.txt
   ```
3. Add its owner row (Reader, Verifier, a profile, or starter products) to
   `conformance/corpus-index.json`, and an entry to the suite README explaining
   what the fixture exercises.
4. The toolkit runs no agent, so there are no agent-output fixtures.

## Playbooks

Larger changes follow a playbook in [`docs/playbooks/`](docs/playbooks/README.md):
adding an official asset class, adding or changing a metric, third-party modules,
and the release rules after launch.

## Code style

- TypeScript strict mode; no `any` without comment justifying.
- Pure functions where possible; side effects named explicitly (`writeAgentBlock`, not `process`).
- Tests via Vitest. New code without a test gets a follow-up issue.
- Comments explain *why*, not *what* — well-named identifiers cover *what*.

## PR checklist

Before opening a PR:

- [ ] `npm run build` is clean (no TS errors).
- [ ] `npm test` passes (all tests green).
- [ ] `npm run typecheck:tests` and `npm run conformance` pass after the build; expected refusals remain expected refusals.
- [ ] If the change is normative (spec): RFC and synchronized contracts/conformance are included; apply the prelaunch policy above.
- [ ] Affected guards, lint and the documentation build pass as listed in [AGENTS.md](AGENTS.md#changes-and-validation).
- [ ] If the change adds a public API: a standard symbol is exported from `packages/uwmd-verify/src/index.ts` (core re-exports it), a starter symbol from `packages/uwmd-core/src/index.ts`.
- [ ] CHANGELOG.md updated under `[Unreleased]`.

## Code of conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md).
By participating you agree to abide by its terms.

## License

By contributing, you agree your contributions are licensed under the MIT
License (see [LICENSE](./LICENSE)).
