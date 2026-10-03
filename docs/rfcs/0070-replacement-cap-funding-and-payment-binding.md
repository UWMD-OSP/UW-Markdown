---
rfc: 0070
title: Bind outright replacement-cap funding to an exact modeled cash payment
status: accepted
accepted: 2026-10-02
author: codex
created: 2026-10-02
depends_on:
  - 0045
  - 0046
  - 0056
  - 0062
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
  - tooling
---

# RFC 0070: Replacement funding and an exact modeled cap-payment binding

## Summary

Add an OPTIONAL `rate_hedge.replacement_funding` discriminated object to Format
§4.7. `post_expiration_assumption: "replace"` continues to describe what the
underwriting assumes after the initial cap expires. Funding is separately
`escrow` or `outright`. Escrow retains RFC 0056's existing
`rate_cap_replacement` line; outright references one exact, already-stated
§4.26 payment row through its explicit variant, zero-based index, and a
separately verified binding digest. Date and amount remain in that cash row. Existing
valid RFC 0056 documents remain valid without edits. This is a modeled future
purchase, never evidence of an executed successor trade.

**Status: accepted, not implemented.** Jared accepted this RFC on 2026-10-02
under owner-led governance, with the semantics frozen at commit
`29c42c79e855fca4f97d82ec71596857370ca4b6`. Implementation was separately
 authorized on 2026-10-03; the source implementation awaits PR review and remains
unreleased. Acceptance does not change the released contract,
versions, conformance behavior or StackUW admission.

## Owner acceptance record

- **Decision:** Jared, the project owner, explicitly accepted RFC 0070 as a whole
  on 2026-10-02 (America/Phoenix), under the owner-led process in
  [GOVERNANCE.md](../../GOVERNANCE.md). No public-comment waiting period or
  waiver is required in that mode.
