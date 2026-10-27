# Known limits

UWMD verifies stated assertions against explicit inputs and accepted procedures.
A valid record is not a complete underwriting package, and an exit 0 does not
mean every financial, legal or source assertion was checked. Read the report's
failed, unavailable and unchecked coverage as well as its exit code.

The current reference was exercised with 64 synthetic edge cases: 43 handled
within the boundaries below,4 refused clearly and17 gaps grouped into seven
follow-up issues. These additional probes used Windows 11 / Node 24.14.1 and source
`90b4b77e1731056e85f6f464b9f5530618153880`; they do not establish every runtime,
property or legal jurisdiction. Source tests and required conformance CI cover
the independently declared runtime matrix. Golden/QA fixtures are not an
investment track record.

## Facts, checks and projections

| Area | What the current contract can carry or check | Boundary |
|---|---|---|
| Mixed properties and multiple buildings | Separate records linked in a portfolio; explicit building/unit labels | A descriptive relationship is not a consolidated portfolio model or a verified fractional interest |
| Vacant, land, zero/negative NOI | Explicit zero occupancy, stated land carry and finite income/expense facts; applicable dictionary assertions | Missing income is not zero; a negative or zero denominator can make a particular metric unavailable |
| Construction and lease-up | Stated absorption/turnover schedules and their bounded native checks | No general construction-draw approval, draw-interest or redevelopment model |
| Lease facts | Native lease types, renewal/termination facts, TI/LC balances, explicit rent steps and closed-period expense-recovery checks | No inference that an option will be exercised, a tenant will renew or a source term is legally enforceable |
| Loan and capital facts | Explicit IO/amortization inputs, ordinary assumed/seller-loan facts, admitted multi-tranche sizing, stated rate-cap terms and bindings | A stated debt-service amount is not proof of a generated lifetime payment schedule or future cap replacement price |
| Reserves | Admitted property-reserve movements and balance identities at their stated quantum | Conditional availability, lender-reserve class and bank-interest treatment are not covered by that identity contract |
| Dates and units | Explicit dated flows, accepted declared day counts, leap-day/partial/fiscal-year dates; SF, units, sites, keys, beds and kW at the registered class basis | No implicit annualization, unit conversion or universal month-end rolling rule |
| Source lifecycle | Explicit null statuses, ambiguous source terms, visible supersede history and bounded projection omissions | A conflict needs a resolution; an amendment is not automatically the legally controlling instrument |
| Large/Unicode data | A 1,200-row synthetic roll and non-ASCII QA labels were preserved and checked through the actual CLI | This is a tested example, not an unlimited file/row-size guarantee or a certification of every row's business identity |

Lease abstracts validate attribution and null-status grammar for their material
terms. Arbitrary term objects in an abstract do not acquire economic semantics
merely because they are valid JSON. An `x_` extension can preserve an unsupported
fact; an implementation must supply that extension's contract before claiming
it checked the fact. The [document catalog](document-types.md) distinguishes
available profiles, drafts, planned contracts and source evidence.

## Gaps and clear refusals

| Limit | Current route and next step |
|---|---|
| Typed fee-simple/leasehold, condominium/partial and JV/TIC interests; redevelopment transitions | Preserve explicit ownership/source facts. Do not infer a legal interest or share-sizing basis. [Issue572](https://github.com/UWMD-OSP/UW-Markdown/issues/572); RFC0067 remains draft. |
| Automatic free-rent, percentage-rent, CPI floor/cap and master-lease projections | Keep source terms attributable; state any adopted dated cash flows explicitly. A future procedure needs accepted source-date, index, ordering and cash conventions. [Issue573](https://github.com/UWMD-OSP/UW-Markdown/issues/573). |
| Prepayment, defeasance and yield-maintenance amounts | Preserve loan terms and attributed externally stated amounts. No securities basket or payoff is priced by the reference. [Issue574](https://github.com/UWMD-OSP/UW-Markdown/issues/574). |
| Draw-interest and conditional holdback release | Explicit cash rows and reserve identities do not decide approvals, percent complete or unrestricted availability. [Issue575](https://github.com/UWMD-OSP/UW-Markdown/issues/575). |
| Implicit month-end roll | Supply exact dates; accepted day counts do not choose a payment schedule. [Issue576](https://github.com/UWMD-OSP/UW-Markdown/issues/576). |
| Universal freshness | Preserve vintage and review findings. Market-data lookup has an explicit staleness policy; there is no age cutoff that makes every document current. [Issue577](https://github.com/UWMD-OSP/UW-Markdown/issues/577). |
| Standalone duplicate unit ids | The probe retained two identical unit ids without a uniqueness diagnostic. Verified aggregates do not certify unique rows. Do not silently deduplicate or repair ids. A future standalone scope/rule needs acceptance. [Issue578](https://github.com/UWMD-OSP/UW-Markdown/issues/578). |

The refusal controls reported invalid termination timing (`LSE-04`), unsupported
lender-reserve/bank-interest treatment (`RSV-04`) and a reserve identity mismatch
(`RSV-06`). These are finite examples; inspect the actual code/message and
assertion state instead of treating a warning, unavailable result or unrelated
successful assertion as coverage of a missing procedure.

## Currency and geography

A single declared non-USD currency is representable: the probes ran EUR with the
same currency-independent dictionary arithmetic. This does not add FX rates,
multicurrency netting or conversion. Money relationships must follow their own
explicit currency contract, including RFC0092's frontmatter-currency agreement.
Dollar notation in examples is not permission to reinterpret a money amount.

The record can preserve non-US location facts; a synthetic Canadian location
passed the current structural route. The reference does not thereby implement
every country's address validation, taxes, law, lending policy or measurement
practice. Class calculations use their declared inputs and registered units.
Jurisdiction-specific assumptions and any new financial convention need an
explicit contract rather than a default inferred from an address.

## Assurance boundaries

Signatures authenticate the stated key/content relationship. Digests identify
bytes or a canonical subject. Neither makes a source report accurate, establishes
a person's identity or replaces professional review. An appraisal opinion stays
distinct from an underwritten value; a quote ceiling stays distinct from a
computed LTV; asking price stays distinct from an agreed purchase price.

RFC0092 pro-forma support is scoped to the CLI and public library, proven at
source e2bd0067 through issues551/552; there is no pro-forma MCP/HTTP binding yet.
Exit 2 was shown only by fault injection. Read the
[precise support scope](https://github.com/UWMD-OSP/UW-Markdown/blob/main/docs/wiki/03-core-library.md#rfc-0092-support-scope)
and use current source when a registry package with the same version contains
older code. This page grants no new profile, formula or jurisdictional claim.


RFC0129 source-fact profiles are supported through the current public library,
package admission and complete Lite source views. Fact-operation CLI/MCP/HTTP
bindings and Lite compilation remain unsupported. Attribution and byte integrity
do not authenticate an institution or establish source truth or legal adequacy.
See [the scope](document-facts.md).
