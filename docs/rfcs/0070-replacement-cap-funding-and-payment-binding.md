---
rfc: 0070
title: Bind outright replacement-cap funding to an exact modeled cash payment
status: draft
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
recomputed binding digest. Date and amount remain in that cash row. Existing
valid RFC 0056 documents remain valid without edits. This is a modeled future
purchase, never evidence of an executed successor trade.

**Authorization:** Jared selected this semantic direction on 2026-10-02 and
authorized drafting only. This RFC remains **draft**. It does not authorize
acceptance, normative edits, validator implementation, conformance changes,
version bumps, release preparation, or StackUW admission.

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
The new branch is an additive requirement, not permission to ignore ESC-04.

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
5. Recompute and compare `binding_digest` by the following **fixed scope**.

The digest preimage is exactly:

```ts
{
  currency_code: parsed.frontmatter.currency_code,
  row_index: cash_flow_ref.row_index,
  section: 'cash_flow_series',
  series: selectedPayload.series,
  variant: cash_flow_ref.variant
}
```

`currency_code` MUST be stated and valid under RFC 0046 for the new outright
branch. The funding declaration asserts that the bound payment is denominated
in that document currency. No FX or per-row currency inference is introduced.

Serialize that preimage with exact RFC 8785 canonical JSON, UTF-8 encode, hash
with SHA-256, and prepend `sha256:` to its lowercase 64-hex result. There is
no financial rounding/quantization and no metadata normalization in this scope.
The entire ordered array and every authored row member are included. Absent
optional row members stay absent; explicit null remains null. Numeric JSON
spellings such as `360000` and `360000.0` canonicalize identically.

The preimage excludes the binding object, debt, document ID, section prose,
cash-series top-level label/day count/metrics, and all block metadata. Those
are not row identity. The fixed section value, exact variant, index, document
currency and ordered row content are the identity commitment. A metadata-only
revision or an unrelated document edit does not invalidate it.

This scope is intentionally more conservative than a hash of the selected row:

- Editing the index or variant without recommitting fails.
- Inserting, deleting or reordering distinguishable rows anywhere in the
  selected vector fails, even when the selected date/amount happen to match.
- Any authored row-content or document-currency change fails.
- A different eligible cash row with the same date or amount cannot silently
  become the target while the old digest is retained.
- Swapping literally identical JSON rows makes no observable change to the
  ordered value vector. The binding still addresses the exact ordinal; this
  proposal does not invent a durable identity for economically indistinguishable
  occurrences. Date/label/amount equality is never a search or deduplication rule.

A stale binding MUST refuse. An editor/exporter MUST NOT silently scan for a
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
- Purchase/payment date is distinct from successor coverage commencement.
  This RFC does not force payment equal to, or after, initial expiration:
  a replacement may be purchased before the current cap expires.
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
| `replace` | `mode: outright` | absent | Require the full valid payment binding and digest verification. |
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
correction is part of this RFC, not an invitation to suppress sections.
An explicit outright declaration itself states the absence of replacement
escrow; a missing optional sources/uses section is not a replacement-funding
path by itself. If sources/uses is present but unresolvable, outright cannot
claim its conflict check passed.

### 6. Proposed validation/error rules

These are proposed new rules, not current emitted codes. All are errors.

| Code | Deterministic refusal |
|---|---|
| `ESC-04` | Required escrow branch lacks its named escrow; named replacement escrow lacks `replace`; or named replacement escrow conflicts with `outright`. |
| `HDG-07` | Non-null replacement-funding object has illegal shape/mode, unknown members, missing required union members, forbidden reference under escrow, or is stated without `replace`. |
| `HDG-08` | Exact source/reference cannot resolve, a required section selection is ambiguous, index is invalid/out of range, digest string has invalid shape, or selected cash row/series has illegal structure. Preserve applicable existing CF codes. |
| `HDG-09` | Recomputed binding digest differs from the stated digest. Include expected/stated and recomputed digests plus the exact source variant/index in the message/evidence. |
| `HDG-10` | Validly addressed payment has positive amount, does not follow a valid stated initial effective date, or lacks valid stated document currency. Preserve applicable HDG-01/CUR-01 findings rather than inventing date or currency. |
| `HDG-11` | A structurally eligible outright binding has not undergone required digest verification, or the hash provider is unavailable. This is not a successful funding verdict. |

Existing HDG-01 through HDG-06 remain unchanged, including initial-premium/use
agreement. The successor purchase does not become part of `premium` or
`uses.rate_cap_cost`.

