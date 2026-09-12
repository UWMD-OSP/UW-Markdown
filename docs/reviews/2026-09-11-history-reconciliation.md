# Historical-claim reconciliation — 2026-09-11

Baseline: `origin/main` at `9f243e1`, after fetching the remote. Release tag
`v2.6.2` points to `628b7c0`. Work was performed in the dedicated `codex/work`
worktree; the primary checkout was left unchanged.

The numbered historical Sources 1–16 were not supplied, so their quotations and
context cannot be independently checked. The findings below verify the user's
claims against repository files and reachable commit history. Old version numbers
can be correct historical statements; they become misleading when presented as
current status.

## Findings

| Claim | Verified disposition and evidence |
|---|---|
| Repository is at 2.6.2 | Confirmed for core/CLI and the release tag. Format is **2.0**, Protocol **2.6.0**; other packages have independent versions. See [VERSIONS.md](../../VERSIONS.md), the core/CLI manifests, and `628b7c0`. Releases 2.1.0, 2.3.0, and 2.4.0 are ancestors of the baseline. |
| Calendar math and waterfalls are future v2 work | Stale. RFC 0034 calendar math shipped in the 2.1.0 package release (`bd8c249`); RFC 0035 waterfall shipped in 2.2.0 (`a1b4e28`, Protocol 2.3.0). RFC 0036 IRR hurdles subsequently shipped in 2.6.0 (`33d3126`, Protocol 2.6.0). |
| Capability tokens and signing remain blocked | Stale. RFC 0011 implementation is `2552930`; RFC 0002/0010 signing landed in `e219be6`. See the implemented statuses in the [RFC index](../rfcs/README.md), core/signing source, and capability/signing conformance suites. Module Sigstore remains reserved; this is not a claim that every signing backend ships. |
| RFC 0024 is unwritten or unaccepted | False at this baseline. `6ebf0f6` accepts it, `dc914d7` implements it, and [RFC 0024](../rfcs/0024-iterative-function-determinism.md) is marked implemented. Later references to its solver contract do not undo that acceptance. |
| Tests are un-typechecked because production tsconfig excludes them | Stale. `10bbc2d` added core test typechecking, `6bae5b8` extended it, and CI runs `npm run typecheck:tests`. Production-build exclusion prevents test publication; dedicated test configs check them separately. Runtime tests were not made inert by a production tsconfig exclusion. |
| SECURITY.md still publishes a personal address | False. [SECURITY.md](../../SECURITY.md) uses `security@uwmd.org`. `58dd581` explicitly records confirmation that it was live before publication. This pass did not send email or independently re-test present-day forwarding. |
| Landing page advertises 1.1.2 and tutorial uses 1.1 | Already partly repaired in #152/#153. At the baseline the home page still pinned core/protocol 2.3.0; the tutorial already used `.uwx.md`, Format 2.0, and `npx @uwmd/cli validate`. The AI page still named Format 1.1 / Protocol 1.5. |
| RFC 0019 is blocked on array iteration | Stale as a current status: it is implemented. Its original design discussion explains a constraint that shaped named component slots. Multi-component aggregation does not establish speculative-lease or Argus parity. |
| RFC 0041 is a speculative-leasing module | Not supported. [RFC 0041](../rfcs/0041-period-indexed-addressing.md) is a draft for addressing existing period series. A future leasing module would need its own deterministic renewal, vacancy, rent-reset, and TI/LC timing/amortization contract. |
| RFC mirroring uses a brittle static list | Confirmed. At the baseline RFC 0041 was already listed, so that particular page was not missing. The list still required a manual edit for every new RFC. It is now discovered from `docs/rfcs/*.md`. |
| Six-decimal Excel parity remains unresolved | Stale. RFC 0023 established half-away-from-zero boundary quantization; supported emitted formulas use matching `ROUND` precision. RFC 0024 separately pins iterative behavior. Exact reported-value parity is not universal identity of Excel functions or intermediate doubles. |
| Large balances require a native bps unit | Not established by the source or RFCs. The format already has bps-named fields; the calc unit-default table has no dedicated bps rule. A unit label alone does not increase binary64 precision. Inputs/intermediates are not rounded to the six-place reporting default. A new scaling/precision policy needs an evidenced use case and RFC; none was introduced here. |

## Changes

The site now reads version labels from the core manifest and format/protocol
constants. Its primary getting-started link leads to the existing canonical-file
tutorial. RFC mirroring discovers Markdown files in sorted order, keeps the index
and template URLs, and retains link rewriting and status banners. The index gate
uses the same discovery and includes future-RFC and independent-version tests.

Current-facing roadmap, precision, release, and security notes were reconciled.
The completed Protocol 1.3 task contract was archived with its historical targets
preserved. RFC 0019 gained a scope clarification; no normative specification,
schema, exported core interface, financial formula, or dependency was changed.

## Verification

- Repository build: passed.
- Tutorial example: extracted verbatim and validated with the built CLI; zero
  errors and the two documented `DQ-06` informational notes.
- Workspace tests: 1696 passed; two additional docs-source regression tests passed.
- Conformance: 402 passed, zero failed.
- Schema validation: 23 passed, zero failed; the index additionally includes the XSD.
- Test typechecking, lint, lockfile verification, package-content verification,
  version verification, and index verification: passed.
- VitePress production build: passed, including RFC 0041 and the generated release labels.

The package-content check first found twelve obsolete Excel test artifacts from
an August build in this old worktree. Removing those generated files cleared the
check; no package source or publication policy changed. The initial sandboxed
Node test invocation could not spawn workers; the normal unsandboxed gate passed.

Production uwmd.org deployment and current npm availability were not verified.
The web tool could not open the public site. These results describe repository
source and a local production build; no deployment, npm publication, or email was
performed.
