# Adding a conformance profile

Use a conformance profile for an explicit, finite set of optional obligations
an implementation can claim and demonstrate. It is a test/claim boundary,
not a document-purpose id, a new asset class or permission to skip base duties.
Start with the [growth paths](../HOW-UWMD-GROWS.md) and the
[portable runner](../../conformance/runner/README.md).

## 1. Scope before fixtures

- State the normative clauses, capability names and supported tiers the profile
  covers. An official new obligation or changed meaning needs an accepted RFC.
- Distinguish the optional profile from Reader/Verifier base obligations and
  from implementation-specific starter-product checks.
- Define every outcome, required refusal and unsupported case. A selected but
  unimplemented obligation cannot disappear as a successful empty report.
- Keep profile ids, capability ids, report schema and driver operation mappings
  synchronized with the current registries. Do not guess an unknown spelling or
  infer support from a package name.

## 2. The pull request

- [ ] Add synthetic input/expected pairs and rows in the corpus index, using
  existing case/corpus schemas and ownership rules.
- [ ] Cover normal, missing, ambiguous, invalid, tampered and boundary cases,
  including every rule affecting process exit or coverage.
- [ ] Wire portable and source runners deliberately; state any engine-relative
  fixture configuration explicitly, as RFC0127 does for receipt identities.
- [ ] Update the public implementation manifest only after the selected claim
  actually runs. Required claims run with zero skips; optional skips are visible.
- [ ] Put the selected profile in required CI when it protects a public claim.
  RFC0092's explicit profile step inside the existing required Node20 job is a
  precedent; a separate check name is not itself proof it is required.
- [ ] Keep raw failures and original expectations. Review each intended expected
  change against its accepted clause; never blanket-refresh to make a run green.
- [ ] Document runtimes, bindings, finite coverage and limitations separately.

## 3. Completion

Run build, tests, test types, the selected profile, full conformance, schemas,
lint, docs and repository guards. Run the actual public driver/CLI for every
claimed binding. Prove that an unsupported/omitted implementation cannot obtain
the same successful claim, and that source/model bytes remain unchanged where
the operation is read-only. An independent run is additional evidence, not a
replacement for a clear contract or all required CI checks.