Within a selected new funding object, check shape/assumption first, selection
and reference next, then series structure and payment semantics, then digest.
Stop this binding's deeper checks when their inputs are invalid; retain all
independent legacy/CF/CUR errors. A malformed explicit mode yields HDG-07;
it never creates a successful alternate funding path. ESC-04 independently
reports an applicable escrow conflict/absence. Use existing deterministic
validator order for the document and replace the digest-pending issue at its
position when completing verification.

### 7. Synchronous structural validation and complete verification

Existing `validateUWFile` is synchronous; the existing portable SHA-256
helpers are asynchronous to support Web Crypto. This draft proposes **one
additive complete-validation entry point**, not a breaking conversion of the
existing API:

```ts
validateUWFileAsync(
  parsed: ParsedUWFile,
  thresholdOverrides?: Partial<FinancialThresholds>
): Promise<ValidationResult>;

computeReplacementCashFlowBindingDigest(
  series: readonly CashFlowRow[],
  variant: string,
  rowIndex: number,
  currencyCode: string
): Promise<string>;
```

The helper uses the exact preimage above, checks its supported inputs, and
returns the prefixed digest. It does not author a funding object or stamp
`_meta`. Invalid inputs must use a typed `ProtocolError`, not a bare error.

`validateUWFile` MUST perform the new synchronous funding/selection/payment
checks and emit HDG-11 for an otherwise eligible outright binding. It MUST NOT
return a clean complete-funding verdict while leaving a commitment unchecked.
Documents with no outright branch do not acquire a pending finding.

`validateUWFileAsync` MUST capture one immutable snapshot of the parsed
document and thresholds before awaiting hashing. On that snapshot it runs the
same structural validation and completes each eligible digest check. It removes
only the HDG-11 finding it has actually resolved, substituting HDG-09 on
mismatch, or retaining HDG-11 if hashing is unavailable. It rebuilds the normal
`ValidationResult` issue/severity/status/readiness aggregates consistently;
no result field may claim success against a different snapshot or hide an
unrelated error. It performs no writes and no financial calculations.

Both functions/types must be exposed through `index.ts` and the browser-safe
entry. Reuse `canonicalizeExact` and the existing Node/Web Crypto hashing
seam; introduce no external npm dependency or separate SHA-256 implementation.

Protocol §II validation surfaces, the CLI `validate` command in both output
modes, the MCP validation result, and any built-in validation consumer advertising
this new outright capability MUST use complete validation. Older synchronous
callers can retain their API and receive the explicit HDG-11 refusal on a new
outright document; they cannot claim successful adoption by inspecting only
the absence of ESC-04. No feature flag may silently disable the required check.

## Compatibility analysis

### Existing files and implementations

- Valid legacy escrow-funded replacement files are unchanged byte-for-byte and
  remain valid without a funding object, row binding or document currency.
- Existing `unhedged`, `loan_matures_first`, hedge-absent and no-cap documents
  acquire no new funding data or pending errors.
- Files exploiting the missing-sources/uses ESC-04 coverage gap become errors
  under the already-required funding rule. No valid legacy document is redefined.
- Old schema consumers reject the new hedge member; old validators report
  ESC-04 for the new no-escrow branch. That is expected capability mismatch,
  not permission to fabricate an escrow.
- Tier-1 readers retain parsing/display of optional data; normative funding
  validation requires the new complete checks. Tier-2 editors preserve bytes
  outside edits and must flag stale bindings after source changes rather than
  silently repair them. Tier-3 calculations are unchanged. Tier-4 hosts extract
  stated facts and host-owned provenance; they do not price or derive funding.
- Modules gain no manifest/section/calc-grammar change. Component hedges and
  multiple-tranche ownership are not added. The existing property-level
  selection seam remains authoritative.
- The existing synchronous validation ABI remains. New successful outright
  validation uses the additive async API. No deprecation/removal is proposed.
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

No version is selected or bumped by this draft. Acceptance should reaffirm the
versioning interpretation; preparation must reconcile actual versions anew.

### Static/Excel and representation fidelity

No pack formula, financial total, rate scaling, tolerance, currency quantum or
Excel calculation changes. The declaration is a link, not an additional cash
charge. Static/Excel consumers must display/copy source facts without adding
the linked payment twice; any future financial cash-assembly consumer requires
its own contract and parity proof. Generic lossless JSON/XML/CSV representations
retain the nested reference and ordered series. View projections follow existing
omission reporting. No swap/collar, curve, payoff, MTM or account-state semantics.

