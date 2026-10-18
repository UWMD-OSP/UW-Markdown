# RFC0089 independent portable minimum proof (unaccepted)

This fills the independent projection checkpoint using current design examples;
it does not implement a Reader, validate source/model admission, authenticate a
subject, reconstruct Markdown, or activate an Envelope/Protocol rule. It adds no
migration, old-regime replay, preservation inventory or new version label.

A separately authored Python projector and the existing Node candidate helper
receive equal JSON values through an actual UTF8 subprocess boundary. Five tests
compare seven complete existing model examples and seven explicit value controls:
absent/null/authored metadata, exact unknown payload/_role/_overrides, nested
_notes, block-extra/prose exclusion, null versus literal default, one-peer mode,
UTF16 identity order, ordered history and explicit empty history. Literal expected
objects are independent of both projectors for the explicit controls. Seven-model
comparisons derive expectations with Python and independently execute Node; they
are cross-implementation agreement, not an independently approved baseline.

Only the affected extension/history minimum is claimed. Metadata is copied
without coercion/defaults even where the example would fail current validation.
The minimum excludes authored notes, prose and block extras while the complete
model must retain them. It is therefore unsuitable as an authentication subject.
No general source selection, builtin projection, schema validation, negative
admission, cross-platform CI or candidate receipt issuance is established here.
The existing real-crypto proof already covers byte binding and is not repeated.

Run the focused check from the repository root:

```sh
python -B -m unittest discover -s experiments/envelope-0089/portable-proof -p test_projection.py -v
```

The owner selected the tagged/null-identity contract, complete XML/CSV mapping
and complete authentication subject under unchanged V.13/Receipt5.5 admission
on2026-10-17. Tests support that direction; final evidence and synchronized
contract gates remain before RFC acceptance or activation. Current read-only
source accounting, accepted RFC0090/0091 diagnostics and independent RFC0088/0085
ownership remain unchanged. No package or specification version is allocated.
