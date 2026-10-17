# Candidate XML namespace decision proof (unapproved)

This bounded addition reads the **actual existing** `codec-study` XML bytes for
`all-block-extras` and `xml-lexical-domain`. The preserved Python ElementTree
reader and a newly, separately authored Node namespace-scope reconstructor
compare the entire decoded model, independent JCS preimage SHA256 and candidate
semantic digest. No old helper, model, artifact, expectation or production file
is modified. This does not authenticate a source or accept RFC0089.

Run from the repository root, with the existing workspace dependencies:

```sh
python experiments/envelope-0089/namespace-proof/check.py
```

Default replay is read-only. `capture.py --create` refuses an existing evidence
directory; it is for the original freeze, not refreshing expected answers.

## Observed boundary

All **38 vectors** agree: **10 accepted / 28 refused per implementation** on the
recorded Windows Python3.12.3/Expat2.6.0 and Node24.14.1 runtime. Five accepted
spellings per model preserve the complete value/preimage/digest:

- Original fixed-prefix bytes.
- An arbitrary replacement ASCII prefix bound to the same namespace.
- A default namespace for elements; mapping attributes remain unqualified.
- A child locally rebinding the old prefix while using a correctly bound new
  prefix; later siblings retain the parent's scope.
- A namespace URI containing a numeric character reference that normalizes to
  the same URI.

Fourteen refusals per model cover unbound/wrong/rebound/undeclared namespaces,
reserved XML/XMLNS bindings, an empty prefixed binding, qualified mapping
attributes, duplicate decoded JSON names, noncanonical/lone-surrogate lexical
strings, DTD syntax and a literal escaped ampersand that must **not** be decoded
recursively into a namespace colon. Error classes/messages are recorded
separately, not required to match across runtimes. Positive decoded values and
all acceptance/refusal outcomes must match exactly.

These are ordinary expanded-name and scoped-binding rules from
[Namespaces in XML1.0](https://www.w3.org/TR/xml-names/), applied to the proposed
lexical carrier. Candidate bare `type`/`name-json` attributes differ from current
XML1's mapping; this study does not change XML1 or allocate the candidate URI.
Namespace spelling is not a new document identity or financial policy.

## Frozen identities and limits

`evidence/observations.json` pins the full exercised research helper closure,
actual loaded `fast-xml-parser/lib/fxp.cjs` bytes, original XML/model bytes,
JCS implementation, lockfile and relevant accepted specs/schema. It records
executed checkpoint `1a36fc43`, runtime versions and complete raw-stream hashes.
Node stdin is **889296 bytes** of strict UTF8 JSON; stdout is9963 bytes and
stderr empty. Per-case input hashes are hashes of actual XML UTF8 bytes, not
re-encoded reconstructed models. The only changed source after that execution
is this documentation and the archival verifier; decoder/collector bytes stay
pinned. The record itself has SHA256
`e61656e5f396e59c7dd2f82ee8e4dc60ba31916576778d018734c4c56f69aafe`.

The first local creation at `dbaa5f76` used an oversized pretty-printed stdin.
Its complete record and raw stdout/stderr remain in `initial-dbaa5f76/`; its
stdin is losslessly compressed with gzip mtime0. That original observation SHA256
is `a65ce3d21ad29bfaf960da98607c4dc52bd6469e3ee4ac58c13c7c36a2c38269`.
`check.py` verifies original byte hashes, exact parsed stdin/behavior equality
and the **single exact compact-transport source-line change**. No observed
answer was rewritten. Earlier pre-freeze failures found a research-reader
numeric-reference option and an incorrect collector provenance filename;
neither was a production defect or a frozen expectation change.

The Node helper deliberately covers <=1MiB ASCII XML, ASCII QName spellings and
depth<64, with no DTD/comment/CDATA declarations. It does not prove a general XML
parser, full namespace/name domain, every malformed-XML/security case, complete
schema/builtin admission, independent Markdown projection, authenticated source
completeness or cross-platform behavior. It reuses the earlier bounded model
validator; these synthetic models do not establish all required source metadata.
XML legality and universal fidelity still need governed specification, complete
domain fixtures and independent implementation gates before acceptance.

## Owner implication

The full-domain versus explicitly partial XML choice remains an owner decision;
this proof makes the recommended ASCII JSON-lexical option more concrete. Once
that carrier is selected, correct namespace scoping and expanded-name matching
follow XML precedent. They are implementation requirements, not additional
owner-controlled arithmetic or receipt decisions. Labels and versions remain
illustrative and RFC0089 stays draft.