## Conformance impact

No fixture is added or changed by this draft. On implementation:

**Retain unchanged** all 17 existing `conformance/hedge/` scenarios, including
`accept-full-hedge-and-escrows`, `accept-no-hedge-stated`,
`reject-replace-without-escrow`, `reject-replacement-escrow-without-assumption`,
and both reserved-instrument refusals. Existing cash-flow/period cases remain
unchanged. Update the core unit assertion that currently exempts absent
sources/uses, because it contradicts the normative requirement above.

Add named scenarios under `conformance/hedge/` and dispatch them through
complete validation. The existing default hedge driver must adopt that entry
point; the portable driver/manifest must cover the new contract rather than
testing only parser preservation.

| Proposed scenario(s) | Required result / negative control |
|---|---|
| `accept-explicit-escrow-funding` | New escrow mode plus existing named escrow; no new purchase obligation. |
| `accept-outright-replacement-payment` | Exact bound $360,000 future row, no replacement escrow; no HDG/ESC errors after complete verification. |
| `accept-outright-same-day-distinct-rows` | Two eligible same-day outflows; reference addresses its exact ordinal and leaves both rows unchanged. |
| `accept-explicit-zero-premium-row` | Explicit future zero row allowed; absent row does not count as zero. |
| `accept-early-replacement-purchase` | Payment after initial effective date but before expiration; no inferred successor coverage. |
| `reject-escrow-mode-without-escrow`, `reject-legacy-replace-without-uses` | ESC-04, including absent source section/object. |
| `reject-outright-with-replacement-escrow` | ESC-04 for positive or zero-funded replacement escrow; unrelated tax/insurance escrows permitted. |
| `reject-funding-under-nonreplacement` | Both nonreplacement assumptions with either mode produce HDG-07; replacement escrow also produces ESC-04. |
| `reject-funding-shape` | Unknown mode/member, null/missing outright reference, reference under escrow; HDG-07. |
| `reject-payment-source`, `reject-payment-index` | Missing/wrong/superseded variant, role-only fallback, ambiguous required sections, omitted/noninteger/negative/out-of-range index; HDG-08. |
| `reject-payment-digest-shape` | Omitted/malformed/uppercase/unprefixed digest; HDG-07 if required member absent, otherwise HDG-08. |
| `reject-payment-retargeted-index` | Change only index to another valid same-day outflow, retaining old digest; HDG-09. |
| `reject-payment-retargeted-variant` | Change to another present variant with equal row data, retaining old digest; HDG-09. |
| `reject-payment-stale-series` | Insert/delete/edit rows while preserving structure, or reorder distinct same-day rows, with the old digest; HDG-09 even when the addressed date/amount match. Illegal ordering instead follows HDG-08/CF-02. |
| `reject-payment-stale-currency` | Change valid document currency with old digest; HDG-09. |
| `reject-payment-row-structure` | Bad date/nonfinite value/unknown row kind/unordered vector; HDG-08 with existing CF findings. |
| `reject-payment-direction-or-anchor` | Positive row or date on/before initial effective date; HDG-10. No wall-clock comparison. |
| `reject-payment-currency` | Missing/malformed document currency; HDG-10, preserving applicable CUR-01. |
| `reject-unchecked-binding` | Sync validator emits HDG-11; async mismatch emits HDG-09; unavailable crypto remains HDG-11. CLI/MCP must expose the complete result and fail appropriately. |
| `accept-binding-insensitive-to-unrelated-edit` | Provenance/prose/metrics/unrelated-block edit preserves digest; selected row/label change does not. |
| `accept-reviewed-rebind` | Deliberate index/source edit with newly computed commitment; original monetary values/provenance preserved. |

Pin the example commitment as a portable known-answer vector. Include key-order,
JSON numeric-spelling, null-versus-absence and Node/browser digest agreement
controls. Verify a caller mutating its original document while the async hash is
pending cannot change the verdict's snapshot.

The adopter acceptance proof must also mutate the reference to a structurally
valid unrelated outflow **and recompute its digest**. UWMD can validate that
new statement's structure, but cannot know it misstates the source economics;
the adopter's source-mapping test must fail. This negative control distinguishes
consistency from authenticity and prevents a claim that hashing proves purpose.

## Reference implementation

Implementation is a follow-up **only after explicit owner acceptance and
authorization**. No source change is authorized by this draft.

