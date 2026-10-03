# Future outright replacement-cap purchase: upstream decision brief

Research date: **2026-10-02** (America/Phoenix). Status: **analysis only; owner review required**.
This is not an RFC, acceptance, implementation authorization, or release plan.

Follow-up: Jared selected a funding discriminator plus exact cash-row binding
for drafting. See [draft RFC 0070](../rfcs/0070-replacement-cap-funding-and-payment-binding.md).
This brief preserves the preceding research findings and decision comparison.

## Finding and bounded requirement

**There is a real representation gap in the released hedge contract.**
Section 4.26 can already state the future cash payment. It cannot identify that
payment as the normative fulfillment of a typed hedge's replacement assumption,
and it does not discharge ESC-04. The missing contract is the distinction and
linkage between replacement funding patterns, not a new pricing engine or
general periodic ledger.

A UWMD author must be able to state that an initial property-loan rate cap will
be replaced by a modeled future purchase paid outright from deal cash, with
explicit purchase timing and stated premium amount, without asserting close-date
prefunding or periodic escrow deposits. An independent reader must distinguish
that purchase from escrow-funded replacement, unhedged expiry, and loan maturity
first. The representation must preserve the source model's cash timing and
amount, and deterministic validation must verify the stated structure and
linkage without pricing, forecasting, or inventing funding.

## Current state and reconciliation

- Canonical remote: `https://github.com/UWMD-OSP/UW-Markdown.git`.
  The archived personal UWMD repository was neither accessed nor modified.
- Initial primary checkout HEAD: `cc6ad63b7df31c2dfb2dc69ea01d30a8443cf2c7`.
  Fetched origin and tags, then fast-forwarded local main.
- Reconciled `main == origin/main`:
  **`2fbf9250b200f6d4f455165bee35bbbc9cfe8dee`**. No advance beyond the
  prompt's prepared SHA was found.
- Format **2.0**, Protocol **2.20.0 Stable**, core/CLI **2.16.0**, confirmed
  against [VERSIONS](../../VERSIONS.md), protocol constants, package manifests,
  and the protocol status line.
- [RFC 0056](../rfcs/0056-rate-hedges-and-escrows.md) and
  [RFC 0069](../rfcs/0069-student-rent-roll-bed-counts.md) are `implemented`.
- `v2.16.0^{commit}` remains
  **`a1ca815e2aee5da374caf7627ba3702849ecd257`**. No tag or release record changed.
- Primary main has **no tracked changes**, but is not wholly clean:
  the pre-existing untracked `docs/handoff/2026-09-28-rfc-0064-owner-steps.md`
  remains untouched. This research does not stash or delete another session's file.
- Research uses the designated separate checkout `../uwmd-codex`, on
  **`codex/outright-cap-research`**, based on current origin/main. Only this
  brief, the research script and its evidence output are research changes.

## StackUW evidence, independently checked

Canonical adopter repository: `jaredmaxey/underwriter-app`.
Read remote TASK-3294, Q-1297 and the cap cash-series code through the GitHub
connector. A read-only remote master lookup returned
**`9a6dfb9fad0f307df10031fef8ca49ced111afd8`**, matching the local adopter HEAD
and origin/master. Source files had no local modifications.

Evidence at that snapshot:

