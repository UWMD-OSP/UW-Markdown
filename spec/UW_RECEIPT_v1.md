# UW Verification Receipt 1.0

**Media type:** `application/vnd.uwmd.receipt+json`
**Schema:** [`schemas/uw-receipt.schema.json`](schemas/uw-receipt.schema.json)
**Defining RFC:** [0016](../docs/rfcs/0016-verification-receipts.md) (accepted 2026-08-09)
**Status:** normative for receipt version `1.0`

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted
as described in RFC 2119.

## 1. Purpose and assurance boundary

A **verification receipt** is a small, detached JSON document stating which
underwriting record was checked, which deterministic calculation pack ran
against it, what that pack produced, and which policy set was applied. It is
bound to the record by a canonical digest and MAY be signed.

A receipt lets a party who did not run the calculation confirm, offline and
without the original tool, that a stated set of numbers follows deterministically
from a stated set of inputs.

A `verified` receipt attests exactly two things:

1. the record's canonical financial content is unchanged since issuance; and
2. the stated outputs follow deterministically from that content under the named
   pack and policy set.

It attests **nothing** about whether the inputs are true, complete, sourced from
genuine documents, or reasonable. A record asserting a fabricated NOI can carry a
perfectly valid receipt.

Implementations **MUST NOT** present a `verified` receipt using language that
implies the underwriting is correct, complete, audited, or approved. Interfaces
surfacing receipt status **MUST** make the distinction in this section available
to the reader rather than displaying an unqualified checkmark. This raises the
language in `UW_LITE_SPEC_v1.md` §9 to a requirement on every consumer.

## 2. Detachment

A receipt is a standalone document. It **MUST NOT** be embedded in the record it
describes. Embedding would break the Tier-2 byte-preservation invariant, would
make the record's digest depend on a value derived from that digest, and would
prevent a third party from issuing a receipt about a record they must not modify.

Transport is out of scope for this version; the object is transport-neutral. The
conventional sidecar spelling is `<record>.receipt.json`.

## 3. Document shape

```json
{
  "receipt_version": "1.0",
  "subject": {
    "representation": "uw-lite-markdown",
    "representation_version": "1.0",
    "canonicalization": "uw-lite-financial",
    "canonicalization_version": "1.0",
    "digest": "sha256:f930ebf20c9b0cc1159b65cc653f50a728fa07858080be5f6592ab307953d216"
  },
  "computation": {
    "pack": "org.uwmd.pack.multifamily",
    "pack_version": "1.0.0",
    "engine": "@uwmd/core",
    "engine_version": "1.1.2",
    "results": [
      { "calc_id": "dscr", "value": 1.2824864235841738, "unit": "x", "computed": true },
      { "calc_id": "ltv", "value": 0.6, "unit": "%", "computed": true },
      { "calc_id": "cash_on_cash", "value": null, "unit": "%", "computed": false }
    ],
    "results_digest": "sha256:…"
  },
  "policy": {
    "policy_set": "builtin",
    "policy_set_version": "1.0",
    "validation": { "errors": 0, "warnings": 2 }
  },
  "issued_at": "2026-08-09T00:00:00Z",
  "issuer": "uwmd-cli@1.1.3",
  "signature": null
}
```

The JSON Schema is normative for structure; this document is normative for
behavior.

### 3.1 Canonicalizations

`subject.canonicalization` names the canonical form the digest covers. Version
1.0 defines two:

| Name | Applies to | Definition |
| --- | --- | --- |
| `uw-lite-financial` | `uw-lite-markdown` | `UW_LITE_SPEC_v1.md` §6 financial canonical form |
| `uw-envelope-semantic` | `uwx-markdown` | RFC 8785 canonicalization of the Document Envelope semantic value (envelope minus `generated_at`, `generator`, `semantic_digest`) |

Both bind to a *semantic* form rather than raw bytes, so a receipt survives
reflowing a label, changing comma grouping, or normalizing line endings, and
fails only on financial change.

`subject.digest` **MUST** be SHA-256 over the exact UTF-8 bytes of the named
canonical form, serialized as `sha256:<lowercase hex>`.

### 3.2 Results

`computation.results` **MUST** contain every calc the named pack declares as an
output, and **MUST NOT** contain any value the pack did not compute. A receipt
is not a place to carry hand-entered numbers.

The calc engine reports "the record lacks these inputs" as a successful
evaluation to `null`. A receipt **MUST NOT** let that read as a computed value:
such an output is recorded with `"computed": false` and `"value": null`. When
`computed` is `false`, `value` **MUST** be `null`.

Results **SHOULD** be ordered by `calc_id` so re-issuance is byte-stable.

`computation.results_digest` is SHA-256 over the RFC 8785 canonicalization of
the `results` array. It exists to detect accidental corruption cheaply, and
never authorizes skipping recomputation (§5).

### 3.3 Signature

`signature`, when present, uses the wire shape RFC 0010 defines for block
signatures (`algorithm`, `key_id`, `value`) and covers the RFC 8785
canonicalization of the receipt with `signature` set to `null`. Key
distribution and revocation are out of band for 1.0.

## 4. Issuance

An issuer **MUST NOT** emit a receipt for a document whose parse produced any
`error`-severity issue. This extends the existing `UW_LITE_SPEC_v1.md` §5
refusal to every representation.