Planned files/surfaces:

- Format §4.7/§4.8 prose in `spec/UW_FORMAT_SPEC_v1.md`, incorporated by v2.
- `spec/schemas/debt-rate-hedge.schema.json`: optional closed union and binding
  shape. Escrow and generic §4.26 row schemas keep their existing semantics.
- `spec/UW_PROTOCOL_v1.md`: refined validation applicability, commitment
  procedure, complete-validation obligations and HDG family descriptions.
- `packages/uwmd-core/src/protocol.ts`: executable declarations/rules and
  remediation entries synchronized with protocol/schema; no package/version bump
  during draft work. Proposed types `ReplacementFunding` and
  `ReplacementCashFlowRef` are additive.
- `validator.ts` and `validator.hedge.test.ts`: funding truth table,
  missing-section coverage and synchronous pending finding.
- New focused `replacement-funding.ts` / `replacement-funding.test.ts`:
  exact selection, immutable snapshots, digest helper and complete-validation
  integration. Reuse existing canonicalization/hashing; no new dependencies.
- `index.ts` / `browser.ts`: export additive functions/types.
- `cli.ts`, `bindings.ts`, relevant built-in web validation consumers and
  their tests: await complete validation wherever the new capability is claimed.
- `scripts/run-conformance.mjs`, portable cases/driver, new hedge scenarios,
  wiki data model/testing/status and user-facing adoption documentation.
  Ordinary financial packs and Excel formulas are untouched.

### Acceptance and implementation sequence

1. **Owner review/acceptance:** review the exact union, digest scope, zero-row
   and date semantics, missing-section correction, async completion contract,
   and versioning below. Record acceptance separately. The semantic drafting
   direction is not acceptance of these proposed details.
2. **Explicit implementation authorization:** after acceptance, reconcile main
   and create `specs/active/SPEC.md` and its ordered `TASKS.md` only if this
   feature is the selected active work. Do not displace another active spec.
   Exactly one task is in flight; check it off only after applicable gates
   and its commit.
3. **Atomic normative implementation:** land synchronized format/schema/protocol,
   executable declarations, validator/complete-check code and conformance.
   Include the shared known-answer digest and immutable-snapshot tests.
   No temporary release may accept outright funding while skipping its digest.
4. **Consumer integration:** prove core async, browser crypto, CLI text/JSON
   exit status, MCP result and built-in claimed consumers agree. Existing sync
   callers must explicitly refuse an unchecked new branch; legacy controls
   preserve behavior except the disclosed coverage correction.
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
complete digest verification and conformance for both funding paths and their
refusals. Stack must vendor that release and use complete validation for the
new binding. An unaccepted draft, accepted-but-unreleased implementation or
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
| Trust the stated digest or keep sync validation silently clean | Permits stale/retargeted bindings to pass. Existing async hashing is reused through an additive complete-validation path. |
| New synchronous crypto implementation | Duplicates the browser/Node hashing seam and increases maintenance for no semantic gain. |
| Weaken ESC-04, fabricate escrow, or change financial cash | Erases the actual funding distinction and violates the adopter requirement. |

## Unresolved questions

The owner has settled the **funding discriminator plus exact cash-row binding**
direction. No additional question blocks drafting. Acceptance still needs
affirmation or amendment of these proposed details:

1. **Completion API:** the additive async validation wrapper plus explicit
   HDG-11 synchronous refusal is this draft's solution to portable hashing.
   It preserves the sync ABI but requires Stack and claimed built-in consumers
   to use the complete path. This interface choice needs review with the RFC.
2. **Zero premium and temporal scope:** this draft permits an explicit zero
   row and anchors “future” strictly after the stated initial effective date,
   without an expiration-date equality requirement. Those are stated proposed
   semantics, not accepted owner decisions.
3. **Coverage correction:** this draft closes the missing-sources/uses legacy
   ESC-04 skip as enforcement of the existing normative rule. The known unit
   assertion must change; it is not concealed as wholly identical validator
   behavior.

Mixed funding, multiple replacements, successor coverage, post-sale financing
assembly and trade execution records are deferred to separate adopter-backed
contracts. No new numerical formula, pricing tolerance or root bracket needs
an owner decision here.

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

This RFC/index/status-only change modifies no normative file, implementation,
conformance fixture, version or release record. The original research
reproduced ESC-04 from current released code; those results remain historical
evidence, not tests of an unimplemented proposal. Draft verification results
are recorded in the commit's accompanying response.