- [TASK-3294](https://github.com/jaredmaxey/underwriter-app/blob/9a6dfb9fad0f307df10031fef8ca49ced111afd8/tasks/queue/TASK-3294.md)
  is SCOPED; its independent review records the unresolved contract.
- [Q-1297](https://github.com/jaredmaxey/underwriter-app/blob/9a6dfb9fad0f307df10031fef8ca49ced111afd8/decisions/Q-1297.md)
  is open and blocks TASK-3294 and TASK-3295.
- [Bridge schema](https://github.com/jaredmaxey/underwriter-app/blob/9a6dfb9fad0f307df10031fef8ca49ced111afd8/packages/underwriting-engine/src/modules/debt-senior/bridge/schema.ts)
  states `atMonth` as a 1-indexed loan month, `estimatedCost` as a modeled
  dollar estimate, and `escrowMonthly` as an explicit funding distinction.
- [Bridge compute](https://github.com/jaredmaxey/underwriter-app/blob/9a6dfb9fad0f307df10031fef8ca49ced111afd8/packages/underwriting-engine/src/modules/debt-senior/bridge/compute.ts)
  lines 393–427 builds the cash series after applied refinance is known.
  Outright replacement adds `estimatedCost` at `months[atMonth - 1]` if the
  bridge has not already been retired. Escrowed replacement deposits over the
  preceding months, makes no additional purchase-month charge, and returns the
  funded balance if refinance retires the bridge first.
- [Model tests](https://github.com/jaredmaxey/underwriter-app/blob/9a6dfb9fad0f307df10031fef8ca49ced111afd8/packages/underwriting-engine/src/modules/debt-senior/bridge/__tests__/rateCap.test.ts)
  exercise a $400,000 initial cap, 24-month initial term, and an outright
  $300,000 purchase in loan month 25. The deterministic engine produces
  `rateCapCostByYear = [400000, 0, 300000, 0, 0]`.
- The distinct [export fixture](https://github.com/jaredmaxey/underwriter-app/blob/9a6dfb9fad0f307df10031fef8ca49ced111afd8/packages/underwriting-engine/src/export/__tests__/rate-cap-export.test.ts)
  uses $400,000 initially and **$360,000 in month 25**, without cap escrow.
  Its existing exported row is `{date: "2002-01-01", amount: -360000,
  kind: "debt_service", label: "rate_cap_replacement_purchase"}`.
- [Current exporter projection](https://github.com/jaredmaxey/underwriter-app/blob/9a6dfb9fad0f307df10031fef8ca49ced111afd8/packages/underwriting-engine/src/export/spec-projection.ts)
  still emits the adopter's producer-side draft `rate_cap`, including
  `funding: "outright"`. That is not released UWMD RFC 0056's `rate_hedge`.
  Stack's historic producer proposal named RFC 0051 is not the canonical
  implemented UWMD RFC 0051, which concerns waterfall hurdles.

**Timing limit:** `2002-01-01` comes from Stack's
`DEFAULT_FORECAST_START = "2000-01-01"` when no acquisition date is supplied
(`src/ledger/build.ts`). It is a deterministic model anchor, not independent
evidence of a real deal closing or purchase date. The factual adopter requirement
is demonstrated at **loan month 25**. TASK-3294's stated-close/date work is still
needed to export actual calendar dates. This research never substitutes that
anchor or the export clock for a real deal date.

**Boundary between layers:** Stack computes coupon coverage and the actual
modeled cap-cost series. UWMD currently permits a typed initial cap and dated
generic cash rows, validates their stated shapes, and demands escrow for typed
`replace`. The draft name, free-text row labels and default forecast anchor
are adopter implementation choices, not UWMD normative facts. Neither a future
premium estimate nor this research establishes a priced cap or an executed trade.

## Exact current representation attempted and result

The [reproduction script](2026-10-02-outright-cap-replacement.repro.mjs) creates
a complete Format-2.0 probe with nested metadata. Its exact serialized document
and all findings are recorded in the
[evidence output](2026-10-02-outright-cap-replacement.evidence.json).
The substantive data is:

```json
{
  "debt_structure": {
    "loan_amount": 32500000,
    "rate_type": "floating",
    "rate_index": "sofr",
    "rate_cap_pct": 0.055,
    "rate_hedge": {
      "instrument": "rate_cap",
      "notional": 32500000,
      "strike_rate": 0.055,
      "index": "sofr",
      "effective_date": "2026-01-01",
      "expiration_date": "2028-01-01",
      "premium": 400000,
      "post_expiration_assumption": "replace"
    }
  },
  "sources_uses": {"uses": {"rate_cap_cost": 400000}},
  "cash_flow_series": {
    "label": "Interest-rate cap cash flows",
    "series": [
      {"date": "2026-01-01", "amount": -400000,
       "kind": "debt_service", "label": "rate_cap_premium"},
      {"date": "2028-01-01", "amount": -360000,
       "kind": "debt_service", "label": "rate_cap_replacement_purchase"}
    ]
  }
}
```

The dates here are explicitly **synthetic research inputs**, not Stack deal
dates. Current rebuilt core reports **ESC-04, severity error**:

> ESC-04: rate_hedge.post_expiration_assumption "replace" requires a rate_cap_replacement escrow

The existing `conformance/hedge/reject-replace-without-escrow/deal.uwx.md`
also reproduces ESC-04. The minimal research probes additionally report CC-14
for missing property identity; they do not claim complete-deal readiness.
Relevant HDG/ESC/CF findings are separated from all findings in the evidence.

A positive `upfront` amount would falsely say replacement money was funded
at close. A positive `monthly` would falsely say ongoing deposits occurred.
Neither means a one-time future purchase. Null/omitted amounts give ESC-01.
A fabricated `upfront: 0, monthly: 0` entry does pass current HDG/ESC checks,
but asserts an escrow account and still supplies neither future purchase timing
nor its premium. Numerical acceptance is not a truthful representation.

A second implementation boundary was reproduced: removing all `sources_uses`,
or its `uses` object, prevents ESC-04 from running. This is explicit in
`checkHedgesAndEscrows` and an existing unit test. It is not permission to
suppress a real sources/uses section or a normative exemption from the format rule.

## Existing-contract analysis

| Candidate | Normative meaning and independent-reader result | Current validation / why insufficient |
|---|---|---|
| Typed `rate_hedge` + a §4.26 future `debt_service` or `other` row | Dates and signed amounts are lawfully stated, deterministic data. A human can read a label, but labels are unrestricted and kinds are advisory. No typed hedge-payment link or funding distinction exists. | ESC-04 persists with `replace`. The row alone is allowed; the complete requested representation is not. |
| A new `kind: "rate_cap_replacement_purchase"` | Would identify the event if standardized; today's closed kind enum does not include it. | CF-01 plus ESC-04. A new kind alone would still not link the row to the hedge. |
| `rate_cap_replacement` escrow with future premium in `upfront` or `monthly` | States actual close funding or ongoing deposits. No future-event/date member exists. | Can pass checks, but changes the stated funding fact and cash timing. Null/absent funding fails ESC-01; zeros are the loophole above. |
| An `other` escrow / `other_reserves` / operating or interest reserve | Still describes escrow/reserve funding. A label cannot change the meaning of those fields. | Does not fulfill the named replacement tie; invents a reserve for this case. |
| Initial `premium` or `uses.rate_cap_cost` inflated by the future amount | These are the current cap's upfront premium, cross-checked by HDG-05. No second date or payment identity. | Changing one side fails HDG-05; changing both lies about close cash and still does not supply replacement timing. |
| NOI replacement reserves, renovation draws, expense-targeted capex, lease-up TI/LC | Property expenditure/reserve deductions, dated draws to date, expense-saving capital improvements, or leasing spend. | A financing hedge purchase has none of these meanings. Type-compatible numbers would be misclassification. |
| DCF annual cash, returns, custom calculations/scenarios | May already include the financial effect or stress it; cannot declare a typed replacement purchase or escrow funding fact. | No hedge tie; ESC-04 remains. Deriving the missing event from net totals is prohibited and ambiguous. |
| `capital_stack` tranche | RFC 0033 scopes this to concurrent capitalization at one point in time. A hedge premium is an expenditure, not a capital tranche. | No truthful committed-tranche amount or payment/date linkage. |
| RFC 0045 property cash-flow assembly | Explicitly unlevered/pre-tax property assembly. Financing flows are a separate contract. | `other_capex` is not a lawful way to smuggle in financing hedge cash; assembly does not discharge ESC-04. |
| RFC 0054 periodic ledger / draft RFCs 0064–0065 reserve accounts | RFC 0054 defines no carrier and defers periodic per-position series. 0064–0065 are not released; property reserve custody is not an outright payment. | None supplies a current lawful replacement representation. A single payment does not require a general roll-forward. |
| Narrative, notes, legacy-only cap, adopter draft `rate_cap`, unknown inline member, or `x_` | Narrative can describe the deal informally but has no typed linkage. A producer draft/extension is not the released contract. `debt-rate-hedge.schema.json` forbids extra members. | Omitting the typed hedge hides the assumption; inventing an inline member fails the released schema and does not clear ESC-04. Notes/extensions are excluded as a normative answer. |
| `unhedged`, `loan_matures_first`, omitting sources/uses, or manipulating variants | Contradicts a continuing loan with a modeled replacement, suppresses relevant evidence, or creates unresolved selection rather than representing funding. | Some pass selected checks; none satisfies both semantics and the released replacement contract. |

Thus generic cash representation is already available; a normative
**replacement-funding branch and hedge-to-payment identity** are missing.

## What RFC 0056 actually decided

The RFC states the bidirectional ESC-04 rule without qualification and calls it
“the point of the contract.” Format §4.7 ties `replace` to a funded escrow;
§4.8 says an escrow funding neither at close nor monthly is not one.
The schemas, validator and both-direction rejection fixtures implement that
decision. Escrow funding is therefore intentionally mandatory in the **released
rule**, not an accidental validator overreach.

Repository evidence does **not** establish that the owner considered and
rejected outright future purchase as an economic possibility. The defensible
conclusion is that the mandatory escrow contract omitted this demonstrated
second funding pattern. It cannot be fixed by declaring the old rule optional
or treating the new requirement as errata.

## Design options for owner review

The shapes below are conceptual alternatives, **not authorized fields**.
All retain the existing A/B/C/D economic distinctions, fractional rates, and
stated monetary data. No solution below prices a premium, fetches a curve,
projects payoff, values swaps/collars, rolls an account, or changes Stack cash.

### 1. Inline typed outright-purchase exception

Illustrative shape:

```json
"post_expiration_assumption": "replace",
"outright_replacement_purchase": {
  "purchase_date": "2028-01-01",
  "amount": 360000
}
```

Object presence explicitly states future outright funding. Legacy `replace`
without this object keeps requiring the escrow. A replacement must have either
the escrow branch or the complete outright object; both conflict for this
bounded case. The date is a stated purchase date, distinct from hedge expiration
and successor coverage. The amount is a stated modeled premium, not a quote
derived by UWMD.

Validation would require a real date and finite nonnegative stated amount,
`replace`, no replacement escrow, and complete object structure. Existing
HDG-05 keeps comparing only the initial cap premium. ESC-01/02/03 retain their
meaning; ESC-04's replacement requirement becomes conditional on the explicit
new object. No maturity/date is inferred from loan years or the clock.

Advantage: smallest self-contained typed declaration; works without a full
cash-flow series. Risk: duplicates data already in the adopter's §4.26 series;
without a binding it cannot verify consistency or prevent an independent
consumer counting the disclosure as another payment. RFC 0058's explicit dated
cash-sink precedent favors keeping economic cash in §4.26. A duplicate disclosure
would need a clear “not an additional cash row” rule and, if bound, currency-quantum
agreement checks. That pushes this option toward option 3.

Impact: additive format prose/schema edits within the current shape; Protocol
minor candidate; validator, conformance and documentation changes. Old valid
escrow documents retain verdicts. Old validators reject the new no-escrow
case with ESC-04; schema consumers reject the unknown member.

### 2. Explicit replacement-funding mode plus typed payment

Illustrative shape:

```json
"post_expiration_assumption": "replace",
"replacement_funding": "outright",
"replacement_purchase": {"purchase_date": "2028-01-01", "amount": 360000}
```

A closed `escrow | outright` mode separates the question “what happens next?”
from “how is replacement paid?” Absence preserves the old escrow requirement;
that is legacy contract applicability, not an inference that an account exists.
The outright mode requires the typed payment and forbids replacement escrow.
The escrow mode requires the existing named escrow and does not require the new
purchase object or change its funding semantics.

Validation explicitly checks the assumption/mode/payment/escrow truth table.
Unknown modes and incomplete combinations refuse. Initial premium and escrow
agreement rules remain. No cap term, notional change or lifecycle array is added.

Advantage: clearest orthogonal semantics for independent readers. Risks: one
extra discriminator; missing mode plus missing escrow must still fail rather
than defaulting to a weaker assumption; inline duplication has option 1's risk.
A required mode for all old replacement documents would break compatibility and
is unnecessary for the observed requirement.

Impact: format prose/schema edits, Protocol minor candidate, new semantic checks
and conformance. Old valid documents remain valid under absence-preserves-legacy
semantics; old consumers cannot validate the new outright branch.

A variation adds `replace_outright` to the existing assumption enum and
leaves the literal `replace` branch's ESC-04 unchanged. This is smaller in
validator branching but mixes funding into an economic-assumption enum and
expands a closed enum that older readers refuse. It still needs stated payment
data, so changing the enum alone is insufficient.

### 3. Typed outright-purchase link to an existing dated cash row

Illustrative shape, keeping amounts and dates in one economic cash carrier:

```json
"post_expiration_assumption": "replace",
"outright_replacement_purchase": {
  "cash_flow_ref": {"variant": "cap-cash", "row_index": 1}
}
```

The object says what the payment is and that it is paid outright. The explicitly
selected §4.26 row states when and how much; no amount/date is derived. It must
be a dedicated purchase row, not a net cash total or an escrow contribution.
A zero-based index refers to the exact current source snapshot. This follows
the row-binding posture of Protocol §VIII.9c / RFC 0045 and the use of §4.26
as a dated cash sink in RFC 0058. The proposed hedge link itself is new; those
precedents do not authorize it today.

Validation would require explicit variant and an in-range integer index, a real
row date and finite payment amount, the replacement assumption, no replacement
escrow, and a nonpositive outflow row. The authoring contract must assert that the
referenced row is dedicated to the purchase. A structural validator cannot
discover unstated netting or authenticate the original premium estimate;
provenance and adopter-source comparisons supply that evidence. Labels would
remain display text; the typed reference, not a spelling convention, identifies
the purpose.
The link must resolve in the same document without default variant selection.
Same-day rows remain distinct: a date-only selector is insufficient. Dangling
links, wrong sign, ambiguous block selection, and conflicting funding refuse.
A changed source snapshot must retain or deliberately update the binding;
existing append-only metadata/integrity rules remain host-owned.

ESC-04 would permit the exact typed outright branch as an alternative to the
existing escrow branch, with neither allowed to substitute for the other.
Whether the link belongs under a dedicated outright object or the explicit
funding mode in option 2 is a remaining shape decision.

Advantage: reuses Stack's existing dedicated cash row, one stated amount/date,
deterministic identity, no additional economic payment, no new section, and
no collection formula or general ledger. Risk: a producer without §4.26 must
emit a small explicit series; positional links need snapshot discipline and
same-day coverage. It exposes rather than resolves missing actual calendar dates.

Impact: hedge schema/prose and Protocol minor candidate; §4.26's row schema,
kind enum and metric calculations can remain unchanged. New validator/conformance
link checks are required. Old valid documents are unaffected; old validators
still reject the new outright branch. Readers must advertise support before an
adopter relies on this representation.

### Preferred direction, without prematurely selecting a contract

**Prefer a typed outright replacement declaration linked to one explicit §4.26
purchase row (option 3).** The cash carrier already exists and is produced by
the demonstrated adopter; RFC 0058 calls §4.26 the addressable sink for new dated
cash. Preserve the escrow branch exactly for documents without the new opt-in,
and require one funding branch for the bounded case.

Nevertheless a self-contained inline declaration and an explicit funding mode
remain materially viable. The repository has no universal typed financial-event
reference that settles their tradeoffs. **No RFC is drafted in this session.**
The owner must choose inline stated payment versus required §4.26 row linkage,
and whether to use a dedicated outright object or an explicit funding mode.
This avoids presenting a preference as an accepted schema.

## Compatibility and versioning analysis

This is **additive section-data/schema work plus a Protocol change**; it is not
a Protocol-only relaxation of ESC-04.

- **Format:** propose retaining **2.0**, not automatically 2.1. Protocol §0.3
  ties a Format bump to breaking shape changes. RFC 0069's implemented version
  analysis explicitly keeps 2.0 while adding optional fields/schema rules through
  incorporated v1 Part IV, following RFCs 0055/0058. RFC 0056's historical
  “Format minor” prose must be read alongside its actual release and that current
  precedent. VERSIONS' additive-minor rule allows such minors; it does not require
  a bump for every optional field. No metadata or file grammar changes are needed.
- **Protocol:** propose the **next available minor, currently 2.21.0**, if
  accepted before another change takes that slot. This is new opted-in behavior,
  not RFC 0062-style reconciliation of contradictory published requirements;
  no patch/errata treatment is supported.
- **Monotonicity:** a blanket weakening of legacy ESC-04 is incompatible with
  the stated monotonically strengthening policy. The RFC must scope permission
  to the explicit new representation and preserve legacy-document verdicts.
  This still means an old validator cannot accept new outright documents.
  The owner should record that minor-feature compatibility interpretation
  explicitly; if requiring every new document to validate under an older
  protocol is the intended policy, this feature needs a different compatibility
  boundary. No universal backwards-validation claim is made here.
- **Packages:** new optional behavior with no removed API normally suggests
  the next core/CLI minor generation, **2.17.0** if no intervening generation
  lands. This is a likely target, not a reservation or owner release decision.
  Exact workspace pins and dependent package generations follow existing policy.
- **Tiers/modules:** parse and byte-preserving editing can retain the optional
  data; semantic consumers need the new checks and advertised Protocol support.
  Agent hosts may extract stated facts, never price or silently derive them.
  No module manifest, provider seam, calc grammar or pack formula change is needed.
- **Excel/static parity:** these options type/link stated data only. Existing
  packs and calculations stay unchanged, so there is no new financial formula
  to mirror in Excel. Copying/displaying source literals must not turn the
  declaration into an additional charge. Automatic debt cash assembly or an
  Excel financial consumer would need its own bounded contract and parity proof.
  Generic lossless XML/CSV mappings preserve nested objects and indexes; view
  projections must report omitted fields as already required.

No version, package pin, norm, validator or conformance baseline changed.

## Proposed future conformance, after owner acceptance

Keep all 17 current hedge fixtures and their legacy expectations. Add cases for:

1. Explicit outright replacement with no replacement escrow and a complete
   payment/link; future cash date and amount preserved exactly.
2. Existing escrow-funded replacement; unhedged and loan-matures-first absence
   cases; legacy `replace` with no escrow still ESC-04.
3. Neither funding branch, both branches, unknown mode/object members,
   incomplete payment, non-real date, negative inline amount / positive linked
   inflow, non-finite amount, and a purchase declaration under a nonreplacement
   assumption.
4. For a link: missing variant, absent source, invalid/out-of-range index,
   same-day separate rows, snapshot edits, and ambiguous section selection.
   At the adopter boundary, verify copying from the actual engine purchase row,
   including a negative control pointing to a structurally valid unrelated
   outflow. Upstream shape checks alone cannot identify the author's intended
   row or detect undisclosed netting without additional stated identity.
5. Original cap premium/use agreement unchanged; no pricing, maturity inference,
   successor coverage inference or escrow balance roll-forward.
6. An adopter-derived before/after example with unchanged financial amounts and
   digest/provenance change limited to explicit representation edits.
7. Zero premiums need an explicit statement-versus-absence policy before they
   are included in the accepted case set; the current exporter skips zero rows.
   Purchase timing must not be forced equal to cap expiration: an acquisition
   date is not necessarily successor coverage commencement. If ordering beyond
   “future relative to a stated deal anchor” is desired, the owner must specify it.

These are proposed cases, not new conformance fixtures.

## Verification performed

- Built current isolated-checkout `@uwmd/core@2.16.0` with
  `npm run build --workspace=@uwmd/core`.
- `node scripts/run-conformance.mjs --tier=hedge,cash-flow --json`:
  **34 passed, 0 failed** (17 hedge, 17 cash-flow cases).
- [Research probe](2026-10-02-outright-cap-replacement.repro.mjs):
  **16 asserted validation cases**, **5 asserted schema cases**, and the
  existing missing-escrow fixture. See full output in the linked evidence.
- Read-only adopter focused tests:
  `npm test -- rateCap.test.ts rate-cap-export.test.ts`, from its engine
  package: **2 files / 29 tests passed**. No adopter source/task/decision edits.
- \`npm run verify-indexes\`: **passed**, including both source-discovery tests,
  all 48 indexed schemas, and RFC body/frontmatter/index checks.
- \`npm --prefix tools/docs-site run build\`: **passed**. This builds the
  existing published copy plan; this internal review is not added to site routing.
- Focused Biome lint for the reproduction script and evidence JSON: **passed**.
- This session claims no full implementation, release, or publication gate.

To reproduce the probe after building core:

```powershell
node docs/reviews/2026-10-02-outright-cap-replacement.repro.mjs
node scripts/run-conformance.mjs --tier=hedge,cash-flow --json
```

## RFC status, StackUW disposition and owner action

**No RFC number allocated; no RFC drafted or accepted.** Research branch:
`codex/outright-cap-research`. The accompanying chat records the commit ID.

**TASK-3294 should remain SCOPED awaiting the upstream contract** (option 1).
TASK-3295 remains SCOPED behind its durable DONE dependency. Q-1297 stays open.
A named refusal would be an explicit product-contract amendment, not an upstream
solution; this research does not authorize that choice. Preserve current model
cash and existing behavior while the task is unadmitted. Do not fabricate escrow,
reallocate dollars, suppress ESC-04, relabel replacement as unhedged, or silently
drop the positive export path.

**Exact upstream unblock condition:** an owner-accepted RFC is implemented and
released in a declared Protocol/core/CLI pairing that normatively allows an
explicit future outright replacement purchase without a replacement escrow,
requires its timing and stated amount or an unambiguous link to that stated cash
row, and ships conformance proving the outright and legacy escrow branches,
conflicts/refusals, and unchanged initial-premium semantics. Stack then vendors
that released pairing, resolves Q-1297 against the released contract, refreshes
TASK-3294 admission/scope, supplies an actual calendar anchor, and proves export
validation plus unchanged model cash. An accepted or implemented-but-unreleased
RFC alone does not unblock it.

**Jared's decisions:** select the payment carrier and funding discriminator
before drafting; settle any zero-payment and timing-order semantics the selected
shape needs; approve the explicit opt-in Protocol-minor compatibility treatment.
Acceptance, implementation authorization and eventual release remain subsequent
owner decisions. No credentials, provider-console action or human-only setup
handoff is needed for this completed research.
