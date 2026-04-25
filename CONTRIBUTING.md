# Contributing to UW Markdown

UW Markdown is an open standard. The format, the protocol, the reference
library, and the conformance corpus are all maintained in this repo. Patches,
spec proposals, conformance fixtures, and tools are all welcome.

## Ways to contribute

- **Report a bug** in `@uwmd/core` or a starter tool — open an issue with the *Bug* template.
- **Propose a spec change** — open an issue with the *Spec question* template (see "Filing a spec change" below).
- **Add a conformance fixture** — see "Adding a conformance fixture."
- **Build a new tool** — propose it via the *Feature* issue template before opening a PR; tools live in `tools/` or as separate `packages/<tool-name>/` directories.
- **Implement against the spec** — third-party implementers self-certify against the conformance corpus and are listed in the README.

## Repository layout

```
spec/                         Normative documents (format spec, protocol spec, JSON schemas)
packages/                     npm workspaces — reference library and starter packages
examples/                     Sample .uw.md deal files
conformance/                  Per-tier fixtures + expected outputs
tools/                        Starter tools (web-viewer, future: excel converter, etc.)
.github/                      CI, issue/PR templates
```

## Local development

```bash
git clone https://github.com/jaredmaxey/Underwriting-Markdown-Private-1.0.git
cd Underwriting-Markdown-Private-1.0
npm install
npm run build
npm test
```

The reference library lives at `packages/uwmd-core/`. To work on it directly:

```bash
cd packages/uwmd-core
./node_modules/.bin/tsc --watch    # rebuild on save
./node_modules/.bin/vitest          # tests in watch mode
```

## Filing a spec change

Spec changes — to `UW_FORMAT_SPEC_v1.md`, `UW_PROTOCOL_v1.md`, or
`spec/schemas/*` — are higher-stakes than code changes because third parties
build on top of these documents. A spec PR must include:

1. **Motivation** — what's broken, missing, or unclear in the current spec.
2. **Proposed change** — the exact text edits.
3. **Compatibility analysis** — does this break existing implementers? If so, propose a deprecation path.
4. **Conformance impact** — which fixtures need updating; new fixtures if behavior expands.
5. **Reference implementation** — a PR against `packages/uwmd-core/` showing the change is implementable, OR a stub if implementation lands in a follow-up.

Normative changes (RFC 2119 MUST/SHOULD) require explicit reviewer sign-off.
Editorial changes (typos, clarifications that don't change behavior) can be
fast-tracked.

## Adding a conformance fixture

Fixtures live under `conformance/tier-N-*/fixtures/` with expected outputs in
`conformance/tier-N-*/expected/`. To add a fixture:

1. Place the input `.uw.md` (or before/after pair, or calc input, depending on
   the tier) in the relevant `fixtures/` directory with a numeric prefix.
2. Generate expected outputs by running `@uwmd/core` against the fixture:
   ```bash
   node packages/uwmd-core/dist/cli.js parse <fixture> > <expected>.parsed.json
   node packages/uwmd-core/dist/cli.js render <fixture> --format chat > <expected>.rendered.txt
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
