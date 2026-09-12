# Release 2.8.0

The owner requested proceeding after PRs #182–#186 merged and main CI passed.
Registry reconciliation on 2026-09-12 confirms core/CLI 2.7.0, signing 0.2.11,
batch 0.8.6. Prepare and ship the merged additive features through the existing
trusted-publishing workflow; no credentials or external account changes needed.

Core/CLI become 2.8.0; Protocol stays 2.11.0 and Format stays 2.0. Signing
0.2.12, batch 0.8.7 and report 0.8.12 repin core. Unpublished Excel becomes
0.9.0 for the additive contextual export; unpublished modules retain 0.1.0.
Preserve every external dependency version and workspace link. Update only
receipt engine labels, not financial outputs/digests. No normative changes.

Run npm ci after package/lock edits, all deterministic gates, docs build and
clean tarball smoke checks. Commit a release PR, verify CI, merge, push v2.8.0
to invoke release.yml, verify all four registry artifacts and their installed
API/CLI behavior, then reconcile public release statuses. Do not describe a
package as published before registry confirmation. Tag a tested main commit.

## Completion evidence — 2026-09-12

- [x] Preparation committed as `d3b8616`, merged in PR #187 after green CI.
- [x] Tag `v2.8.0` at `f0d8642457c7bdf50dc104e67c859a7c9f109f73`.
- [x] Trusted publication succeeded in workflow `34712529152`.
- [x] Registry versions and a clean npm installation verified all four packages.
- [x] Published docs, RFC statuses, matrix and roadmap reconciled in `a41e3bd`.

Published: core/CLI 2.8.0, signing 0.2.12 and batch 0.8.7. Protocol 2.11.0;
Format 2.0. Standalone Excel/report/reference modules remain unpublished.
All required local gates passed, including 1,931 tests, 441 default plus 76
declarative conformance checks and 31 schemas. Post-merge release CI and the
publication workflow succeeded. Separate tarball and registry smoke checks
verified actual installed artifacts without workspace links.

The first metadata lookup hit stale npm cache data; fresh registry metadata
and a new-cache installation confirmed publication. No republish was attempted.
See [public evidence](../../docs/reviews/2026-09-12-release-2.8.0.md).
