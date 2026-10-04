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
  the conformance corpus and are listed in the README.

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
examples/                     Sample .uw.md deal files
conformance/                  Per-tier fixtures + expected outputs
tools/                        Starter tools (web-viewer, future: excel converter, etc.)
.github/                      CI, issue forms, issue labels (labels.json), PR template
```

## Local development

```bash
git clone https://github.com/UWMD-OSP/UW-Markdown.git
cd UW-Markdown
npm install
npm run build
npm test
```

Run `npm install` from the repo root for workspace packages
(`packages/*` — `@uwmd/core`, `@uwmd/excel`, `uwmd`). The root
`package-lock.json` is the single source of truth for those.

The starter tools under `tools/*` are intentionally *not* npm workspace
members (different toolchains: VitePress, Vite, vsce). Each commits its
own `package-lock.json` and you install them with `npm install` inside
their directory.

The reference library lives at `packages/uwmd-core/`. To work on it directly:

```bash
npm run build -w @uwmd/core -- --watch   # rebuild on save
npm test -w @uwmd/core -- --watch        # tests in watch mode
```

## Filing a spec change

Spec changes — to `UW_FORMAT_SPEC_v1.md`, `UW_PROTOCOL_v1.md`, or
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
3. Open a PR titled `RFC NNNN: <short title>`.
4. The project owner accepts, requests changes, or rejects the proposal. In
   owner-led mode there is no mandatory waiting period; after collaborative mode
   activates, normative RFCs remain open at least **14 days**.
5. See [`GOVERNANCE.md`](./GOVERNANCE.md) for the current governance mode.

See [`docs/rfcs/README.md`](./docs/rfcs/README.md) for the full process and
status values.

## Adding a conformance fixture

Fixtures live under `conformance/tier-N-*/fixtures/` with expected outputs in
`conformance/tier-N-*/expected/`. To add a fixture:

1. Place the input `.uw.md` (or before/after pair, or calc input, depending on
   the tier) in the relevant `fixtures/` directory with a numeric prefix.
2. Generate expected outputs by running `@uwmd/core` against the fixture:
   ```bash
   npm run cli -- parse <fixture> > <expected>.parsed.json
   npm run cli -- render <fixture> --format chat > <expected>.rendered.txt
   ```
3. Add an entry to the per-tier README explaining what the fixture exercises.
4. For Tier-4 (agent-host) fixtures, expected outputs are *shape assertions*,
   not byte equality — LLMs are nondeterministic, so the fixture's
   `expected-after-shape.json` lists fields that MUST be present, with allowed
   value types but not specific values.

## Code style

- TypeScript strict mode; no `any` without comment justifying.
- Pure functions where possible; side effects named explicitly (`writeAgentBlock`, not `process`).
- Tests via Vitest. New code without a test gets a follow-up issue.
- Comments explain *why*, not *what* — well-named identifiers cover *what*.

## PR checklist

Before opening a PR:

- [ ] `npm run build` is clean (no TS errors).
- [ ] `npm test` passes (all tests green).
- [ ] Conformance fixtures still parse without warnings (run the corpus regen script if format/parser changes).
- [ ] If the change is normative (spec): compatibility analysis and conformance impact documented in the PR body.
- [ ] If the change adds a public API: `packages/uwmd-core/src/index.ts` re-exports the new surface.
- [ ] CHANGELOG.md updated under `[Unreleased]`.

## Code of conduct

This project follows the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md).
By participating you agree to abide by its terms.

## License

By contributing, you agree your contributions are licensed under the MIT
License (see [LICENSE](./LICENSE)).