Issuance is total: an implementation either returns a complete receipt or raises
a typed error. It **MUST NOT** emit a partial, caveated, or provisional receipt.

An issuer **MUST NOT** name a pack that declares no version, and **MUST NOT**
name a pack that declares no calculations.

Validation `errors` and `warnings` are counted and recorded, but do **not**
block issuance — a receipt describes what the policy set found, and a record
that trips a threshold is still a record whose arithmetic can be attested.

**Re-issuance stability (invariant).** Re-issuing a receipt over an unmodified
record **MUST** reproduce the same `subject.digest` and the same `results`.
Only `issued_at` may differ.

## 5. Verification

A verifier **MUST** report exactly one of three states, and **MUST NOT** collapse
the third into either of the others:

- **`verified`** — the digest matches, recomputation reproduces every stated
  result to tolerance, and the signature (if present) validates.
- **`failed`** — the digest, a result, or the signature disagrees.
- **`unverifiable`** — the verifier lacks the named pack, pack version, engine,
  key, or a canonicalizable record, and therefore cannot decide. Absence of
  evidence is not a negative result.

A verifier **MUST** recompute rather than trust `results_digest`.

### 5.1 Precedence

Verifiers **MUST** apply these in order:

1. **Record not canonicalizable** (parse errors, undetectable representation) →
   `unverifiable` (`RCP-09`). There is nothing to compare against.
2. **Digest mismatch** → `failed` (`RCP-01`). This is decisive: the record's
   financial content changed after issuance, and no later check can rehabilitate
   it.
3. **Verifier cannot decide** → `unverifiable`: unknown pack (`RCP-05`), a
   different version of the named pack (`RCP-06`), or a signature with no
   available backend (`RCP-08`). A verifier without a signing backend **MUST NOT**
   silently ignore a signature.
4. **Signature present and invalid** → `failed`.
5. **Recomputation disagreement** → `failed` (`RCP-02` coverage, `RCP-03` value),
   *unless* the engine version also differs, in which case → `unverifiable`
   (`RCP-07`); see §5.3.
6. **`results_digest` does not recompute** → `failed` (`RCP-04`).
7. Otherwise → `verified`.

### 5.2 Tolerance

Numeric results agree when

```
|stated − recomputed| ≤ 1e-6 × max(1, |stated|, |recomputed|)
```

This is the repo's six-decimal calc/Excel parity bound expressed so it does not
become vacuous for values in the millions. Non-numeric results compare by strict
equality. A stated and recomputed result **MUST** also agree on `computed`.

### 5.3 Engine-version mismatch

*Resolves the open question in RFC 0016.* If recomputation disagrees and the
verifier's engine version differs from `computation.engine_version`, the verdict
is `unverifiable` with `RCP-07`, not `failed`. The disagreement cannot be
attributed to the record, and reporting it as a failure would blame a document
for an engine upgrade. If the engine versions match, a disagreement is `failed`.

An engine-version difference alone, with results agreeing, is **not** an issue:
determinism across versions is the expected case, and reporting it would train
users to ignore the state.

### 5.4 Issue codes

| Code | Verdict contribution | Meaning |
| --- | --- | --- |
| `RCP-01` | failed | Subject digest disagrees, or the signature did not validate |
| `RCP-02` | failed | Stated results do not cover exactly the pack's declared outputs |
| `RCP-03` | failed | A stated result disagrees with recomputation beyond tolerance |
| `RCP-04` | failed | `results_digest` does not recompute over the stated results |
| `RCP-05` | unverifiable | The named pack is unknown to this verifier |
| `RCP-06` | unverifiable | The verifier holds a different version of the named pack |
| `RCP-07` | unverifiable | Results disagree and the engine version also differs |
| `RCP-08` | unverifiable | A signature is present and no backend is available |
| `RCP-09` | unverifiable | The record could not be canonicalized for comparison |

## 6. Staleness

A Tier-2 editor **SHOULD** treat any existing receipt as stale once a write
lands, because the canonical digest changes. Presenting a stale receipt as
current is the principal way to misuse this feature.

## 7. Conformance

Conforming implementations are exercised by `conformance/receipts/`:

- `issue/` — record plus expected receipt (with `issued_at` stubbed).
- `verify/` — record plus receipt plus expected verdict, covering a clean
  verify, a record mutated after issuance, a result that disagrees with
  recomputation, and a receipt naming an unknown pack.
- `refuse/` — a document with parse errors and an assertion that issuance
  refuses rather than emitting an unsigned or caveated receipt.

Two invariants are asserted without a frozen baseline: re-issuance over an
unmodified record reproduces the same `subject.digest` and the same `results`
(§4), and a verifier presented with any receipt returns one of exactly the three
verdicts in §5.

## 8. Relationship to RFC 0010

RFC 0010 signed blocks attest *authorship and non-tampering of a block* — who
wrote it, unchanged since. A receipt attests *correctness of a computation over
a whole record* — these outputs follow from these inputs under this pack. The
two compose but answer different questions, and neither substitutes for the
other. A fully signed record can still carry arithmetic no pack would produce.

## 9. Reference implementation

`packages/uwmd-core/src/receipts.ts` implements unsigned issuance and
verification. Signature creation and validation live outside core so it stays
free of cryptographic dependencies; a verifier without a backend returns
`unverifiable` for a signed receipt.

CLI: `uwmd receipt issue <file>` and `uwmd receipt verify <file> <receipt.json>`.
