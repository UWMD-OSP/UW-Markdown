---
rfc: 0129
title: Catalog document families and add three attributable fact profiles
status: accepted
author: UWMD maintainers
created: 2026-10-26
affects:
  - format-spec
  - protocol-spec
  - core-library
  - conformance-corpus
---

# RFC0129: Catalog document families and add three attributable fact profiles

## Summary

Adopt a document-type selection rule and catalog, then implement three bounded
profiles: `loan-quote-v1`, `offering-memorandum-v1` and `appraisal-abstract-v1`.
They carry source-located facts for existing record fields, not new calculations.
Each exposes reviewed candidate edits with an omission/conflict report. This
RFC is **accepted** by the owner on 2026-10-26: “yes to the codex list”.
The separate reference-source implementation provides the three profiles and
`document-facts` conformance through the public library, package admission and
complete Lite views. CLI/MCP/HTTP fact-operation bindings and Lite compilation
remain unsupported. Status stays accepted until a release under the RFC index
policy; no release is performed here.

## Motivation

RFC0018 supplies document purpose, identity and packages; RFC0022 supplies dated
attributable observations. Lease abstracts already have material-term locators
and explicit null statuses. Acquisition and financing packages also need to
keep a quote, a marketing statement and an appraisal opinion distinct from a
producer's adopted inputs. The Format already holds the useful destination
facts (§§4.1–4.7,4.13); no new valuation or loan-sizing formula is necessary.

At proposal, the companion `docs/document-types.md` catalog recorded12 available families,
5 draft families (including these three),11 planned and6 evidence-only
categories. Those counts are catalog rows, not registered profiles. The proposed
rule is: a document earns a profile if its facts feed underwriting figures or
lender sizing, or a second party must rely on its facts without the source.
Otherwise it remains package evidence. This RFC adopts that screen rather than
creating a profile for every file format or every lender checklist item.

## Proposed change

### 1. Scope and registry

Add three purpose ids to the RFC0018 registry. They MUST NOT change the default
deal profile, select a class/pack/loan, or be interpreted as an underwriting
record. Unknown purpose ids retain RFC0018 preservation behavior. There is no
new filename extension. An optional frontmatter/descriptor `document_profile`
is separate from the closed logical payload described below, following the
market-data pattern. The physical UWX mapping uses one `document_facts` JSON
block; that group belongs only to these profiles, not to deal sections. The
profile is repeated in the external document descriptor, not inside each fact.
A standalone library validator receives the explicit profile id and payload.
A deal Reader MUST NOT promote this block to a deal section automatically.

This is a source-fact contract. Validation proves admissible structure and
attribution, not the truth, legal enforceability or financial adequacy of a
statement. A label naming an institution is descriptive, not authentication.
No financial procedure, numerical tolerance, currency conversion or legal
precedence rule is added.

### 2. Common payload and term envelope

The three closed root schemas MUST contain only:

| Field | Contract |
|---|---|
| `document_id` | Required nonempty stable string |
| `artifact_kind` | Required; profile-specific vocabulary below |
| `as_of` | Required real `YYYY-MM-DD`, the source's effective/vintage date |
| `currency_code` | Required existing currency-code contract; money facts use this currency |
| `governing_documents` | Required nonempty unique immutable source/member ids |
| `facts` | Required nonempty object; only the profile allowlist below |
| `unmapped_facts` | Optional array of `{label, term}`; no projection destination |
| `findings` | Optional string array of limitations/conflicts/review questions |
| `supersedes` | Optional prior document id, not self; descriptive link, no automatic precedence |

`facts` values and `unmapped_facts[].term` MUST use the lease material-term
shape: `{value, source_ref? , status?}` with no other members. A non-null value
MUST have `source_ref:{source,locator}`, both nonempty, and MUST NOT have a
status. `source` MUST resolve to a governing source identity. A null value MUST
state exactly one of `not_stated`, `ambiguous`, `not_reviewed`; a locator MAY
identify the reviewed scope or conflict. An absent fact is outside the stated
coverage, not zero or a claim that an obligation does not exist. A null does
not project. JSON values MUST be finite and the admitted type/unit for the
destination fact. Duplicate keys, duplicate source ids and duplicate unmapped
labels MUST be refused, not resolved by input order.

Every money fact has unit `currency_code` implicitly at document level; rates
are fractions using the current field's unit (including fields whose spelling
ends `_pct`), basis points remain basis points, and stated periods/dates remain
unchanged. No annualization, unit conversion, netting or inference occurs.

### 3. Closed initial fact allowlists

Keys below are exact destination paths, not an arbitrary path language. A
producer MUST NOT supply an array selector, alternate spelling, extra key or
computed result in `facts`. The implementation uses explicit property access,
not an executable expression evaluator. A later expansion needs an accepted
profile revision or version under the then-current version policy.

