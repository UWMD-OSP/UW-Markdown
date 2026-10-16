# Draft: Independent Python safe-expression subset and explicit numerical blockers

Stack base: the exact reviewed commit of draft 1, not main or a moving worktree.
Suggested remote head: `codex/python-354-settled-evaluator`.

Adds an AST parser for Protocol VIII.1 and an intentionally partial evaluator
for settled arithmetic, null propagation, boolean short-circuiting, scalar
builtins, dates, section roles, explicit variants and period paths. No eval,
Node, TypeScript translation, hosted API or expected-output lookup occurs at
runtime. Reporting quantizes once using the inherited numeric seed.

Power/log/exp, annuities and periodic/dated returns stay blocked under #356 and
draft RFC0088. Local blocked/unimplemented statuses are not new normative error
codes and never imply a verified financial result. Unpinned remainder/null
predicate/collection-comparison behavior is recorded for maintainers.

Validation and calc remain unadvertised. The manifest has only `parse`, no tier
or optional profiles. Full metric dictionary verification, all applicable II.2
stated-figure checks, receipt subjects and receipt verification remain required
future work; their absence is not attributed solely to #356.

Actual final-worktree evidence (Python3.12.3/Linux): 24/24 targeted methods;
17/17 portable Reader cases. Declared-capability run:17 passes/281 skips.
--no-skip run:17 passes/281 failures, including the deliberate missing-claim
failures. Ignoring only those missing-claim messages for exploratory comparison,
91/96 calc baselines match; five IRR cases remain blocked. All111 validation,
28 reserve-account and46 reserve-draw cases still differ. These are development
observations, not a Verifier/calc certification. The original runner manifests
and TAP are included without editing expected data or suppressing failures.

The required build/test/typecheck/conformance gates were attempted and failed
for absent tsc/vitest/ajv. No cross-platform execution evidence exists. Draft
only: do not merge until dependencies are provisioned, gates run, the unsupported
operator contract is reviewed, and the relevant capability obligations pass.

Changes are implementation/test/evidence files only. No normative contract,
corpus expectation, release version, TypeScript code or other worker file changes.
Changelog/wiki integration remains pending safe worktree ownership reconciliation.
