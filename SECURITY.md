# Security Policy

## Reporting a vulnerability

**Email security reports to: [security@uwmd.org](mailto:security@uwmd.org)**
with the subject prefix `[uwmd-security]`. Include:

- A short description of the issue.
- Reproduction steps (a minimal `.uw.md`, calc declaration, or module
  manifest is ideal).
- The version of `@uwmd/core` (or other affected component) and the
  format / protocol versions involved.
- Your assessment of the impact.

You will receive an acknowledgement within **5 business days**. If the
issue is confirmed:

- We aim to ship a fix within **90 days** of confirmation. Faster for
  high-severity issues; slower if a coordinated spec change is needed.
- We will coordinate a release date with you and credit you in the
  changelog and release notes (unless you request anonymity).
- Until the fix ships, please do not disclose details publicly.

If you do not receive an acknowledgement within 5 business days,
re-send the report — your message may have been lost.

## Scope

**In scope** — issues we will treat as security vulnerabilities:

- `@uwmd/core` (parser, validator, renderer, calc engine, editor,
  agent host, CLI). Anything in `packages/uwmd-core/`.
- The reference web viewer in `tools/web-viewer/`.
- The conformance runner (`scripts/run-conformance.mjs`) and the
  schema validator (`scripts/validate-schemas.mjs`).
- Any future tool published from this monorepo.
- Spec ambiguities that, if exploited, would let a malicious file
  break a conforming implementation (e.g. infinite-loop expression
  grammar gaps, parser denial-of-service vectors).

**Out of scope** — not handled by this policy:

- Third-party tools claiming UW Markdown conformance — report
  directly to those projects.
- Vulnerabilities that require an attacker to already have local
  filesystem access (UW Markdown is a document format; treating a
  local file as untrusted is the consumer's responsibility).
- Issues in dependencies that don't affect UW Markdown's actual
  surface (use `npm audit` and report upstream).
- Private business deployments of the format (e.g. specific banks'
  internal tooling).

## Examples of in-scope issues

- A crafted `.uw.md` causes the parser to consume unbounded memory
  or hang.
- A safe-expression grammar gap lets a calc declaration access
  data outside `CalcEvaluationContext`.
- An edit operation can bypass `BUILTIN_EDIT_POLICIES` to mutate
  a section the actor isn't authorized to write.
- A module manifest can declare a calc that triggers code execution
  during evaluation (the safe-expression language MUST NOT eval).
- The web viewer renders user content in a way that allows XSS.

## Disclosure model

Coordinated disclosure with a 90-day default. We will publish a
GitHub Security Advisory when the fix ships; advance notice goes to
maintainers of known third-party implementations listed in the
README.

## Out-of-band concerns

For non-security-sensitive bugs, open a regular GitHub issue. For
spec-level questions, see [`CONTRIBUTING.md`](./CONTRIBUTING.md).