**Loan quote.** `artifact_kind` is `quote`, `term_sheet` or `amendment`.
Allow only `debt_structure.loan_amount`, `.loan_purpose`, `.loan_type`,
`.rate_type`, `.interest_rate`, `.rate_index`, `.rate_spread_bps`,
`.rate_floor_pct`, `.amortization_years`, `.loan_term_years`,
`.io_period_months`, `.recourse`, `.prepayment_type`, `.origination_fee_pct`,
`.exit_fee_pct`, `.lender_type`. Each has its existing Format§4.7 type/unit and
closed vocabulary. Expiry, conditions, a quoted maximum LTV/DSCR constraint and
prepayment schedule prose go into attributed `unmapped_facts`; they MUST NOT
become `sizing_metrics` results. A quote is not a selected or funded loan.

**Offering memorandum.** `artifact_kind` is `offering_memorandum` or `amendment`.
Initial facts allow `property.year_built`, `property.total_units`,
`property.total_nra_sqft`, `valuation.appraised_value`,
`valuation.appraised_as_of`, `valuation.appraisal_report_date` only where the
source explicitly attributes those appraisal facts. These exact property spellings are the current Format§4.1 fields; area and
count meanings MUST remain those of the explicitly stated source.
All source-stated asking price, historical/forecast NOI, rent schedules and
occupancy periods stay attributed `unmapped_facts` in this first revision.
They need source-period and variant semantics before a safe financial-field
projection; no guessed annualization or historical-to-underwritten mapping.
Existing rent-roll/operating UWParts remain the route for fully shaped sections.

**Appraisal.** `artifact_kind` is `appraisal_report` or `amendment`.
Allow `valuation.appraised_value`, `.appraised_as_of`,
`.appraisal_report_date`, `.appraisal_approach`, `.appraisal_cap_rate` only.
Values with different effective premises (as-is, as-complete, as-stabilized)
MUST remain individually attributed unmapped facts unless the source explicitly
identifies the singular opinion represented by `appraised_value`. The projector
MUST NOT select among them. Conditions/extraordinary assumptions stay visible
in unmapped facts/findings. Existing CC-08 applies if a host later adopts values
into both current appraisal homes; this RFC does not create a second value home
or make an appraisal opinion into `underwritten_value`.

### 4. Named projection and lifecycle

The public library exposes a common `record-facts-v1` candidate projection.
The host MUST supply an explicit destination deal identity, exact destination
section/variant and currency for each requested edit. It MUST NOT default to
`senior`, current time or the first variant. A currency mismatch, unresolved
source, null fact, semantic mismatch or existing conflicting target produces an
omission/conflict entry and no edit for that fact. Matching existing values
produce an explicit no-op. The result preserves original fact order as recorded
by the profile's canonical sorted key order; conflicts never select a winner.
Projection is read-only and never calculates or mutates the source or target.
Applying an edit is a separate host action using existing provenance APIs.

`supersedes` MUST preserve the prior document and visible source history in the
package. An amendment does not automatically win over a base instrument.
A projector MUST refuse automatic projection from an amendment or from a set of
conflicting governing documents. A reviewer can author a separately attributed
resolved fact document; legal interpretation remains with that reviewer.
Package links reuse registered `abstracts`, `contributes_to` and applicable
supersede links only; no private parallel edge registry is introduced.

A Lite view MUST show document/profile identity, source dates/currency, every
fact/status/locator and all findings/unmapped facts. It is a view of this
profile, never a Lite deal compilation shortcut. No financial omission may be
hidden as a zero. The first implementation MUST explicitly report unsupported
Lite compilation and unsupported MCP/HTTP bindings; no automatic support claim.

### 5. Worked synthetic examples

These are QA-only source transcriptions, not executable financial models.
All source ids identify synthetic evidence members in the same package.

**Quote source:** “Fixture funding quote, dated2026-10-01: amount1000000 USD;
fixed interest0.06; amortization30years; maximum LTV0.65; valid until2026-11-01.”

```json
{
  "document_id":"quote:qa-001","artifact_kind":"quote","as_of":"2026-10-01",
  "currency_code":"USD","governing_documents":["source:qa-quote"],
  "facts":{
    "debt_structure.loan_amount":{"value":1000000,"source_ref":{"source":"source:qa-quote","locator":"p1 amount"}},
    "debt_structure.interest_rate":{"value":0.06,"source_ref":{"source":"source:qa-quote","locator":"p1 rate"}},
    "debt_structure.io_period_months":{"value":null,"status":"not_stated"}
  },
  "unmapped_facts":[{"label":"maximum_ltv","term":{"value":0.65,"source_ref":{"source":"source:qa-quote","locator":"p1 maximum LTV"}}}],
  "findings":["Unsigned quote; not an adopted loan. Expiry2026-11-01."]
}
```

With an explicit USD `senior` target, the first two facts are candidate edits;
IO is omitted and maximum LTV stays unmapped. No computed LTV is emitted.

**OM source:** “Synthetic offering dated2026-10-01: constructed1998; asking
price2000000 USD; forecast NOI180000 USD.”

