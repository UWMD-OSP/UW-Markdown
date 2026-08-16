---
rfc: 0025
title: Scale percent displays by moving the point, not by dividing
status: draft
author: uwmd-core
created: 2026-08-16
affects:
  - format-spec
  - core-library
  - conformance-corpus
---

# RFC 0025: Scale percent displays by moving the point, not by dividing

## Summary

UW Lite normalizes a percent display by dividing the displayed number by 100.
For most rates that is exact, but for some it is not: `Number('5.51') / 100` is
`0.055099999999999996`, one ULP away from the `0.0551` that the literal
`0.0551` denotes. The normalized value flows into the RFC 8785 canonical form
and therefore the SHA-256 digest, so a Lite-compiled `5.51%` and a
hand-authored UWX `0.0551` are different doubles, produce different digests, and
do **not** compare equal under semantic equivalence or an RFC 0016 receipt —
even though every human involved wrote the same rate. This RFC requires exact
decimal-point scaling, versions the Lite canonicalization to `1.1`, and adds
`RCP-10` so a verifier holding a pre-`1.1` receipt reports `unverifiable`
rather than accusing an untouched record of having changed.

It is the third instalment of the numeric-determinism arc: RFC 0023 made a
*reported* number reproducible, RFC 0024 made a *searched* one reproducible,
and this one makes an *ingested* one reproducible.

## Motivation

`UW_LITE_SPEC_v1.md` §4 already states the intended semantics — its table maps
`5.50%` to `0.055`, the decimal the display denotes. It does not say *how* to
get there, and the reference implementation chose division:

```ts
// packages/uwmd-core/src/lite.ts
return { ok: true, value: Number(percent[1]) / 100, unit: explicitUnit ?? 'fraction' };
```

Division agrees with the spec's table for every example the spec gives, which is
why this survived review: `5.50`, `5.75`, and `6.25` all divide exactly in
binary64. It disagrees the moment a rate does not, and the spec's silence means
two conforming implementations — one dividing, one shifting — produce different
digests for the same bytes. That is an interoperability defect in a format whose
central promise is that a digest identifies financial content.

Three things make it worth fixing now rather than later:

1. **It is silent.** Nothing errors. Two documents that should be equivalent
   simply are not, and the failure surfaces as a receipt reporting `failed` —
   i.e. as an accusation of tampering.
2. **The corpus hid it.** Every Lite fixture in `conformance/` uses
   5.50%/5.75%/6.25%/5.00%/-1.50%, all of which divide cleanly. The T11 example
   `examples/Parkview-Apts-Glendale-AZ.uw.md` is the first document in the repo
   to use a rate that does not (`5.51%`), and it is the *only* affected document
   in the entire corpus.
3. **Digests are permanent.** Every day this stands, more receipts are issued
   over the wrong canonical form, and each one has to be migrated rather than
   just superseded.

## Proposed change

### `UW_LITE_SPEC_v1.md` §4.1 — new subsection

> A percent display denotes the decimal number obtained by moving its decimal
> point two places to the left. An implementation **MUST** produce the value
> that decimal literal denotes, and **MUST NOT** compute it by dividing the
> displayed number by 100.

With the worked `5.51%` case, a note that cleanly-dividing displays are
unaffected, and a **SHOULD** that any future scaled display form use the same
rule rather than introducing a second division site.

### `UW_LITE_SPEC_v1.md` §6 / §6.1 — canonicalization version `1.1`

The canonicalization version moves `1.0` → `1.1`, and §6.1 states that it is
versioned **independently of the Lite grammar**, which does not change: `5.51%`
parsed before and parses now, and no document needs editing. A digest computed
under a different canonicalization version is not comparable to one computed
under this version.

### `UW_RECEIPT_v1.md` §5.1, §5.4, §5.5 — `RCP-10`

Precedence step 2 gains a carve-out: a digest mismatch is `failed` *unless*
`subject.canonicalization_version` also differs, in which case the verdict is
`unverifiable` with `RCP-10`. §5.5 states the rule and its two limits — it
applies only when the digests already disagree, and it is keyed on the version
*differing*, not on it being older, since a verifier cannot assume it holds the
newer rules.

