# Experimental recovery: earlier Python #354 work

**UNREVIEWED / INCOMPLETE / NOT FOR MERGE.** This is a recovery snapshot, not
the canonical Python implementation or a new capability claim. PR #358 owns the
reviewed Reader foundation; PR #357 owns numerical RFC 0088. Neither is modified.
No financial arithmetic, normative contract or conformance expectation is adopted.

The recovered code contains potentially reusable period selection, partial
structural checks, safe-expression parsing and related tests. Its older Reader
uses character offsets and must not replace #358's byte-preserving Reader.
The historical numeric dependency uses a host date library and rejects year
0000; the separately recovered calendar predicate does not repair all of it.
Do not import the snapshot wholesale or infer correctness from its filenames.

## Provenance and contents

Recovered from the 2026-10-15 closeout archive, originally `/tmp/uwmd-lane-354`
on base `b87909878d0f9fd55e212366a8dced7cf05c08ad`. The source and evidence files
are preserved byte-for-byte, relocated outside active implementation paths.
Historical statements in them describe that checkpoint, not current CI.

- `source-snapshot/implementations/python/`: eight unique source/test files plus
  their exact earlier numeric dependency recovered from the patch-check tree.
- `historical-notes/`: original scope/limitations, first-stage patch and patch
  index. Referenced routine logs and redundant second-stage patch are omitted;
  the final unique source and structured evidence are preserved instead.
- `historical-evidence/`: original coverage summary and Reader, declared and
  forced-no-skip portable reports. These are observations, not new certification.

Historical results: 24 targeted unit methods and 17/17 portable Reader outputs;
the declared run skipped 281 cases, and the forced no-skip run failed 281.
The 91 exploratory calc baseline matches are not capability passes. No tier,
full validation, financial Verifier, receipts or cross-runtime identity is claimed.
Original gates failed for absent tooling, as the retained reports state.

The duplicate `uwmd_source.py` and `test_source.py` are already byte-for-byte
recoverable at PR #358 head `b079923ab765a75852b7751b2cd45deecc9bb19e` under
`implementations/python/`. The older source-foundation review is superseded by
that PR's review. Neither is duplicated here. The nested `drafts354/check` tree
and TAP renderings duplicate retained source/JSON reports.

## Safe reproduction from a GitHub clone

Create a separate disposable worktree at the stable corpus checkpoint
`50bf4c13206560848c5bb9b045f4532ad3cd8633`. Copy this directory's
`source-snapshot/implementations/python/*.py` to that worktree's
`implementations/python/`, creating it first. Do not overwrite #358's branch.
From the disposable worktree run:

```sh
python3 -B -m unittest discover -s implementations/python -p '*354.py' -v
python3 -B conformance/runner/runner.py --impl 'python3 -B implementations/python/uwmd.py' --tier reader --no-skip
```

This preserves the original tests' repository-root lookup and relative fixture
paths. Any new results must be recorded separately from historical evidence.
Use the root handoff in PR #363 for current integration order and owner decisions.
Recovery does not accept a draft RFC, authorize a release or prepare 5.0.
