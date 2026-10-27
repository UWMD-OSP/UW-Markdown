# Document types

UWMD carries facts that another party can inspect and verify. A document earns
a purpose profile when its facts feed underwriting figures or loan sizing, or
another party must rely on those facts without the source file. Otherwise it
travels as source evidence in a [deal package](rfcs/0018-document-profiles-and-deal-packages.md).
This is a catalog and a design screen, not an expansion of the current standard.
New profiles require an accepted RFC and working conformance cases.

**Available** means a current contract and reference implementation exist;
it does not mean every binding implements it. **Draft** names a proposal awaiting
acceptance. **Planned** describes a bounded future contract, with no implementation claim (an accepted RFC may reserve its proposed id). **Evidence only** has no independent fact
profile in this catalog. Availability here describes current source, not the
older code that may share its npm version; see [version matrix](../VERSIONS.md).

Count by catalog row: **15 available, 2 draft, 11 planned, 6 evidence only**.
These are logical families, including supporting artifacts; they are not 34
registered document profiles. A profile describes purpose and permitted content
([RFC0018](rfcs/0018-document-profiles-and-deal-packages.md)). JSON, XML and CSV
are representations of a model. A verification profile such as `pro-forma`
is a separate claim about checks, not a document type.

## Available

| Type | What it carries | Record contribution | Profile or contract |
|---|---|---|---|
| Underwriting record | Stated facts, assumptions, deterministic assertions and provenance | Any admitted record section | `deal-underwriting-v1`; [Format](../spec/UW_FORMAT_SPEC.md) |
| UW Lite | Human-readable summary with explicitly bounded projection/compilation | Its supported subset; omissions remain visible | No separate purpose id; [Lite](../spec/UW_LITE_SPEC.md) |
| Deal package | Member inventory, byte/semantic digests, typed links and evidence | Composes related documents; no automatic fact selection | UW Deal Package1.0; ZIP archive and derived JSON context view |
| Rent-roll fragment | One `rent_roll` section, optionally contributed to a record | `rent_roll` | UWPart1.0, no document-profile id |
| Operating-statement/T-12 fragment | One stated financial section with its source period | `operating_statement` | UWPart1.0; does not annualize a partial period |
| Cash-flow fragment | One cash-flow section and its stated dated rows | `cash_flow_series` | UWPart1.0; calculation admission remains separate |
| Lease abstract | Source-located terms, governing artifacts, conflicts and review status | Explicit lossy `rent-roll-v1` candidate edits | `lease-abstract-v1`; executed lease, proposal, amendment, guaranty and estoppel artifact kinds |
| Source note | Attributable transcription, summary or diligence context | Evidence references; no automatic financial projection | `source-note-v1` |
| Market-data document | Dated provider observations with units and stated basis | Explicitly accepted candidate values at existing section paths | `market-data-v1`; no deal id, calculation or pack |
| Portfolio sidecar | Entities, typed relationships and provenance | Links records; does not consolidate their economics | Portfolio1.0, `.uwportfolio.json`; optional conformance profile `portfolio`, no document-profile id |
| Verification receipt | Checks, selected inputs and result evidence pinned to their subject | Assurance artifact, not a new input of record | Receipt1.1; not a document-purpose profile |
| Signed artifact | Authenticated content and signer-key evidence | Integrity/authentication, not appraisal or credit approval | [Signing contract](../spec/UW_PROTOCOL.md); not a document-purpose profile |
| Loan quote/term-sheet abstract | Stated quote terms, nullable status and exact source locators | Explicit `record-facts-v1` candidates into the16 allowed `debt_structure` fields; no selected/funded loan or sizing result | `loan-quote-v1`; [library scope](document-facts.md) |
| Offering-memorandum abstract | Attributable property/appraisal facts, visible marketing statements and limitations | Six allowed `property`/`valuation` fact homes; asking price, NOI and schedules stay unmapped | `offering-memorandum-v1`; [library scope](document-facts.md) |
| Appraisal abstract | Stated singular appraisal opinion, dates, approach and conditions | Five allowed `valuation` fields; no underwritten-value or opinion selection | `appraisal-abstract-v1`; [library scope](document-facts.md) |

UWPart can carry other admitted standard sections or `x_` extension sections;
the three fragment rows are common uses, not a closed list. A package context
view does not inline arbitrary PDFs or images and is not a substitute for a
complete archive. A lease estoppel already fits the lease abstract's artifact
kind; a second `estoppel-v1` would duplicate that contract. An estoppel alone is
not an executed lease eligible for the rent-roll projection.

## Draft

| Type | What the proposal would carry | Candidate section contribution | Proposed id / design record |
|---|---|---|---|
| Borrower underwriting | Non-property borrower facts and a corporate term loan | Proposed `corporate_financials`, `borrower_term_loan` | `borrower-underwriting-v1`, [RFC0082](rfcs/0082-borrower-underwriting-profile.md) |
| Ground-lease/tenure contract | Ownership interest and ground-lease terms | Proposed tenure/ground-lease fields | [RFC0067](rfcs/0067-tenure-and-ground-lease-contract.md); no implemented standalone profile |