```json
{
  "document_id":"om:qa-001","artifact_kind":"offering_memorandum","as_of":"2026-10-01",
  "currency_code":"USD","governing_documents":["source:qa-om"],
  "facts":{"property.year_built":{"value":1998,"source_ref":{"source":"source:qa-om","locator":"p2 improvements"}}},
  "unmapped_facts":[
    {"label":"asking_price","term":{"value":2000000,"source_ref":{"source":"source:qa-om","locator":"p1 offering"}}},
    {"label":"forecast_noi","term":{"value":180000,"source_ref":{"source":"source:qa-om","locator":"p3 forecast"}}}
  ]
}
```

Only year built is eligible. Neither marketing price nor forecast NOI becomes
an underwritten metric or purchase price.

**Appraisal source:** “Synthetic report dated2026-10-02, opinion effective
2026-09-30: as-is market value2100000 USD; income approach; subject to stated
extraordinary assumption on p8.”

```json
{
  "document_id":"appraisal:qa-001","artifact_kind":"appraisal_report","as_of":"2026-09-30",
  "currency_code":"USD","governing_documents":["source:qa-appraisal"],
  "facts":{
    "valuation.appraised_value":{"value":2100000,"source_ref":{"source":"source:qa-appraisal","locator":"p4 as-is conclusion"}},
    "valuation.appraised_as_of":{"value":"2026-09-30","source_ref":{"source":"source:qa-appraisal","locator":"p4 effective date"}},
    "valuation.appraisal_report_date":{"value":"2026-10-02","source_ref":{"source":"source:qa-appraisal","locator":"p1 report date"}}
  },
  "findings":["Extraordinary assumption at source:qa-appraisal p8; independent review required."]
}
```

Adoption into the appraised-value field leaves underwritten value and the loan's
LTV basis unstated. A second conflicting opinion blocks automatic projection.

### Decisions

| Question | Proposal | Precedent |
|---|---|---|
| Separate estoppel profile? | Reuse lease artifact kind; no duplicate id | RFC0018 lease kinds and executed-only projection |
| Release candidates? | Three facts-only profiles; planned remainder stays unimplemented | Existing Format fact homes; no new financial conventions |
| Source facts versus adopted values? | Read-only explicit candidate edits and omission/conflict report | Lease `rent-roll-v1` projection; RFC0022 promotion |
| Arbitrary financial field paths? | Closed allowlists; preserve all other statements as unmapped facts | Explicit field semantics and refusal rather than guessed numerics |
| Binding support? | Library first; other bindings require their own proof | RFC0083 capability boundaries and scoped RFC0092 support |

## Compatibility analysis

This is a prelaunch4.x proposal under the owner rule. No compatibility layer,
migration path, deprecation or published-version change is proposed.

## Conformance impact

Add `conformance/document-facts/` fixtures and indexed optional
`document-facts` conformance cases: all three clean examples, each null status,
missing/foreign source, empty locator, invalid calendar date, unknown/duplicate
fact, wrong field type/unit, quote ceiling/result confusion, asking/purchase
price separation, multiple appraisal premises, target variant/currency refusal,
conflicting existing target, amendment/no-precedence refusal, no-op, package
round trip/digest tamper, view omissions and source/target nonmutation. Unknown
purpose preservation remains a Reader obligation. No financial expected number
changes. The conformance profile is distinct from each document-purpose id.

## Reference implementation

After acceptance, add standalone validators and types under
`packages/uwmd-verify/src/document-facts.ts`, typed `DocumentFactsError`, schema
mirrors and exports through verify/core/browser. Proposed APIs:
`validateDocumentFacts(profile,payload,sourceInventory)` and
`projectDocumentFacts(profile,payload,target,selection)`. Add three closed root
schemas, the common term schema, profile/block mapping, package handling and
synthetic examples. Synchronize Format/Protocol executable mirrors and schema
indexes in the implementation PR. Keep the exact Format§4.1 property spellings above. Build/test/typecheck/conformance/schema/lint/docs and every repository
guard must pass; a clean unrelated deal's arithmetic must remain bit-identical.
No dependency, network lookup, underwriting generation or identity service.

## Alternatives considered

A profile for every report duplicates existing fragments and turns media into
meaning. A universal arbitrary JSON extraction blob cannot establish destination
semantics. Automatic mapping of forecast NOI, quoted LTV or appraisal opinion
would cross a financial choice. Deferring appraisal entirely misses an existing
native value/date home. A broad OM financial projection is deferred until its
source-period and variant choices have an explicit contract.

## Unresolved questions

The owner accepted this combined scope on 2026-10-26: “yes to the codex list”.
No normative decision changed from the approved draft.
No new financial convention is requested: any later discovery of one returns
as a concrete acceptance question rather than an implementation assumption.
The remaining11 planned catalog families have paragraph specifications only;
this RFC neither accepts nor promises their schemas.

## Prior art

[RFC0018](0018-document-profiles-and-deal-packages.md),
[RFC0022](0022-market-data-documents.md), the Format§4.6/4.7/4.13, and the
[document-type playbook](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/playbooks/ADD_DOCUMENT_TYPE.md). Public
[FDIC CRE documentation categories](https://www.fdic.gov/risk-management-manual-examination-policies/commercial-real-estate-lending)
help distinguish instruments, commitments, operating records and settlement
sheets. No licensed format, government form or real deal data is copied.
