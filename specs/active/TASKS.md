# RFC 0070 implementation task matrix

Base: 48fa1086671c0c229562457b98efd0a378969f78.
Contract: accepted RFC 0070 at frozen 29c42c7.
One task in flight. RFC status remains accepted.

- [ ] **IN FLIGHT — Atomic RFC 0070 implementation and verification.**
  Implement synchronized normative/core/consumer/conformance/docs changes;
  preserve synchronous validation and exact async result contract; close the
  RFC 0056 coverage defect; verify every accepted fixture and consumer control;
  run all specified deterministic gates; commit only after gates pass.

After this task passes and is committed, archive its specification and completed
matrix. Open an implementation PR only after the matrix is complete. Return
base/head, grouped files, behavior/evidence, gates/CI and any contract deviations.
Release and adoption are not authorized.
