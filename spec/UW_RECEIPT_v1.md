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
    "engine_version": "1.2.0",
    "protocol_version": "1.3.0",
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
2. **Digest mismatch** → `failed` (`RCP-01`), *unless* the receipt's
   `canonicalization_version` also differs from the one this verifier applies,
   in which case → `unverifiable` (`RCP-10`); see §5.5. Absent that, the
   mismatch is decisive: the record's financial content changed after issuance,
   and no later check can rehabilitate it.
2a. **A referenced input resolved and its digest disagrees** → `failed`
   (`RCP-12`); see §10. Checked here, above the indeterminate group, because a
   reference the verifier holds and can compare is real evidence, and ordering
   it later would let an unknown pack mask a mutated observation set.
3. **Verifier cannot decide** → `unverifiable`: unknown pack (`RCP-05`), a
   different version of the named pack (`RCP-06`), a signature with no
   available backend (`RCP-08`), or a referenced input the verifier does not
   hold (`RCP-11`). A verifier without a signing backend **MUST NOT**
   silently ignore a signature, and one without a referenced input **MUST NOT**
   silently ignore the reference.
4. **Signature present and invalid** → `failed`.
5. **Recomputation disagreement** → `failed` (`RCP-02` coverage, `RCP-03` value),
   *unless* the issuing engine identity also differs, in which case →
   `unverifiable` (`RCP-07`); see §5.3.
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

### 5.2.1 Protocol version

`computation.protocol_version` is OPTIONAL and states the UW Protocol version
the issuer computed under. An issuer conforming to 1.3.0 or later **SHOULD**
populate it.

It exists because `engine_version` cannot answer the question a verifier
actually has — "are these values quantized per §VIII.5?" An engine version only
means something to a reader who knows that engine's release history, and a
third-party issuer's history is exactly what a verifier does not have. A
protocol version is the one identifier every conforming issuer shares.

Absence means **unstated**, not non-conforming: a receipt issued before the
field existed cannot retroactively claim a version. A verifier **MUST NOT**
treat absence as a failure.

### 5.3 Engine-identity mismatch

*Resolves the open question in RFC 0016.* If recomputation disagrees and the
verifier's engine identity differs from the receipt's, the verdict is
`unverifiable` with `RCP-07`, not `failed`. The disagreement cannot be
attributed to the record, and reporting it as a failure would blame a document
for an engine upgrade. If the engine identities match, a disagreement is
`failed`.

Engine identity is the pair `(computation.engine, computation.engine_version)`,
and a verifier **MUST** compare both. A version string is only ordered within
one engine's release history: `2.1.0` of an unrelated implementation is not a
build of this engine that happens to be newer, so treating a bare version match
across two different `engine` values as "same engine" would report a genuine
cross-engine disagreement as `failed` and blame the record for it.

An engine-identity difference alone, with results agreeing, is **not** an issue:
determinism across engines and versions is the expected case, and reporting it
would train users to ignore the state.

### 5.4 Issue codes

| Code | Verdict contribution | Meaning |
| --- | --- | --- |
| `RCP-01` | failed | Subject digest disagrees, or the signature did not validate |
| `RCP-02` | failed | Stated results do not cover exactly the pack's declared outputs |
| `RCP-03` | failed | A stated result disagrees with recomputation beyond tolerance |
| `RCP-04` | failed | `results_digest` does not recompute over the stated results |
| `RCP-05` | unverifiable | The named pack is unknown to this verifier |
| `RCP-06` | unverifiable | The verifier holds a different version of the named pack |
| `RCP-07` | unverifiable | Results disagree and the engine identity also differs |
| `RCP-08` | unverifiable | A signature is present and no backend is available |
| `RCP-09` | unverifiable | The record could not be canonicalized for comparison |
| `RCP-10` | unverifiable | Digests disagree and the canonicalization version also differs |
| `RCP-11` | unverifiable | A referenced input is not available to this verifier |
| `RCP-12` | failed | A referenced input resolved, but its digest disagrees |

### 5.5 Canonicalization-version mismatch

*Added by RFC 0025.* A digest is only evidence about a record when both sides
computed it under the same rules. If the subject digests disagree **and**
`subject.canonicalization_version` differs from the version this verifier
applies for that canonicalization, the verdict is `unverifiable` with `RCP-10`,
not `failed`.

This is the same carve-out §5.3 makes for engine identity, one step earlier in
the precedence and for the same reason: a verifier must not report that a
document was tampered with when the only thing that changed is its own
arithmetic. The concrete case is UW Lite canonicalization `1.1`, which fixed
percent scaling (`UW_LITE_SPEC_v1.md` §4.1) and so moved the digest of every
Lite document containing a percent that does not divide exactly — while the
documents themselves stayed byte-identical.

