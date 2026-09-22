# Golden-deal release comparison

Date: 2026-09-21

## Scope

A private, independently calculated underwriting corpus was used as an adopter
acceptance suite for the released UWMD implementation and the next implementation
on `main`. The private corpus remains outside this repository. This record contains
only de-identified counts, outcomes, and defect classification; it contains no
source documents, deal names, tenant or resident data, local paths, or deal values.

The corpus was frozen at commit `719ff38`. The compared UWMD targets were:

- published `v2.12.0`;
- `main` at `83339b5`.

## Results

| Evidence | Result |
|---|---:|
| Frozen Artifact B assertions accounted for | 532 |
| Assertions passed | 526 |
| Documented source/baseline defects | 6 |
| Refusal assertions passed | 20 |
| Runnable control/deal cases passing on `main` | 8 |

The six exceptions are frozen source or baseline defects, not UWMD failures. They
remain recorded rather than being changed to make the implementation pass.

Two development cases remain explicitly evidence-blocked:

- GD04 requires a frozen development pro forma.
- GD07 requires a frozen purchase price, leases, and development/operating
  program.

No missing inputs were synthesized to make either case run.

## Released-version defect

Seven model-bearing cases failed on published `v2.12.0` at the first UW JSON
model-fidelity round-trip. Empty frontmatter arrays were serialized as bare YAML
keys, which reparsed as `null` and changed the semantic digest:

```text
[] -> bare YAML key -> null -> different semantic digest
```

The source, validation, crosswalk, deterministic calculation, and receipt stages
completed before that round-trip assertion. The parser-only negative case, which
does not perform a model-fidelity round-trip, passed.

`main` at `83339b5` serializes an empty frontmatter array as `[]`. The full suite
then passes, including UW JSON, UW XML, and UW CSV bundle model-fidelity checks.
This is an implementation/representation serialization defect. It does not
indicate a missing format field, protocol rule, calculation primitive, or other
reason to expand the standard.

## Independence and limits

Artifact A and Artifact B were independent of the UWMD implementation under
test. UWMD did not regenerate financial expected values, and the comparison did
not modify the frozen source models, expected outputs, or authored reference
records.

This acceptance result does not close the roadmap's RFC 0045 real-deal property
cash-flow assembly item. The available annual models do not establish RFC 0045's
required complete monthly or quarterly lease-up periods and supplemental
cash-flow coverage. That evidence remains pending; no periodic schedule was
manufactured for this review.
