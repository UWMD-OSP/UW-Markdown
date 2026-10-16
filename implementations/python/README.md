# Independent Python structured Reader foundation

Issue [#354](https://github.com/UWMD-OSP/UW-Markdown/issues/354).
This unpublished, incomplete implementation is written independently from the
Format and Protocol. It uses Python's standard library and has no Node runtime,
external packages, hosted services, production fixture lookup, or TypeScript
translation. No PyPI name, supported Python floor or publication is decided.

The discovery manifest advertises only `parse`, **no Reader/Verifier tier,
validation, calculation, signature, receipt or optional-profile capability**.
The adapter currently reads structured Format 3.0 Markdown only. It is not ready
to verify a UWMD record or certify every Reader requirement.

Implemented:

- Original UTF-8 bytes, BOM/CRLF preservation, physical block order, exact JSON
  number lexemes/pointers/byte spans, duplicate-name and malformed-source refusals.
- Appendix D frontmatter scalar/mapping/sequence parsing, including YAML quoted
  escapes and comments, with retained numeric lexemes and byte spans.
- Required frontmatter values, unknown fields/sections/extensions, last-active
  singleton selection, superseded history, registered parallel sections, active
  role-based variant opt-in and append-only collection projections.
- Payload-level Protocol VIII.2a period identities and the five registered series:
  inspect every row, preserve source order, detect year-key collisions, and
  select by exact identity with the RFC 0062 same-day cash-flow exception.
  PS-01/PS-02 evidence is partial structural inspection, not document validation.
- The earlier independent seed's integer Gregorian date/day-count arithmetic,
  decimal quantizer, ordered cash totals and MOIC. These remain a small numeric
  seed, not `calc-evaluate` or financial-verification conformance.

```sh
python3 -B -m unittest discover -s implementations/python -v
python3 -B implementations/python/uwmd.py manifest
python3 -B implementations/python/uwmd.py parse conformance/documents/fixtures/01-minimal-screening.uwx.md
python3 -B conformance/runner/runner.py --impl 'python3 -B implementations/python/uwmd.py' --tier reader --no-skip
```

Observed on Python 3.12.3/Linux: **44 unit methods passed**; the genuine portable
Reader run passed **17/17**, with zero skips, failures or unverifiable cases.
That portable run is separate from the ten source-scanner tests, which inspect
17 fixture inputs but do not compare their canonical parse projections.
The additional unit method executes all nine Reader-owned malformed source
fixtures against their existing refusal codes; those cases are not portable
driver projections. Other environments require their own recorded runs.

Remaining Reader review includes complete Appendix D key-type semantics,
representation edge cases, and stronger
malformed/ambiguous-source controls. Active extension-role opt-in retains every
named variant and unannotated peer in either source order. This
seed refuses non-string-resolving bare YAML keys rather than guessing a JSON key
coercion. It preserves every physical source block even where the portable
projection exposes only the canonical value. It does not implement a signing
projection or infer verified continuity from retained history.

Full Format validation, document-level period/role resolution for calculations, safe-expression
evaluation, dictionary checking, all applicable Protocol II.2 stated-figure
verifiers, receipts and receipt verification remain outstanding. Missing,
unsupported and failed assertions must remain distinguishable. Passing Reader
projections does not discharge any of those obligations.

Issue [#356](https://github.com/UWMD-OSP/UW-Markdown/issues/356) separately affects
cross-runtime power/logarithm procedures, annuities and periodic/dated returns.
This implementation chooses none of the draft alternatives, does not hard-code
Node observations as the contract and makes no cross-runtime bit-identity claim.
Parsing, structural checks and explicit evidence/identity coverage can continue
without a new numerical decision. Draft RFCs 0085–0087 and Issue #355's optional
financial assurance profile remain separate and unaccepted here.

See [the implementation evidence and requirement inventory](../../docs/reviews/2026-10-15-python-reader-354.md).

The period foundation takes an **already selected section payload**. It does not
select active variants, parse selector paths, traverse leaves, apply overrides,
or inspect formulas for PS-03. `inspect_period_series` reports source-relative
JSON pointers and returns original row objects; `select_period_row` inspects the
whole series before returning one row. Neither API rewrites, nets or reorders
source. Missing identities warn and remain absent rather than being inferred.
No new CLI command or manifest capability is advertised.

Additional local evidence on Python 3.12.3/Windows: **59 unit methods passed**
(the unchanged 44 plus 15 period controls). The actual portable Reader driver
remains **17/17**, zero skips/failures/unverifiable cases. This does not add
Verifier conformance passes. The recovery snapshot's registry/identity concepts
were selectively reconciled against current VIII.2a/RFC 0062; its Reader,
calendar replacement, broad resolver and historical result claims were not
imported. No numerical investigation was repeated.