This is deliberately the same shape as the §5.3 engine-identity carve-out, one
step earlier in the precedence and for the same stated reason.

### `@uwmd/core`

Additive, with one behavior change:

- **New exports:** `UW_LITE_CANONICALIZATION_VERSION` (`'1.1'`),
  `UWX_CANONICALIZATION_VERSION` (`'1.0'`).
- **New issue code:** `RCP-10` on `UWReceiptIssueCode`.
- **Changed behavior:** percent normalization in `lite.ts`; verification
  precedence in `receipts.ts`.
- **Bug fixed in passing:** Lite issuance stamped
  `canonicalization_version` from `UW_LITE_REPRESENTATION_VERSION`, conflating
  the canonicalization version with the grammar version. UWX already kept them
  separate (it hardcoded `'1.0'`), so Lite was the odd one out. Had this not
  been separated first, bumping the canonicalization version would have falsely
  claimed the Lite *grammar* changed.

## Compatibility analysis

**Existing `.uw.md` files** — none become invalid. The grammar is untouched; no
document needs editing. Documents containing a percent that does not divide
exactly get a different canonical digest than they did before.

**Existing receipts** — a receipt issued before this change over an affected
document no longer verifies as `verified`. It reports `unverifiable`
(`RCP-10`), which is the correct three-state answer: the verifier genuinely
cannot decide, because it no longer implements the rules the receipt was issued
under. It specifically does **not** report `failed`, which is what would happen
without the `RCP-10` carve-out and which would be a false accusation. Receipts
over unaffected documents — the large majority — continue to verify normally,
because their digests still match and a version difference alone is not an
issue.

**Implementers by tier** — Tier-1/2/4 unaffected; none normalize percent
displays. Tier-3 unaffected: the calc engine consumes already-normalized
fractions and no pack declares a percent-display input. A Lite reader that
divides is now non-conforming, which is the point of the RFC.

**Modules** — no manifest schema change and no change to declared sections,
calculations, or validations.

**Migration path.** Re-issue receipts over affected documents. There is no
deprecation window, and none is useful: the old behavior is not a contract
anyone can correctly depend on, since it produces a value the spec's own §4
table says is wrong. `RCP-10` *is* the migration path — it makes a stale receipt
legible instead of alarming.

## Conformance impact

**Existing fixtures needing update — two, both narrow:**

- `conformance/receipts/issue/02-lite-industrial/expected-receipt.json` —
  `canonicalization_version` `1.0` → `1.1`. The **digest is unchanged**: this
  deal uses 5.75%/6.25%, which divide exactly.
- `conformance/receipts/verify/02-record-mutated/receipt.json` — restamped to
  `1.1`. Without this the fixture's receipt would trip the new `RCP-10` path and
  degrade to `unverifiable`, silently destroying the only fixture that proves a
  genuine mutation is caught. Restamping keeps it testing what it was written to
  test.

**No Lite fixture digest changes.** All 90 assertions in `conformance/lite/`
pass untouched, because every fixture rate divides cleanly. This is worth
stating plainly: the corpus is *why* the defect survived, so it cannot also be
the evidence that the fix is correct.

**New fixture:**

- `conformance/receipts/verify/06-lite-canonicalization-superseded/` — a Lite
  deal using `5.51%`, plus a receipt stamped `canonicalization_version: "1.0"`
  carrying the genuine pre-fix digest, expecting `unverifiable` + `RCP-10`. The
  old digest is reconstructed from the current canonical form by substituting
  the one number the two eras disagree about, so the fixture pins a real
  historical value rather than an invented one.

## Reference implementation

Implemented alongside this RFC, per the owner-led process in
`docs/rfcs/README.md` step 3.

- **Files affected:** `packages/uwmd-core/src/lite.ts` (new
  `scaleDecimalLiteral` helper, applied at the one percent site),
  `receipts.ts` (version constants, `RCP-10`, precedence), `index.ts` /
  `browser.ts` (exports), `spec/UW_LITE_SPEC_v1.md`,
  `spec/UW_RECEIPT_v1.md`, `spec/schemas/uw-receipt.schema.json` (description
  only — the field was already `type: string`, so old and new receipts both
  validate).