Drafts are not accepted input contracts and generic preservation of their
profile ids does not establish validation or verification support.

## Planned

Each row is the bounded specification for a possible future profile.
Their ids are **unassigned**. No source value is promoted without an explicit reviewed
edit, and no legal finding is inferred from an absent term.

| Type | Bounded future contract and record contribution |
|---|---|
| Existing-loan abstract | Locate executed debt terms, balances as of a stated date, assumption conditions and amendments; contribute only semantically matching `debt_structure` inputs. Preserve prepayment text without inventing a payoff calculation. Distinct from an unsigned quote. |
| Property-condition abstract | Report dated observed conditions, source repair estimates, time horizons and review flags; candidate contributions to `due_diligence` and `capital_improvements`. A reserve recommendation and an immediate repair estimate remain distinct. |
| Environmental abstract | Carry source-stated PhaseI/II findings, dates and follow-up flags into `due_diligence.environmental`. No independent environmental certification or clearance inferred from report receipt. |
| Title/survey/zoning abstract | Keep separate source types, effective dates, exceptions, encumbrances and unresolved items; contribute matching `due_diligence` facts. Combining the catalog row does not equate title insurance, a survey and a zoning opinion. |
| Capital plan/budget | Carry scoped line items, source amounts, schedule, contingencies and revisions; feed matching `capital_improvements` or `sources_uses` facts. Retain currency/period and do not add costs or select contingencies in an extractor. |
| Operating actual-versus-budget report | Carry both dated series, account mappings and explanations without collapsing actual, budget and forecast; contribute the applicable `operating_statement` variant. Reuse UWPart if a single existing section already expresses the entire need. |
| Tax-assessment abstract | State assessment vintage, assessed values, stated bill/tax period, appeal status and locators; contribute matching `property`/`operating_statement` facts. Assessed value is not an appraisal and a tax rate is not a tax expense. |
| Insurance summary | State policy period, coverage, exclusions, source premiums and review status; contribute matching `due_diligence` and expense inputs. Coverage limits do not establish replacement cost or policy adequacy. |
| Purchase-agreement abstract | State contract status, agreed price, deposits, dates, contingencies and amendments; contribute matching `valuation`, `sources_uses` and transaction facts. A proposal is not an executed agreement and deposits are not an inferred equity total. |
| Closing/settlement statement | Locate actual closing disbursements, debt proceeds, credits and final dates; contribute matching `sources_uses` facts without netting or reclassifying entries. Separate from the purchase agreement because it records what settled. |
| Construction draw/inspection statement | Preserve requested, inspected, approved and funded amounts as distinct dated observations, plus holdbacks and conditions; feed only matching construction/source-use facts. No percent-complete valuation or draw-interest convention is supplied. |

## Evidence only

| Material | How it travels | Why no new purpose profile |
|---|---|---|
| Original PDF, spreadsheet, scan or signed instrument | Source-evidence member with byte digest and locators | The original remains evidence; an eligible fact abstract is a separate member |
| Email or correspondence | Source evidence, subject to privacy review | A communication is not automatically an approved input |
| Photos, plans, permits and governing instruments | Source evidence; any extracted facts need attributable notes | These prove context or conditions; media/filename alone does not define a fact contract |
| Individuals' personal financial statements | Restricted evidence only where lawful; excluded from public examples | No public personal data or identity-authentication profile is introduced |
| Licensed external interchange formats | External evidence/reference subject to its terms | This catalog grants no rights to implement or redistribute a licensed standard |
| Credit/IC memo or presentation rendering | A view of the record plus attributed narrative | Reuse the underlying record; a second fact model would diverge |

## Why this set

A public [FDIC CRE review module](https://www.fdic.gov/risk-management-manual-examination-policies/commercial-real-estate-lending)
separates loan instruments, title/insurance and leases from commitments,
settlement sheets, operating statements and rent rolls (sections 13–14). Its
[construction review module](https://www.fdic.gov/risk-management-manual-examination-policies/construction-and-land-development-lending.pdf)
also distinguishes plans/permits, inspections and disbursement records. These
categories support adding settlement and draw statements to the planned set;
they do not prescribe UWMD's schema or imply regulatory compliance. The
[FDIC website policies](https://www.fdic.gov/about/website-policies) were checked;
only short factual category paraphrases are used, no forms or licensed material
are copied.

The proposed set retains the acquisition and financing candidates, folds
estoppels into the existing lease profile, and treats IC memos as views. The
appraisal candidate stays because the current Format already has appraised-value
and report-date fields (§4.6) and diligence facts (§4.13), including the existing
CC-08 consistency check. Add a type through the
[document-type playbook](playbooks/ADD_DOCUMENT_TYPE.md); registering a name
alone does not make it available.
