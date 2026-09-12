# Prepare the 2.7.0 package release

Status: implementation in flight, 2026-09-12. Reconciled main at `6fb480a`;
RFCs 0040 and 0041 are merged and main CI passes. Registry checks confirm
core/CLI 2.6.2, signing 0.2.10 and batch 0.8.5 remain the published versions.

## Scope

Prepare a reviewable release PR for the two additive features. Core and CLI
advance to 2.7.0; Protocol remains 2.8.0 and Format remains 2.0. Exact core
dependents take repin patches: signing 0.2.11, batch 0.8.6, excel/report 0.8.11.
The unpublished hospitality and data-center modules retain 0.1.0 with new pins.
Update CORE_VERSION, workspace lock metadata, receipt engine labels, compatibility
matrix, changelog and living status. Preserve all external dependency versions,
workspace links, financial results and normative contracts.

This stage ends with a verified release PR. Tag creation and npm publication
are separate actions; preparation must not claim the versions are published.

## Verification

Run npm ci after the manifest/lock changes, then build, workspace tests, test
typechecking, all default and declarative conformance, schema validation, lint,
lockfile/package/version/index/release checks and the docs build. Regenerate
only receipt labels and verify calculation digests stay unchanged. Commit and
submit the PR; archive this preparation stage after all checks pass.