- **Frozen contract:** [draft commit
  `29c42c79e855fca4f97d82ec71596857370ca4b6`](https://github.com/UWMD-OSP/UW-Markdown/commit/29c42c79e855fca4f97d82ec71596857370ca4b6).
  The accepted wire shape, binding scope, validation/verification contract,
  economic semantics and fixture matrix are unchanged by this status record.
- **Disposition:** `accepted`; intent to implement is recorded, but the owner
  expressly withheld implementation authorization. This is not `implemented`
  and adds no released outright-funding capability.
- **Authorization boundary:** record acceptance and required documentation only.
  No normative spec/schema/protocol edits, validators, conformance changes,
  version bumps or release preparation are authorized. No active implementation
  spec/task matrix is started by this record.
- **Version direction:** retain Format 2.0; likely Protocol 2.21.0 and core/CLI
  2.17.0, subject to sequence reconciliation when separately authorized.
  Published Format 2.0 / Protocol 2.20.0 / core/CLI 2.16.0 remain unchanged.
- **Next decision:** separately authorize implementation using the sequence below.
  Release preparation and StackUW adoption remain later decisions and gates.

## Owner implementation authorization (2026-10-03)

Jared explicitly authorized implementation of the frozen contract from canonical
main `48fa1086671c0c229562457b98efd0a378969f78`. The authorization covers the synchronized
normative/core/consumer/conformance/documentation changes and their full gates.
The implementation specification and completed task matrix are archived at
`specs/archive/rfc-0070-replacement-funding.md` in the repository.
The historical acceptance boundary above records the earlier decision.

RFC status remains `accepted` until a separately authorized release ships.
No version number is consumed, release prepared, tag changed, package published
or StackUW adoption authorized. Implementation review and actual version/release
selection remain owner decisions.

## Motivation

Canonical baseline is `UWMD-OSP/UW-Markdown` main
`2fbf9250b200f6d4f455165bee35bbbc9cfe8dee`: Format 2.0, stable Protocol
2.20.0, released core/CLI 2.16.0. RFC 0056 is implemented. The immutable
`v2.16.0` tag remains on `a1ca815e2aee5da374caf7627ba3702849ecd257`.

### Demonstrated adopter requirement

[StackUW TASK-3294](https://github.com/jaredmaxey/underwriter-app/blob/9a6dfb9fad0f307df10031fef8ca49ced111afd8/tasks/queue/TASK-3294.md)
and [Q-1297](https://github.com/jaredmaxey/underwriter-app/blob/9a6dfb9fad0f307df10031fef8ca49ced111afd8/decisions/Q-1297.md)
identify a bridge with an initial rate cap expiring before the modeled loan/hold
ends. The replacement is purchased outright in a specified future loan month,
with a modeled premium paid from deal cash. There is no close-date replacement
reserve and no periodic escrow accumulation. The document must preserve the
model's amount and timing rather than manufacture escrow or reallocate cash.

At canonical adopter master `9a6dfb9fad0f307df10031fef8ca49ced111afd8`,
the existing export fixture states a $400,000 initial premium and a $360,000
outright replacement in loan month 25. Bridge `compute.ts` puts the latter
cost in `rateCapCostByMonth[24]`. The current exporter already emits a dedicated
§4.26 signed replacement-payment row. Its draft `rate_cap` projection is
producer-side convention, not the released UWMD `rate_hedge` contract.

The export fixture's `2002-01-01` comes from a default forecast anchor, not a
real closing date. TASK-3294 still needs its explicitly stated calendar anchor.
All 2026/2028 dates below are **synthetic public examples**. UWMD must not infer a
purchase date from that anchor, the export clock, or loan years.

### Released conflict

[Format §4.7/§4.8](../../spec/UW_FORMAT_SPEC_v1.md) and
[RFC 0056](0056-rate-hedges-and-escrows.md) require a named replacement escrow
whenever the typed assumption is `replace`. `upfront` means funded at close;
`monthly` means ongoing deposit. Neither means a single future payment.

The research brief at `docs/reviews/2026-10-02-outright-cap-replacement.md`
and its sibling `.evidence.json` output, committed at
`0b0c031a0f3bd45dffa8a06bce74c48637ce1e08`, show that a truthful §4.26
replacement row does not discharge ESC-04. A
zero-funded dummy escrow can pass selected checks, but asserts an account that
does not exist and fails to identify the future premium or its timing.

RFC 0056 explicitly made escrow mandatory in the released rule. No repository
evidence establishes that the owner considered and rejected outright funding.
The new outright branch is additive. Separately, missing `sources_uses`/`uses`
currently bypasses ESC-04 despite RFC 0056's released requirement. That skip is
an implementation/conformance defect of RFC 0056, not a newly imposed RFC 0070
economic rule. The regression plan below closes it.

## Proposed change

### 1. Wire shape: assumption and funding answer different questions

Extend `debt_structure.rate_hedge`, without changing the initial instrument:

```ts
interface ReplacementCashFlowRef {
  variant: string;        // exact same-document cash_flow_series variant
  row_index: number;      // nonnegative safe integer, zero-based, in range
  binding_digest: string; // sha256:<64 lowercase hex>; scope defined below
}

type ReplacementFunding =
  | { mode: 'escrow' }
  | { mode: 'outright'; cash_flow_ref: ReplacementCashFlowRef };

// New OPTIONAL member of rate_hedge:
replacement_funding?: ReplacementFunding | null;
```

Both union objects and the reference are closed: unknown members MUST refuse.
`mode` MUST be exactly `escrow` or `outright`. `escrow` MUST NOT carry a
`cash_flow_ref`; `outright` MUST carry the complete reference. There is no
default mode for an authored object.

Absent or null `replacement_funding` means the new member is not stated. For
`replace`, the unchanged legacy funding contract applies: require the named
replacement escrow. This is backward-compatible rule applicability, not
inference that escrow funds actually exist. A non-null funding object requires
a stated `rate_hedge` and `post_expiration_assumption: "replace"`.

One initial cap and one modeled replacement-payment binding are supported.
Multiple future replacements, partial/mixed escrow-plus-outright funding,
successor hedge terms and a general hedge lifecycle are outside this proposal.

### 2. Outright example: one economic cash fact

In a document with `currency_code: USD`, the relevant hedge members are:

```json
{
  "instrument": "rate_cap",
  "notional": 32500000,
  "strike_rate": 0.055,
  "index": "sofr",
  "effective_date": "2026-01-01",
  "expiration_date": "2028-01-01",
  "premium": 400000,
  "post_expiration_assumption": "replace",
  "replacement_funding": {
    "mode": "outright",
    "cash_flow_ref": {
      "variant": "cap-cash",
      "row_index": 1,
      "binding_digest": "sha256:3add19b25a3adb3d8bfa3f02977ecd14a53ead000abc4ad1ae99cd3d39fdf1fa"
    }
  }
}
```

The `cash_flow_series` block explicitly declares `variant=cap-cash` and
contains the following payload beside its host-owned metadata:

```json
{
  "label": "Interest-rate cap cash flows",
  "series": [
    {
      "date": "2026-01-01",
      "amount": -400000,
      "kind": "debt_service",
      "label": "rate_cap_premium"
    },
    {
      "date": "2028-01-01",
      "amount": -360000,
      "kind": "debt_service",
      "label": "rate_cap_replacement_purchase"
    }
  ]
}
```

The initial use remains `sources_uses.uses.rate_cap_cost: 400000`. The document
states no `rate_cap_replacement` escrow. The binding declares that row 1 is
the modeled future outright premium payment. It creates no additional cash
flow, moves no dollars, and does not declare an executed trade. Row labels and
`kind` retain their existing advisory meaning; these example spellings are
not reserved identities.

### 3. Exact row-reference semantics and consistency commitment

Use [RFC 0045](0045-explicit-property-cash-flow-assembly.md)'s source-snapshot,
explicit-variant and zero-based-row binding posture. That RFC's whole-document
digest lives in its output. Here the binding is stored **inside the document**,
so committing to the containing whole-document digest would be circular.

A conforming implementation MUST:

1. Resolve the current property-level `debt_structure` and
   `sources_uses` under existing RFC 0040 selection. This RFC does not extend
   hedge checks to component financing or introduce tranche-specific hedges.
   If a selection needed for a stated new funding object is ambiguous or
   unresolvable, refuse; never treat it as absence or choose by fence order.
2. Select the same document's current, nonsuperseded `cash_flow_series` block
   whose explicit variant identifier equals `cash_flow_ref.variant` exactly.
   No primary/base/default/sole-variant, role, date, label, cross-document,
   historical-block or first/last-fence fallback is permitted. A single block
   is eligible only when it explicitly declares the matching variant.
3. Structurally validate that selected series under §4.26. It must be nonempty;
   all rows must have real dates, finite amounts, legal row shapes/kinds and
   nondecreasing dates. Existing CF findings remain applicable. Metrics are
   outside binding verification; existing metric verification still applies
   when a consumer claims their correctness.
4. Require an in-range, nonnegative safe-integer `row_index`. Its identity is
   its ordinal in that exact ordered series, not a date selector or calc path.
5. Check the digest's syntax synchronously. Separately recompute and compare
   it through the async verifier in section 7 using the following **fixed scope**.
   Structural validation alone does not establish that the commitment matches.

The digest preimage is exactly:

```ts
{
  currency_code: parsed.frontmatter.currency_code ?? null,
  row_index: cash_flow_ref.row_index,
  section: 'cash_flow_series',
  series: selectedPayload.series,
  variant: cash_flow_ref.variant
}
```

`currency_code` is always a key in the canonical preimage. If authored as a
non-null value, use that exact value without trimming, case conversion or
inference; RFC 0046's existing CUR-01 rule still checks its validity. If absent
or explicitly null, use JSON `null`. Absence and null therefore have the same
canonical monetary identity. **No new requirement to author currency is added.**
The declaration binds the payment to the document's stated monetary identity,
including an explicitly unspecified identity. No currency is inferred from
locale, symbol, property location or renderer behavior, and no FX or per-row
currency rule is introduced. A malformed authored currency cannot be repaired
by the digest helper or verifier.

Serialize that preimage with exact RFC 8785 canonical JSON, UTF-8 encode, hash
with SHA-256, and prepend `sha256:` to its lowercase 64-hex result. There is
no financial rounding/quantization and no metadata normalization in this scope.
The entire ordered array and every authored row member are included. Absent
optional row members stay absent; explicit null remains null. Numeric JSON
spellings such as `360000` and `360000.0` canonicalize identically.

For the section 2 example's identical series/variant/index, these known answers
pin monetary identity:

| Authored document currency | Canonical preimage value | Binding digest |
|---|---|---|
| `USD` | `"USD"` | `sha256:3add19b25a3adb3d8bfa3f02977ecd14a53ead000abc4ad1ae99cd3d39fdf1fa` |
| absent or null | `null` (key retained) | `sha256:33072bf8b331730e37176a3fb1b1f80cb3fc1c398bed4746fcffc3d5b74ea63a` |

The preimage excludes the binding object, debt, document ID, section prose,
cash-series top-level label/day count/metrics, and all block metadata. Those
are not row identity. The fixed section value, exact variant, index, document
currency and ordered row content are the identity commitment. A metadata-only
revision or an unrelated document edit does not invalidate it.

This scope is intentionally more conservative than a hash of the selected row:

- Editing the index or variant without recommitting fails.
- Inserting, deleting or reordering distinguishable rows anywhere in the
  selected vector fails, even when the selected date/amount happen to match.
- Any authored row-content or canonical document-currency change fails.
  Removing a stated currency changes its canonical value to null; replacing
  absent currency with explicit null alone does not change the commitment.
- A different eligible cash row with the same date or amount cannot silently
  become the target while the old digest is retained.
- Swapping literally identical JSON rows makes no observable change to the
  ordered value vector. The binding still addresses the exact ordinal; this
  proposal does not invent a durable identity for economically indistinguishable
  occurrences. Date/label/amount equality is never a search or deduplication rule.

Async verification of a stale binding MUST fail with HDG-09. A consumer claiming
complete validation/verification MUST refuse it. Sync structural validation
cannot determine staleness and MUST NOT pretend to have checked it. An editor/exporter MUST NOT silently scan for a
similar row, renumber the reference, or refresh its digest during validation.
An intentional source edit requires an explicit reviewed rebind, represented
through the existing append-only edit/provenance rules. Validation is read-only.

The hash detects inconsistency, not malicious coordinated rewriting. It is not
a signature, original-source authenticity proof, executed-trade receipt, or
proof that an author has disclosed every cost. Existing signatures, provenance,
and adopter-source comparison retain those separate responsibilities.

### 4. Payment meaning and timing

The typed binding is the author's assertion that its row is a **dedicated
modeled future replacement-cap premium/payment from deal cash**, with no
replacement escrow. It MUST NOT target an escrow contribution, escrow release,
initial premium, interest/principal payment, or a net row combining the purchase
with other economic amounts. Hidden netting cannot be discovered from numbers
alone; adopter evidence must prove the dedicated source mapping.

For the outright branch:

- The bound amount MUST be finite and **nonpositive**. A zero-premium modeled
  replacement is allowed only as an explicitly stated zero row. Absence is
  never interpreted as zero. Positive inflows refuse. No pricing or sign
  conversion occurs.
- Its real `YYYY-MM-DD` date MUST be strictly after the current hedge's
  explicitly stated `effective_date`. “Future” is relative to this stated
  initial-hedge anchor, never the runtime clock, annotation timestamp, or a
  derived closing date.
- The date is a **modeled payment date**. It is not a normative assertion of
  trade execution, replacement-cap commencement, or settlement mechanics.
  A payment may be before, on, or after initial `expiration_date`, provided
  it is strictly after initial `effective_date`. No equality or ordering
  constraint relative to expiration is imposed.
- Nothing verifies continuous successor coverage or derives maturity/hold
  dates from `loan_term_years`. The author still states the post-expiration
  assumption. A binding does not prove successor terms or contractual commitment.

No required row kind or label is added. The typed binding supplies purpose;
the generic cash row supplies the stated amount and timing.

### 5. Funding truth table and refined ESC-04

Let “replacement escrow” mean the existing named entry in the selected
`sources_uses.uses.escrows`, subject to unchanged ESC-01/02/03.

| Assumption | New funding object | Replacement escrow | Required behavior |
|---|---|---|---|
| `replace` | absent/null | present and valid | Legacy escrow path; unchanged. |
| `replace` | absent/null | absent | ESC-04. |
| `replace` | `mode: escrow` | present and valid | Explicit escrow path. No cash-row reference allowed. |
| `replace` | `mode: escrow` | absent | ESC-04. |
| `replace` | `mode: outright` | absent | Sync: require valid binding structure/payment. Complete claim: also require async `verified`. |
| `replace` | `mode: outright` | present, including zero-funded | ESC-04: contradictory funding. |
| `unhedged` / `loan_matures_first` | absent/null | absent | Unchanged. |
| `unhedged` / `loan_matures_first` | non-null | either | HDG-07; any replacement escrow also retains ESC-04. |
| absent/invalid assumption | non-null | either | Existing HDG-06 plus HDG-07; replacement escrow retains ESC-04. |

**Proposed Format §4.8 text:** `replace` MUST have a valid replacement-funding
path. When the new member is absent/null or states `escrow`, the document
MUST state a valid `rate_cap_replacement` escrow. That escrow MUST be paired
with `replace` and MUST NOT coexist with `outright`. A valid explicit
`outright` branch instead requires the exact §4.26 modeled-payment binding
and MUST NOT state a replacement escrow. No other escrow name substitutes.

This refines the branch applicability of ESC-04; it does not make it optional.
Existing funding amounts may remain zero where RFC 0056 permits zero. This RFC
does not impose a new positive-balance rule on old escrow documents.

**Missing-section coverage:** the current validator returns early when
`sources_uses` or its `uses` is absent. Its unit test even pins that skip.
The released format rule does not grant such an exemption. The proposed
ESC-04 applicability check MUST occur independently of those early returns.
Legacy `replace` without its escrow then refuses even when the section is
missing. Existing normatively valid documents are unaffected; documents that
passed only this implementation coverage gap change verdict. This limited
correction is a planned repair of the already-released RFC 0056
implementation/conformance defect, not a new RFC 0070 economic requirement.
Add regression cases for both missing section and missing `uses`.
An explicit outright declaration itself states the absence of replacement
escrow; a missing optional sources/uses section is not a replacement-funding
path by itself. If sources/uses is present but unresolvable, outright cannot
claim its conflict check passed.

### 6. Proposed validation/error rules

The phase is part of the contract. HDG-07/08/10 are proposed synchronous
validation errors; HDG-09 is a proposed **async verification** error. No HDG-11
rule is proposed. Lack of hashing is not a structural error.

| Phase | Condition | Exact finding/result |
|---|---|---|
| Sync | Escrow branch (legacy absent/null funding or explicit escrow) lacks the named replacement escrow, including missing sources/uses | ESC-04. This includes the RFC 0056 coverage-defect regression. |
| Sync | Named replacement escrow without `replace`, or alongside outright mode, even if zero funded | ESC-04. Preserve existing ESC-01/02/03 for invalid escrow data. |
| Sync | Non-null funding object has illegal shape/mode, unknown members, missing required union members, reference under escrow, or is stated without `replace` | HDG-07. Missing `cash_flow_ref` or one of its required members is a shape failure; an authored member with invalid type/value is checked by HDG-08. |
| Sync | Exact cash variant missing/wrong/superseded, required section selection ambiguous/unresolvable, invalid/out-of-range index, malformed digest value, or illegal selected row/series structure | HDG-08. Preserve applicable existing CF findings. Never use fallback selection. |
| Sync | Validly addressed amount is positive, or valid payment date is on/before a valid stated initial effective date | HDG-10. Amount zero is valid; before/on/after expiration is valid when after effective date. |
| Sync | Invalid/missing initial hedge dates or other existing hedge facts | Existing HDG-01 through HDG-06, as applicable. Do not invent an anchor or add HDG-10 when its prerequisite anchor is invalid. |
| Sync | Authored non-null currency is malformed | Existing CUR-01. Absent/null currency has no currency finding and canonicalizes to null. |
| Sync | Binding digest has not been recomputed, or hashing is unavailable | **No error solely for this condition.** A clean structural result carries no claim of digest verification. Consumer status is `not_checked` until the separate verifier runs. |
| Async | Structurally eligible binding recomputes to stated digest | `verified`; no verification issue. |
| Async | Structurally eligible binding recomputes to another digest | `failed`, reason `stale_binding`; HDG-09 with stated/computed digests and exact variant/index. Sync may still be clean. |
| Async | Invalid prerequisites or unresolved source prevent verification | `unverifiable`, reason `invalid_structure` or `unresolvable_source`; expose relevant structural findings without claiming a digest comparison. |
| Async | Supported hash provider cannot perform the check | `unverifiable`, reason `crypto_unavailable`; no fabricated HDG-09 and no new structural error. |
| Consumer | Outright verifier not invoked | `not_checked`, reason `not_invoked`; cannot claim complete success. |
| Consumer | Outright structurally valid but verification `failed`, `unverifiable` or `not_checked` | Complete claim refuses, independently of the synchronous `ValidationResult` status. |
| Async | No outright binding is applicable and funding structure is lawful | `not_checked`, reason `not_applicable`; legacy funding relies on synchronous RFC 0056 checks. |

Initial-premium/use agreement remains unchanged. The successor payment does not
become part of `premium` or `uses.rate_cap_cost`.

Within a selected funding object, check shape/assumption first, selection and
reference next, then series structure and payment semantics. Stop that binding's
deeper checks when prerequisites are invalid; retain independent legacy/CF/CUR
errors. HDG-07 never creates a successful alternate funding path. ESC-04
independently reports applicable escrow conflict/absence; a well-formed outright
branch is exempt from **escrow-absence** ESC-04 but must pass its own HDG rules.
Preserve existing deterministic validation ordering. The async result is separate;
it does not remove, insert or reorder synchronous findings.

### 7. Synchronous validation and separate async binding verification

`validateUWFile(parsed, thresholdOverrides?)` retains its synchronous signature,
`ValidationResult` shape and structural purpose. Existing portable SHA-256 helpers
are asynchronous for Node/Web Crypto. Add a separate verifier following
`verifyChain`'s stronger-verification architecture; do not add an async replacement
for structural validation.

Proposed exact public API and result contract:

```ts
interface ReplacementFundingBindingContext {
  debt_variant: string | null; // selected property-level debt; null if unvariant
  cash_flow_variant: string;
  row_index: number;
  currency_code: string | null; // exact authored value, or canonical null
}

interface ReplacementFundingVerificationIssue {
  code: 'HDG-09';
  severity: 'error';
  section: 'debt_structure';
  field: 'rate_hedge.replacement_funding.cash_flow_ref.binding_digest';
  message: string;
  context: ReplacementFundingBindingContext;
  stated_digest: string;
  computed_digest: string;
}

type ReplacementFundingVerificationResult =
  | {
      state: 'not_checked';
      reason: 'not_invoked' | 'not_applicable';
      issues: readonly [];
    }
  | {
      state: 'unverifiable';
      reason: 'invalid_structure' | 'unresolvable_source' | 'crypto_unavailable';
      context: ReplacementFundingBindingContext | null;
      structural_issues: readonly ValidationMessage[];
      issues: readonly [];
    }
  | {
      state: 'failed';
      reason: 'stale_binding';
      context: ReplacementFundingBindingContext;
      stated_digest: string;
      computed_digest: string;
      issues: readonly [ReplacementFundingVerificationIssue];
    }
  | {
      state: 'verified';
      context: ReplacementFundingBindingContext;
      stated_digest: string;
      computed_digest: string;
      issues: readonly [];
    };

export declare function verifyReplacementFundingBindings(
  parsed: ParsedUWFile
): Promise<ReplacementFundingVerificationResult>;

export declare function computeReplacementCashFlowBindingDigest(
  series: readonly CashFlowRow[],
  variant: string,
  rowIndex: number,
  currencyCode: string | null
): Promise<string>;
```

These functions/types MUST be exported from `index.ts` and the browser-safe
entry. Reuse `canonicalizeExact` and the existing Node/Web Crypto hash seam.
No new dependency or synchronous crypto implementation is required. The digest
helper validates supported inputs, uses the fixed preimage in section 3 and
returns the prefixed digest. Its explicit null parameter represents absent/null
document currency. It never guesses currency, authors a funding object, stamps
metadata, searches rows or mutates input. Invalid helper arguments use a typed
`ProtocolError`; they are not silently normalized.

The verifier MUST capture an immutable snapshot before its first await, resolve
the selected property-level hedge and exact source against that snapshot, and
apply the same relevant structural prerequisites as the synchronous validator.
Relevant prerequisites are the funding rules, hedge facts needed for the binding,
escrow conflict check, exact reference selection, selected series structure,
payment semantics and currency validity. Unrelated financial validation findings
remain the caller's responsibility; a verified binding is not a verified deal.

Result semantics are exact:

- `verified` occurs only after successful recomputation and equality. Both
  digests are present and equal; context identifies the checked source snapshot.
- `failed` occurs only after recomputation and inequality. Both digests
  are present and unequal; its single HDG-09 issue reports that comparison.
- `unverifiable` has no computed-digest success claim. Invalid structural
  prerequisites use `invalid_structure`; missing/ambiguous required selection
  uses `unresolvable_source`. The latter takes precedence when source
  selection prevents assessment. Both expose applicable structural findings.
  A hash-provider failure uses `crypto_unavailable` with a resolved context
  and no structural findings. It must not manufacture a mismatch.
- `not_checked/not_applicable` is returned when the selected funding path
  is lawfully escrow-funded, or no outright requirement applies. Malformed
  stated new funding or unresolved required selections return `unverifiable`
  instead; they cannot be hidden as not applicable.
- `not_checked/not_invoked` is a consumer's initial status before invocation,
  not an outcome returned after the verifier checks an applicable binding.
  Consumers retaining only synchronous validation MUST expose this status
  for outright documents. Omitting the async call never establishes `verified`.

No result changes synchronous `overall_status`, readiness or error arrays.
No verification outcome changes the file. Digest equality proves consistency of
the declared source snapshot, not payment purpose, executed-trade status,
authenticity or a calculation.

For any consumer claiming complete validation/verification of outright funding,
success requires **both** successful structural validation **and**
`replacement_funding_verification.state === 'verified'`. Call both against
one immutable parsed snapshot; caller mutations while hashing must not change
the verdict. Legacy escrow funding needs no digest and can complete through its
unchanged structural rules, with `not_applicable` binding status.

During implementation, CLI `validate` text/JSON, MCP validation results and
built-in web validation consumers claiming this capability MUST invoke the
verifier. Preserve existing root `ValidationResult` fields; add a separate
`replacement_funding_verification` result member on the claimed-complete
consumer payload, rather than folding verification into structural issues.
Text output labels structural status and binding-verification state separately.
CLI exit status MUST be nonzero for applicable outright `failed`,
`unverifiable` or `not_checked`, and for existing structural refusal;
a clean structural report alone cannot produce complete-success output. No
feature flag may silently disable verification while retaining that claim.
A sync-only editor may report structural validation plus explicit not-checked
status; it must qualify its result and cannot advertise complete verification.

## Compatibility analysis

### Existing files and implementations

- Valid legacy escrow-funded replacement files are unchanged byte-for-byte and
  remain valid without a funding object, row binding or document currency.
- Existing `unhedged`, `loan_matures_first`, hedge-absent and no-cap documents
  acquire no new funding data or hashing errors.
- Files exploiting the missing-sources/uses ESC-04 coverage gap become errors
  under the already-required funding rule. No valid legacy document is redefined.
- Old schema consumers reject the new hedge member; old validators report
  ESC-04 for the new no-escrow branch. That is expected capability mismatch,
  not permission to fabricate an escrow.
- Tier-1 readers retain parsing/display of optional data; normative funding
  validation uses the structural checks; complete outright verification also
  requires the separate async result. Tier-2 editors preserve bytes
  outside edits and must flag stale bindings after source changes rather than
  silently repair them. Tier-3 calculations are unchanged. Tier-4 hosts extract
  stated facts and host-owned provenance; they do not price or derive funding.
- Modules gain no manifest/section/calc-grammar change. Component hedges and
  multiple-tranche ownership are not added. The existing property-level
  selection seam remains authoritative.
- The existing synchronous validation ABI remains. Structurally valid outright
  documents can have a clean synchronous result; that result does not check the
  digest. Complete outright claims require the separate async verifier's
  `verified` result. No deprecation/removal or unchecked-binding error is added.
- Stated series metrics, waterfalls and property assembly remain their current
  contracts. A valid financing binding never makes RFC 0045's unlevered stream
  eligible to include the hedge expenditure.

### Versioning

Propose retaining **Format 2.0**, following Protocol §0.3 and RFC 0069's
implemented optional-section-data precedent. The v2 delta incorporates v1
Part IV; this adds optional data/schema rules without changing file grammar or
metadata. Historical RFC 0056's “Format minor” prose does not override the
current actual release policy.

This requires format prose and schema edits **plus** a Protocol minor; it is
not a Protocol-only weakening or patch erratum. Expected next available
Protocol is **2.21.0**, and expected core/CLI generation is **2.17.0**, if
no intervening accepted change or release takes those slots.

Protocol-minor applicability is explicit opt-in: the old escrow branch is
preserved and the new branch has stronger deterministic evidence requirements.
The owner-selected direction permits an old tool to refuse new-feature files;
it does not promise that every new file validates under every prior protocol.
The missing-section coverage correction enforces existing normative behavior.

No version is selected or bumped by this acceptance record. The owner accepted
this versioning direction; later preparation must reconcile actual versions anew.

### Static/Excel and representation fidelity

No cap pricing, payoff projection, forward-curve data, mark-to-market,
swap/collar expansion, escrow roll-forward or invented funding is introduced.
The adopter's cash flows are not modified, and a modeled future payment does
not imply an executed replacement trade. No pack formula, financial total,
rate scaling, tolerance, currency quantum or Excel calculation changes. The declaration is a link, not an additional cash
charge. Static/Excel consumers must display/copy source facts without adding
the linked payment twice; any future financial cash-assembly consumer requires
its own contract and parity proof. Generic lossless JSON/XML/CSV representations
retain the nested reference and ordered series. View projections follow existing
omission reporting. No swap/collar, curve, payoff, MTM or account-state semantics.

## Conformance impact

No fixture is added or changed by this draft. On implementation, **retain
unchanged** all 17 existing `conformance/hedge/` scenarios, including
`accept-full-hedge-and-escrows`, `accept-no-hedge-stated`,
`reject-replace-without-escrow`, `reject-replacement-escrow-without-assumption`
and both reserved-instrument refusals. Existing cash-flow/period cases remain
unchanged. Pin legacy accepted file bytes/digests before and after validation;
do not add the new member or currency to those fixtures.

Update the unit assertion exempting missing sources/uses: it pins the RFC 0056
implementation/conformance defect. Add separate regressions for missing section
and missing `uses`. The default hedge driver and portable driver/manifest must
exercise synchronous findings and separate async results; neither may treat
structural success as complete outright success.

All rows below assume other existing requirements are valid. `not_applicable`
means `not_checked` with that reason; `failed` always means `stale_binding`
with the single async HDG-09 issue.

| Proposed scenario(s) | Synchronous result | Async/consumer result |
|---|---|---|
| `accept-legacy-escrow-byte-valid` | Existing escrow document accepted with no edits, new object or currency requirement | `not_applicable`; file bytes/digest unchanged |
| `accept-explicit-escrow-funding` | Existing named escrow plus new escrow mode accepted | `not_applicable`; no new payment obligation |
| `accept-outright-replacement-payment` | Exact $360,000 bound row with no replacement escrow accepted | `verified`; complete consumer succeeds |
| `accept-outright-same-day-distinct-rows` | Same-day outflows retained; exact ordinal addresses the stated payment | `verified`; both source rows unchanged |
| `accept-explicit-zero-premium-row` | Explicit future zero row accepted; no fabricated negative amount | `verified` with its zero-row commitment |
| `accept-payment-before-expiration`, `accept-payment-on-expiration`, `accept-payment-after-expiration` | All accepted if strictly after effective date | `verified`; no execution/commencement assertion |
| `accept-outright-currency-absent`, `accept-outright-currency-null` | Both accepted; no currency error or inferred USD | `verified` with the same canonical-null commitment |
| `reject-escrow-mode-without-escrow` | ESC-04 | `unverifiable/invalid_structure` |
| `reject-legacy-replace-without-sources-uses`, `reject-legacy-replace-without-uses` | ESC-04; regression of released RFC 0056 defect | `unverifiable/invalid_structure` |
| `reject-outright-with-replacement-escrow` | ESC-04 for positive or zero-funded replacement escrow; unrelated escrow allowed | `unverifiable/invalid_structure` |
| `reject-funding-under-nonreplacement` | Both modes under either nonreplacement assumption: HDG-07; any replacement escrow also ESC-04 | `unverifiable/invalid_structure` |
| `reject-funding-shape` | Unknown mode/member, missing/null reference or missing required member, reference under escrow: HDG-07 | `unverifiable/invalid_structure` |
| `reject-payment-source` | Missing/wrong/superseded variant, role-only fallback or ambiguous required selection: HDG-08 | `unverifiable/unresolvable_source` |
| `reject-zero-payment-row-missing` | Missing row/empty source does not count as zero: HDG-08 and applicable CF findings | `unverifiable/invalid_structure` |
| `reject-payment-index` | Noninteger/negative/unsafe/out-of-range index: HDG-08; omitted member: HDG-07 | `unverifiable/invalid_structure` |
| `reject-payment-digest-shape` | Malformed/uppercase/unprefixed/nonstring digest: HDG-08; omitted member: HDG-07 | `unverifiable/invalid_structure` |
| `reject-payment-retargeted-index` | Another valid same-day outflow plus old digest: structurally accepted | `failed`; complete consumer refuses |
| `reject-payment-retargeted-variant` | Another present variant with equal row data plus old digest: structurally accepted | `failed`; complete consumer refuses |
| `reject-payment-stale-series` | Structurally legal row insertion/deletion/edit or distinct same-day reorder with old digest: accepted structurally | `failed`, even if addressed date/amount still match |
| `reject-payment-stale-currency` | Valid currency change or stated currency removal with old digest: accepted structurally | `failed`; absent-to-null alone stays `verified` |
| `reject-payment-row-structure` | Bad date/nonfinite value/unknown kind/unordered vector: HDG-08 and existing CF findings | `unverifiable/invalid_structure` |
| `reject-payment-direction-or-anchor` | Positive amount or date on/before valid effective date: HDG-10 | `unverifiable/invalid_structure` |
| `reject-payment-invalid-effective-date` | Existing HDG date finding; no invented anchor or downstream HDG-10 | `unverifiable/invalid_structure` |
| `reject-payment-currency-malformed` | CUR-01 for malformed authored non-null currency | `unverifiable/invalid_structure` |
| `binding-not-invoked` | Otherwise clean; no hashing/pending error | Consumer explicitly `not_checked/not_invoked`; cannot claim complete success |
| `binding-crypto-unavailable` | Otherwise clean; no hashing error | `unverifiable/crypto_unavailable`; CLI complete verdict refuses |
| `accept-binding-insensitive-to-unrelated-edit` | Metadata/prose/metrics/unrelated block edit accepted | `verified`; selected row/label change instead stales |
| `accept-reviewed-rebind` | Deliberate source/index edit with recomputed commitment accepted | `verified`; preserve source amounts and append-only provenance |

Pin both authored-USD and canonical-null known-answer vectors. Include object
key-order, JSON numeric-spelling, row-member null-versus-absence, frontmatter
currency absence-versus-null and Node/browser digest agreement controls.
Mutation of the caller's original parsed document while hashing must not change
the checked snapshot. Complete consumer tests cover CLI text/JSON exit statuses,
MCP state and browser state for verified, stale, unchecked and unavailable cases.
Tests must prove sync results contain no digest-pending error and no async
mismatch finding, while the separate verification result reports HDG-09.

The adopter acceptance proof must also retarget the reference to a structurally
valid unrelated outflow **and recompute its digest**. UWMD can check that new
statement's consistency but cannot know it misstates source economics; the
adopter's source-mapping test must fail. This distinguishes consistency from
authenticity and prevents a claim that hashing proves purpose.

## Reference implementation

Implementation remains a follow-up **only after separate explicit owner
authorization**. Acceptance is recorded above; no source change is authorized.

Planned files/surfaces:

- Format §4.7/§4.8 prose in `spec/UW_FORMAT_SPEC_v1.md`, incorporated by v2.
- `spec/schemas/debt-rate-hedge.schema.json`: optional closed union and binding
  shape. Escrow and generic §4.26 row schemas keep their existing semantics.
- `spec/UW_PROTOCOL_v1.md`: refined validation applicability, commitment
  procedure, complete-validation obligations and HDG family descriptions.
- `packages/uwmd-core/src/protocol.ts`: executable declarations/rules and
  remediation entries synchronized with protocol/schema, including distinct
  validation and verification applicability for proposed HDG codes; no version bump
  during draft work. Proposed types `ReplacementFunding` and
  `ReplacementCashFlowRef` are additive.
- `validator.ts` and `validator.hedge.test.ts`: funding truth table,
  missing-section regression repair and synchronous structural/payment checks.
  No digest-pending error.
- New focused `replacement-funding.ts` / `replacement-funding.test.ts`:
  exact selection, immutable snapshots, digest helper and separate async verifier.
  Reuse existing canonicalization/hashing; no new dependencies.
- `index.ts` / `browser.ts`: export additive functions/types.
- `cli.ts`, `bindings.ts`, relevant built-in web validation consumers and
  their tests: invoke the verifier, expose its separate state and require
  `verified` wherever complete outright capability is claimed.
- `scripts/run-conformance.mjs`, portable cases/driver, new hedge scenarios,
  wiki data model/testing/status and user-facing adoption documentation.
  Ordinary financial packs and Excel formulas are untouched.

### Acceptance and implementation sequence

1. **Owner acceptance — complete:** Jared accepted the frozen `29c42c7` contract
   on 2026-10-02. The acceptance record above pins the full source commit.
   This completed decision does not authorize the remaining implementation steps.
2. **Explicit implementation authorization:** after acceptance, reconcile main
   and create `specs/active/SPEC.md` and its ordered `TASKS.md` only if this
   feature is the selected active work. Do not displace another active spec.
   Exactly one task is in flight; check it off only after applicable gates
   and its commit.
3. **Atomic normative implementation:** land synchronized format/schema/protocol,
   executable declarations, structural validator, separate verifier and conformance.
   Include the shared known-answer digest and immutable-snapshot tests.
   No temporary release may accept outright funding while skipping its digest.
4. **Consumer integration:** prove core async, browser crypto, CLI text/JSON
   exit status, MCP result and built-in claimed consumers agree. Sync-only callers
   retain clean structural results when appropriate and
   expose `not_checked`; they cannot claim complete verification. Legacy
   controls preserve byte-validity except for documents exploiting the disclosed
   RFC 0056 implementation defect.
5. **Deterministic gates:** build; full tests; all default conformance suites;
   schema validation; lint; verify-lockfile; verify-packages; verify-versions;
   verify-indexes; verify-codes; docs build, plus release-readiness checks when
   a generation is later prepared. Run `npm ci` only if dependencies/lockfile
   or workspace linking actually change. None is required by this design.
6. **Separate owner release decision:** re-check actual semver sequence, prepare
   the selected package generation and exact dependency pins, then use existing
   release-prepared/tag/publication verification. Do not alter v2.16.0.
   RFC becomes `implemented` only after the accepted implementation ships.
7. **Stack adoption:** satisfy the released condition below, resolve Q-1297,
   refresh TASK-3294 admission/scope and complete its downstream proofs.
   TASK-3295 waits for TASK-3294's durable DONE state.

### Exact StackUW unblock condition

TASK-3294 remains **SCOPED**, and TASK-3295 remains downstream, until a released,
declared Protocol/core/CLI pairing includes this accepted funding union,
separate async digest verification and conformance for both funding paths
and their refusals. Stack must vendor that release and invoke both structural
validation and the separate async verifier for the new binding. An unaccepted draft, accepted-but-unreleased implementation or
absence of ESC-04 alone does not unblock export.

Stack's own task then needs an actual stated calendar anchor, exact copying of
the engine's future purchase amount/date into the existing §4.26 row, the
matching binding commitment, no invented escrow, unchanged financial results,
no-cap byte/digest controls, and its required deliberate capped-document
digest/provenance event. A zero modeled premium needs an explicit zero row if
exported under this branch; its current omission policy cannot create a binding.
This RFC authorizes neither named export refusal nor silent purchase omission.

## Alternatives considered

| Alternative | Reason not selected |
|---|---|
| Inline date/amount duplicated in funding | Repeats the existing economic fact and risks divergence or double charge. The chosen row remains the source of amount/timing. |
| New `replace_outright` assumption enum | Mixes post-expiration outcome with funding and expands a closed assumption enum unnecessarily. |
| Date, label or amount matching | Same-day and equal-value rows are legal; free-text labels are advisory. Not exact identity. |
| Variant and index alone | Insertion/reordering or editing the index can silently redirect the statement. |
| Selected-row digest alone | Does not commit to the ordered snapshot; equal rows or insertions can preserve content while changing ordinal context. |
| Whole-document digest inside the funding object | Self-referential because the document contains that digest. Existing RFC 0045 output evidence avoids this cycle; an authored binding needs a nonrecursive scope. |
| Full block hash/revision plus index | Depends on metadata/provenance churn and optional stamps; would require separate stamp verification. The cash-vector/index/currency commitment is narrower and recomputed directly. |
| New row IDs or generic event section | Widens §4.26 or introduces a lifecycle carrier beyond the demonstrated single-payment requirement. |
| Claim complete success from the stated digest or sync result alone | A structurally clean result cannot detect stale commitments. Keep sync structural validation and require the separate async verifier for complete outright claims. |
| New synchronous crypto implementation | Duplicates the browser/Node hashing seam and increases maintenance for no semantic gain. |
| Weaken ESC-04, fabricate escrow, or change financial cash | Erases the actual funding distinction and violates the adopter requirement. |

## Unresolved questions

**No genuine economic or semantic owner questions remain for this revision.**
The owner review settles structural/async separation, explicit zero cost, timing
strictly after initial effective date with no expiration constraint, repair of the
released ESC-04 coverage defect, byte-valid legacy escrow funding and optional
authored currency with canonical null.

The owner accepted the final wire shape, canonical scope, exact API/result
contract, matrices and versioning analysis at frozen commit `29c42c7`.
No genuine owner questions block implementation planning. Implementation
remains subject to separate explicit authorization.

Mixed funding, multiple replacements, successor coverage, post-sale financing
assembly and executed-trade records remain deferred to separate adopter-backed
contracts. No pricing formula, tolerance or numerical convergence choice is
introduced.

## Prior art

- [RFC 0045](0045-explicit-property-cash-flow-assembly.md) and Protocol
  §VIII.9c: exact variants, zero-based row ordinals and source-snapshot-qualified
  evidence; advisory kinds cannot substitute for economic classification.
- [RFC 0056](0056-rate-hedges-and-escrows.md): typed initial cap and mandatory
  escrow tie; [RFC 0058](0058-expense-recoveries-and-cam-true-up.md) uses §4.26
  as the dated cash sink; [RFC 0062](0062-same-day-cash-flow-selection.md)
  preserves separate same-day rows.
- Protocol §V.9 and the existing `canonicalizeExact` / SHA-256 seam provide
  deterministic canonical bytes. This draft adds the fixed binding preimage;
  it does not change existing block/document digest semantics.

## Draft verification record

This documentation-only draft revision modifies no normative file, implementation,
conformance fixture, version or release record. The original research
reproduced ESC-04 from current released code; those results remain historical
evidence, not tests of an unimplemented proposal. Draft verification results
are recorded in the commit's accompanying response.