- **Test plan:** six new core tests. Percent scaling is asserted with `toBe`
  against `Number('0.0551')` — `toBeCloseTo` would pass with the bug present,
  so the strict equality is the assertion that has teeth. Coverage includes the
  sign, no-point, bare-fraction, trailing-zero, and zero-padding paths; an
  explicit `not.toBe(5.51 / 100)`; and a test that cleanly-dividing rates still
  equal their divided form, which is what makes the empty conformance diff
  legible rather than suspicious. Two receipt tests cover `RCP-10` firing and,
  importantly, *not* firing for a genuine mutation at a matching version.

## Alternatives considered

**Do nothing / document the quirk.** The value is deterministic, so nothing is
"broken" in the reproducibility sense. Rejected: determinism is not the only
property that matters here. Two spellings of one rate must agree across
representations, or the digest stops identifying financial content and starts
identifying which authoring path produced it. It also leaves the spec's §4 table
stating something the implementation does not do.

**Parse to a decimal type and keep it.** Store rates as arbitrary-precision
decimals end to end. This is the genuinely correct long-term answer and would
also fix any future scaled form. Rejected for now: it changes the JSON value
type in the canonical form, so it moves *every* digest in the corpus rather than
one document's, and it interacts with RFC 0023's quantization boundary and the
calc engine's binary64 model. That is a much larger RFC; this one is deliberately
the smallest change that closes the interoperability hole.

**Round the divided result to a fixed precision.** `Math.round(x * 1e6) / 1e6`
or reuse RFC 0023's `quantizeDecimal`. Rejected: it papers over the wrong
operation and introduces a precision ceiling on *input* data that the spec does
not have. RFC 0023's quantization is explicitly the boundary where a *computed*
value becomes a *reported* one; an author-supplied input has not been computed
and should not be quantized. Reusing it here would blur the one boundary 0023
went to trouble to make singular.

**Bump `representation_version` instead of adding a canonicalization version.**
Rejected: it would claim the Lite grammar changed, which it did not, and would
break the descriptor negotiation in `source-representation.ts` for a change no
parser can observe.

**Let stale receipts report `failed`.** Simpler — no `RCP-10`, no precedence
change. Rejected outright: it reports tampering for a document nobody touched.
This is precisely the defect RFC 0023 closed inside `receipts.ts`, and
reintroducing it one layer up would be a regression against a decision this
project already made.

## Unresolved questions

**Does UWX have the same defect?** UWX authors write fractions directly, so
there is no scaling step and no equivalent site — but this RFC has not audited
every UWX ingestion path (`fromWorkbook.ts`, the CSV bundle codec) for other
display-to-value conversions that divide. Deferred to a follow-up audit; the
percent site is the one with a known reproduction.

**Should the canonical renderer round-trip be tightened?** `lite-bridge.ts`
renders a fraction back to a percent with `value * 100` under
`maximumFractionDigits: 6`, which is display-only and never reaches a digest.
The rounding masks the reciprocal error today. Left alone deliberately — it is
outside the digest boundary — but a symmetric decimal shift there would be
tidier, and RFC 0023's `%` default of six decimals on the *fraction* means the
display cap is nominally two digits shy.

**When does canonicalization `1.0` stop being supported?** This RFC does not set
an expiry, and deliberately notes that it is repeating the open-ended-transition
choice `docs/wiki/13-status.md` already flags for legacy `.uw.md` sniffing.
Worth settling for both at once before 1.0.

## Prior art

IEEE 754 decimal-to-binary conversion is correctly rounded, which is exactly why
shifting the point and re-parsing is exact where dividing is not — the same
reason `strtod`-based parsers are preferred over digit-accumulation loops.
CockroachDB and PostgreSQL both scale `NUMERIC` by adjusting the exponent rather
than dividing, for the same correctness reason. The versioning split mirrors
JSON Canonicalization Scheme (RFC 8785) practice, where the canonicalization is
a named, versioned artifact independent of the data model it serializes.
