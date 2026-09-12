# Release 2.9.0

The owner requested proceeding after PRs #189 and #190 merged. Main CI
34720089513 passed at f0ce7d6. Publish the RFC 0045 implementation using the
existing trusted-publishing workflow and verify installed consumer behavior.

Core/CLI become 2.9.0; Protocol remains 2.12.0 and Format remains 2.0.
Signing 0.2.13 and batch 0.8.8 repin core. Unpublished Excel 0.9.1, report
0.8.13 and module packages 0.1.1 also repin core; typed module manifests
retain their independent 0.1.0 contract version. No external dependency,
workspace link, normative contract or financial calculation changes.
Receipt changes are engine labels only.

Run npm ci, all deterministic gates, docs build and isolated tarball smoke.
Merge a green release PR and tag the tested main commit v2.9.0. Verify the
four registry artifacts and clean installed API/CLI behavior before marking
publication complete. Reconcile public documentation and archive this contract.
Real-deal economic validation remains with the owner, as previously agreed.

## Completion

Release PR #191 merged, tag v2.9.0 at 7d939c7044e17ffbded7ec939edc9d0be8d35b87; trusted publication run 34722139177
passed. All local gates and separate packed/registry installations passed.
Published status and roadmap are reconciled in the accompanying docs change.
See docs/reviews/2026-09-12-release-2.9.0.md for reproducible evidence.
