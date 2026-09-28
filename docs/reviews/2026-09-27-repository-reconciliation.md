# Repository and release-boundary reconciliation — 2026-09-27

Read-only remote checks against `UWMD-OSP/UW-Markdown` confirmed canonical
`main` at `c5df4c024d405124285a5df629d1c6d8e6bac6e4`. RFC 0063's
implementation `413a64511c4412114c230b5d39bea698f16eda40` and its task
archive are ancestors of that head. RFC 0062's accepted integration is also
on `main` (`e49eb43`). The latest release tag is annotated object
`026a853d4ca310ec6fba894c6feb44b41876d211`, peeling to
`7c250c234316710472c392b19f3985c2be4c17ad`. npm reports core/CLI
2.13.0, signing 0.2.17 and batch 0.8.12. GitHub has no open PRs or issues at
this check.

Remote `codex/work` is 70 commits behind `main` with zero unique commits.
`preserve/docs-reconcile-256d085` is 56 behind with one docs-only unique commit
(`256d085`, touching `ROADMAP.md` and `docs/wiki/13-status.md`). That commit
described the then-current v2.10.0 and RFC 0049/0054/0055/0056 state; later
`main` documents and releases supersede its current-state facts. It provides no
unsuperseded normative contract. The branch owners may delete these stale refs
after review; this session did not delete either branch.

No current normative source conflict was found for RFCs 0062 or 0063. Protocol
§VIII.2a and §VIII.9.6, the runtime, the RFC 0063 plan schema and current
conformance agree. The released 2.17.0 same-day contradiction is preserved as
history and resolved by accepted RFC 0062 errata in the unreleased 2.18.0
source contract. Dated verification records were not rewritten; living release
state was reconciled in the separate documentation commit `a732b8c`.