Two limits keep the carve-out narrow. It applies **only** when the digests
already disagree: a version difference with matching digests is not an issue at
all, and verification proceeds normally, which is the common case since most
documents are unaffected by any given rules change. And it is keyed on the
version *differing*, not on it being older — a verifier cannot assume it holds
the newer rules, and **MUST NOT** attempt to re-canonicalize under the
receipt's version unless it actually implements it.

A verifier that implements multiple canonicalization versions **MAY** recompute
under the receipt's stated version and, if that digest matches, continue to the
remaining checks rather than stopping at `RCP-10`.

`canonicalization_version` is versioned independently of
`representation_version`: the rules for producing canonical bytes can change
without the source grammar changing, and an implementation **MUST NOT** stamp
one field from the other.

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

## 10. Input provenance (format 1.1)

*Established by [RFC 0022](../docs/rfcs/0022-market-data-documents.md) §3;
amended by [RFC 0021](../docs/rfcs/0021-composable-documents.md) §6.*

### 10.1 Why one section rather than two

A receipt attests that stated outputs follow from stated inputs. When an input
is not in the subject record — a market-data observation set, or a child record
inside a composite — the receipt must name it, or the computation is not
reproducible against the inputs actually used.

RFC 0021 and RFC 0022 were accepted the same day and both needed this. They
share **one** section with a `source` discriminator rather than two parallel
lists, because the verifier's handling is identical in both cases: resolve the
reference, compare the digest, and keep "I cannot find it" distinct from "it
does not match". That distinction is the reason this is a normative structure
and not a comment field.

### 10.2 Shape

```json
{
  "inputs_provenance": [
    {
      "source": "market_data",
      "document_id": "md:phx-multifamily:2026-Q2",
      "as_of": "2026-06-30",
      "digest": "sha256:<64 lowercase hex>"
    }
  ]
}
```

- `inputs_provenance` is OPTIONAL. A receipt over a record that consumed no
  external input omits it entirely. This is what keeps a 1.0 receipt readable
  under 1.1: every addition is optional, so absence means *the issuer stated
  nothing*, never *non-conforming*.
- `source`, `document_id`, and `digest` are REQUIRED on each entry. `digest`
  MUST match `sha256:[0-9a-f]{64}`.
- `as_of` is OPTIONAL at this layer, because not every source has a vintage. A
  `market_data` entry always carries one in practice: `market-data-v1` refuses
  to parse without `as_of`, so an entry lacking one could not have been produced
  from a conforming observation set.
- `document_id` MUST be unique within the array. Two entries for one id would
  make the digest comparison depend on iteration order.
- `source` is an **open** union. `market_data` (RFC 0022) and `child_record`
  (RFC 0021) are registered; an implementation encountering an unrecognized
  source MUST carry it and report it as unresolvable (`RCP-11`) rather than
  rejecting the receipt or ignoring the entry.
- An issuer MUST NOT derive these entries by guessing what a record might have
  used. The host supplies them, because only the host knows what it resolved
  against; a fabricated entry would make a receipt claim an input it never used.
- An issuer SHOULD emit entries sorted by `document_id`, so re-issuance over an
  unchanged record reproduces identical bytes regardless of the order the host
  listed them in (§7's re-issuance invariant).

### 10.3 Verification

A verifier holds some set of referenced artifacts. For each entry:

| Verifier state | Verdict contribution |
|---|---|
| Holds it, digest matches | no issue; continue |
| Holds it, digest differs | `failed` (`RCP-12`) |
| Does not hold it | `unverifiable` (`RCP-11`) |

A verifier that holds none of the named references reports `unverifiable`. It
MUST NOT report `verified`, because it has not checked something the receipt
says the computation depended on — and it MUST NOT report `failed`, because an
absent reference set is not evidence of tampering. This is the same three-state
discipline §5 already applies to unknown packs and to signed receipts with no
backend.

A verified receipt over a record that consumed market data means: the stated
outputs follow deterministically from these inputs, and **these particular
observations** were the ones used. It does not mean the observations are
accurate, current, representative, or that the provider is competent.

### 10.4 Versioning

This section takes `receipt_version` from `1.0` to **`1.1`**, and that bump
covers **both** RFC 0021 and RFC 0022. RFC 0021's rollup entries are additive
within this section — `source: "child_record"` — and MUST NOT bump the version
again. Two independent bumps for two simultaneously-accepted RFCs would make the
version meaningless, so the discipline RFC 0018 §5 established for the edge
registry applies here: RFC 0016 owns this format, and later amendments extend
this section rather than forking a parallel one.

A verifier MUST accept both `1.0` and `1.1`.
