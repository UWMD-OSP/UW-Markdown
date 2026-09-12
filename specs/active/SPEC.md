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
