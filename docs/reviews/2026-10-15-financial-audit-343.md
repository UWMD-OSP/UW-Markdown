# Financial metric audit intake — Issue #343

Review date: 2026-10-15. Intake: [#343](https://github.com/UWMD-OSP/UW-Markdown/issues/343), auditor tracker `UWMD-METRICS-2026-10-14`, M01–M12. This is an independent investigation of the submitted hypotheses, not an acceptance of proposed financial definitions. No owner decisions are implied.

## Executive summary

The reported price-source and room-revenue differences reproduce. Neither establishes a departure from the current joint normative contract. The dictionary explicitly reads different purchase-price sources in M04 and different reported/derived room-revenue sources in M09. Existing validation reconciles other specifically named relationships; adding these two relationships requires a decision about scope and selection, followed by an RFC. There is no justified bounded implementation fix among these twelve findings on the evidence collected.

M02, M03, M05, M11 and M12 perform the arithmetic their definitions specify. M01, M06, M07, M08 and M10 expose accounting, eligibility or measurement-basis questions that deterministic arithmetic alone cannot answer. Full primary CoStar/STR text independently confirms the 100-based index convention and room-count exceptions, improving the intake's external evidence. Current detailed USALI F&B/GOP schedules and universal senior-housing/economic-occupancy alternatives remain unverified.

No release-blocking financial implementation defect is established. M04/M09 are important, nonblocking interoperability gaps with potentially material differences in investor-facing metrics. They become blockers for any specific promised reconciliation or external-program compatibility claim until that claim is implemented and verified. This conclusion does not certify lender acceptance or economic correctness under an unspecified external convention. Existing conformance passing does not establish either.

This review changes documentation and synthetic observation scripts only. No metric, schema, validation severity, conformance expectation, package version, manifest, release record or tag is changed. UWMD 5.0 remains reserved for the coordinated public launch; this audit does not prepare it.

## Repository reconciliation and authority

The supplied working directory is a container for six registered worktrees, rather than a Git repository itself. The requested initial commands were retried in `UW-Markdown`. Its checkout was clean on `work/rfc-0085-compaction-provenance`, commit `e70649ec`; the other five registered worktrees were also clean at inspection: `uwmd-closed-flags` (`435252b4`), `uwmd-codex-binding` (`3151ea33`), `uwmd-codex-signing` (`65f9254e`), `uwmd-release-5` (`f371fd0b`), and `uwmd-verification-examples` (`605c5b90`). None was used for edits.

`git fetch origin` failed twice with DNS resolution failure. A GitHub connector GET of `repos/UWMD-OSP/UW-Markdown/commits/main` independently confirmed cached `origin/main` was current: **`79d4c92e1da15153f0d5e4e19db02038116b469e`**. Its five latest commits were `79d4c92e`, `5612bf1c`, `d4d602b1`, `b8afdd1f`, `04e3152e`. An isolated local clone at `/tmp/uwmd-financial-intake-343` was explicitly advanced to that remote-tracking commit, rather than its older local `main`, and branched as `work/financial-audit-343`. Issue #343 was read in full with its comments endpoint: zero comments at intake.

`VERSIONS.md` establishes Format **3.0**, Protocol **4.1.0**, core/CLI **4.2.0**, verify **0.2.0**. Historical RFC module names/version literals do not select today's contract. Read sources include root/package agent guidance, `ARCHITECTURE.md`, `VERSIONS.md`, `CHANGELOG.md`, `ROADMAP.md`, `GOVERNANCE.md`, the RFC index and RFCs 0039/0079/0080/0081, Format, Protocol, metric dictionary/schema contracts, class validation and deterministic evaluator, relevant conformance families, and wiki 03/04/10/11. Governing precedence here is the user's joint-contract rule and governance: Format, Protocol, schemas and normative corpus establish required behavior together. Runtime is evidence of implementation, not authority to overrule them. RFC 0080 preserves financial decisions from RFC 0039 while replacing its module packaging; RFC 0081 removes compatibility paths and consolidates hotel field locations.

During final reconciliation, main advanced to **`e8ed8eb67c00ee8cb97a9617e61cff2450574ec2`** (PR #344). Its seven-file diff records the launch reservation and fixes the existing docs link; it changes no runtime, dictionary, specification, schema or corpus. The review branch was rebased onto that main. The financial results remain applicable; affected documentation checks were rerun.

All financial contract citations below refer to the original audited SHA; the cited financial files are unchanged on the final base. Dictionary citations identify both metric ID and class; this avoids confusing similarly named declarations. These are audit references into the existing dictionary, not a new registry.

## Disposition matrix

Evidence status applies to the claimed observation, with qualifications detailed below. Severity describes demonstrated consequence: **medium** means material comparability/basis risk; **low** means an explicit convention needing explanation. No financial arithmetic failure or loss of funds was demonstrated.

| ID | Evidence status | Technical disposition | Correct architectural layer | Severity / launch impact |
|---|---|---|---|---|
| M01 | Partially verified | External-authority evidence incomplete; calculation-definition question | Metric dictionary, documentation; authority-specific optional profile/adopter integration | Medium naming/accounting risk; nonblocking |
| M02 | Verified | Existing behavior correct; documentation clarification only | Metric dictionary, documentation/adopter integration | Low; nonblocking; inversion allegation contradicted |
| M03 | Verified | Existing behavior correct; representation/metadata gap for actual-use comparison | Metric dictionary, Format/schema if expanded; optional profile/adopter integration | Medium model-basis risk; nonblocking |
| M04 | Needs owner decision; numerical split verified | Missing validation relationship; calculation-definition question | Metric dictionary + Format/validation + conformance after RFC | Medium inconsistent price indication; nonblocking absent stronger claim |
| M05 | Verified | Existing behavior correct; documentation clarification only for scale | Metric dictionary, deterministic calculation, conformance, adopter integration | Medium 100× interchange risk; nonblocking |
| M06 | Partially verified | Representation/metadata gap; adopter-specific requirement | Format/input semantics, metric dictionary, optional profile/adopter integration | Medium period/occupancy/revenue comparability; nonblocking |
| M07 | Verified | Representation/metadata gap; adopter-specific benchmark requirement | Format/schema input eligibility, optional profile/adopter integration | Medium benchmark eligibility risk; nonblocking absent STR claim |
| M08 | Partially verified | Representation/metadata gap; external-authority evidence incomplete | Format/accounting scope, dictionary, optional profile/adopter integration | Medium denominator-scope risk; nonblocking |
| M09 | Needs owner decision; numerical split verified | Missing validation relationship; representation/metadata gap | Format/schema + dictionary/validation + conformance after RFC | Medium conflicting room-revenue indications; nonblocking absent stronger claim |
| M10 | Partially verified | Representation/metadata gap | Format/schema, documentation, optional profile/adopter integration | Medium area comparability; nonblocking |
| M11 | Verified | Existing behavior correct; external-authority evidence incomplete | Metric dictionary, documentation; separately scoped alternatives | Low; nonblocking |
| M12 | Verified | Existing behavior correct; documentation clarification only | Protocol, dictionary, documentation/adopter integration | Low under stated contract; nonblocking |

No item is classified as a demonstrated implementation defect or established normative inconsistency. M04/M09 remain design questions because no existing obligation was found that would authorize the proposed new equality/refusal rule.

## Priority investigation: M04 — purchase-price authority

**Exact contract.** Dictionary [`price_per_kw`](../../spec/metrics/builtin.json) (`data_center`, line 2943) is `valuation.purchase_price / property.critical_it_load_kw`; `price_per_commissioned_kw` (line 2907) is `quick_metrics.purchase_price / dc_capacity.critical_it_load_kw`. Both report currency at 2 dp. Format [§4.29–4.35/class verification rules](../../spec/UW_FORMAT_SPEC.md#class-verification-rules), CC-DC-08, requires exact equality of the two stated critical-load quantities, as explicitly decided in [RFC 0080 Decisions](../rfcs/0080-official-classes-are-builtins.md#decisions). Format §5.3 CC-10 requires sources-and-uses purchase price to match valuation purchase price; the registered check uses a $100 tolerance. It does not name frontmatter quick metrics.

The price source split predates builtin promotion: [RFC 0039 Calculations](../rfcs/0039-data-center-module.md#calculations) explicitly reads frontmatter price for the commissioned-load metric; RFC 0080 adds the generic builtin price intensive and preserves migrated calculations. Neither dictionary entry declares a valuation role preference. Format §4.6 distinguishes purchase price, appraisal and income/underwritten valuations; changing underwritten value does not change a formula that specifically names purchase price. Format §2.1 labels quick metrics denormalized mirrors updated by the engine, supporting the intent that a summary restates the underlying deal. Format §5.3, in its CC-15 explanation (lines4148–4152), explicitly calls quick metrics a frontmatter restatement with no cross-check of its own. The former comment names a historical financial_model section, not a current per-field price binding. Neither passage establishes a purchase-price source-selection or reconciliation rule across valuation variants. No authority rule was found selecting quick metrics over valuation or vice versa. The labels suggest the same transaction consideration when scope is identical, but that economic inference does not itself impose a normative relationship.

Protocol [§VIII.2](../../spec/UW_PROTOCOL.md#viii2-variable-resolution) resolves top-level frontmatter before sections before prior results. A section read uses caller's exact variant, then declaration's role, then unique primary/default/base/sole eligible block; ambiguity refuses as `CALC-RESOLVE-002`. Frontmatter price has no valuation variant selector. The selection rule makes reads deterministic, but does not reconcile two different source paths. Frontmatter `scenario` is descriptive under Format §2.2b and cannot select financial behavior. Class validation uses its existing role resolution independently of a caller's explicit calculation context.

**Independent reproduction.** The [priority script](2026-10-15-financial-audit-343.repro.mjs) creates a complete required `dc_capacity` field subset, rather than relying on a missing required field to hide the check. Inputs below use invented dollars/kW; unrelated metadata warnings are preserved in its output.

| Case | Inputs | `price_per_kw`, `price_per_commissioned_kw` | Validator evidence |
|---|---|---|---|
| Equal prices | Both prices 10m; both loads 1,000 | 10,000; 10,000 | Metadata warnings only |
| Price conflict | Valuation 10m; quick 12m; loads 1,000 | 10,000; 12,000 | No price consistency finding |
| Missing valuation price | Quick 12m; loads 1,000 | null; 12,000 | No inferred fallback |
| Missing quick price | Valuation 10m; loads 1,000 | 10,000; null | No inferred fallback |
| Unequal loads | Valuation 10m/property 1,000; quick 12m/capacity 2,000 | 10,000; 6,000 | **CC-DC-08 error** |
| Existing price check control | Sources-and-uses 12m; valuation 10m | Unchanged metric inputs | **CC-10 error** |
| Primary vs forecast valuation | Primary actual purchase 10m; summary forecast purchase 14m; quick 12m | Default 10,000; 12,000. Exact forecast: 14,000; 12,000 | No price relationship |
| Missing exact / ambiguous valuation | Nonexistent exact selection / two summary variants with no primary/default/base | `CALC-RESOLVE-002`; 12,000 | Ambiguous validation records CC-16 |
| Descriptive scenario | Same facts, stabilized acquisition vs value-add | Both remain 10,000; 12,000 | No scenario-driven selection |

The conflict is arithmetic-correct and economically ambiguous. Equality may be appropriate for the same transaction/interest/currency/date, but applying it across selected scenarios requires an owner-defined basis. **Recommendation:** an RFC should decide canonical numerator, whether the second metric remains separately meaningful, and whether same-basis duplication is reconciled or refused. Define absent input, variant, differing transaction/scenario, and severity behavior before implementation. No equality check is added here.

## Priority investigation: M09 — reported versus derived room revenue

**Exact contract.** Format [§4.3 Hospitality Variant](../../spec/UW_FORMAT_SPEC.md#hospitality-variant-rfc-0081-g3) explicitly preserves reported-revenue RevPAR and ADR/occupancy-derived room revenue. Dictionary `hospitality` entries (lines 1271–1363) define:

- `adr`: reported `noi_model.income.rooms_revenue / rent_roll.occupied_room_nights` (2 dp).
- `revpar`: reported rooms revenue / `rent_roll.available_room_nights` (2 dp).
- `total_room_revenue`: stated `rent_roll.adr × rent_roll.occupancy × rent_roll.available_room_nights`, null if any of those three is absent (2 dp).
- `room_revenue_per_key`: that derived revenue explicitly rounded to 2 dp, then divided by `property.keys`, reporting 2 dp.

The computed metric `adr` and stated source `rent_roll.adr` are different paths: the latter is not automatically overwritten by the former. Similarly, computed occupancy uses occupied/available nights; the derived room-revenue formula consumes stated occupancy. RFC 0080's Decisions explicitly acknowledges inconsistent inputs can differ and chooses reported revenue for canonical RevPAR. [RFC 0081 §5/G3](../rfcs/0081-one-format-one-protocol.md#5-builtin-classes-without-transition-rules-hospitality-consolidated-g3) consolidates field locations while preserving operations and precision. Format CC-HOSP-04 emits a warning if a comp is stated but canonical RevPAR is uncomputable; it forbids an ADR×occupancy fallback. It does not reconcile reported and reconstructed revenue.

The [hospitality rent-roll schema](../../spec/schemas/rent-roll-hospitality.schema.json) states available nights as keys×days in the period and occupied nights as rooms sold in the period, with numeric field contracts. It does not provide a shared period/basis identity connecting these values to `noi_model.income.rooms_revenue`, or a specified equality/tolerance relationship for stated ADR/occupancy. Freeform provenance and variants can describe a basis but do not create such a verification obligation. Dates of provenance are not automatically revenue measurement periods.

**Independent reproduction.** The priority script covers matching/conflicting inputs, missing values, explicit roll selection, decorative basis labels, zero boundaries and the quantization boundary. Default keys=100, available nights=1,000, occupied nights=900, stated ADR=200 and stated occupancy=.9.

| Case | Computed derived total / per key | Canonical RevPAR / computed ADR | Validation outcome relevant to claim |
|---|---|---|---|
| Reported revenue 180,000 | 180,000 / 1,800 | 180 / 200 | No revenue conflict |
| Reported revenue 100,000, asserted same basis | 180,000 / 1,800 | 100 / 111.11 | No reconciliation finding; no CC-HOSP-04 |
| Occupied nights 800, reported 100,000 | 180,000 / 1,800 | 100 / 125 | No stated-occupancy vs night-count reconciliation |
| Different period labels / forecast vs actual labels | 180,000 / 1,800 | 100 / 111.11 | Labels do not select/change formula |
| Missing reported revenue | 180,000 / 1,800 | null / null | **CC-HOSP-04 warning**; no inferred RevPAR fallback |
| Missing stated ADR / missing stated occupancy | null / null | 180 / 200 | Computed ADR does not fill missing source ADR |
| Missing occupied nights | 180,000 / 1,800 | 180 / null | Separate source dependencies |
| Null available nights | null / null | null / 200 | CLS-04 and CC-HOSP-04 |
| Zero occupancy, zero occupied nights, reported zero | 0 / 0 | 0 / `CALC-DIV-ZERO` | Comp underperformance CC-HOSP-01; zero is preserved |
| Zero occupancy, positive reported 100,000 | 0 / 0 | 100 / `CALC-DIV-ZERO` | No reconciliation finding |
| Zero available nights, positive reported revenue | 0 / 0 | `CALC-DIV-ZERO` / 200 | CC-HOSP-04 plus class calculation error |
| ADR=1.005, occupancy=1, available/occupied=1, keys=2, reported=1.005 | 1.01 / .51 | 1.01 / 1.01 | Explicit inner rounding and final quantization preserved |
| Zero keys | 180,000 / `CALC-DIV-ZERO` | 180 / 200 | Class calculation error; no zero-denominator substitution |
| Exact forecast roll: available=2,000, occupied=1,800, ADR=300, occupancy=.9; reported=180,000 | 540,000 / 5,400 | 90 / 100 | Both use explicitly selected roll; reported numerator unchanged |

“Same basis” is an assumption asserted by the synthetic investigator, not something the current schema proves. `period` and `modeling_basis` in the differing-label probes are deliberately unstandardized illustrative extension labels; they test that adding labels does not create semantics. They are not proposed fields. Primary/summary role selection is tested separately from those labels. Actual versus forecast revenue can legitimately differ; a blanket equality check would be unsound without a shared-basis assertion.

**Recommendation:** define the period, eligible revenue, rooms-sold/supply scope, actual/forecast basis and selection context first. Then decide reconciliation of stated occupancy with counts, stated ADR with reported eligible revenue, and reported versus derived revenue, including rounding tolerance and missing-input outcomes. Canonical RevPAR remains unchanged. The allegation of a CC-HOSP-04 violation is contradicted; the absence of a different reconciliation obligation is reproduced.

## Remaining financial semantics and reproductions

The [hospitality helper](2026-10-15-financial-audit-343.hospitality.repro.mjs) and [other-metrics helper](2026-10-15-financial-audit-343.remaining.repro.mjs) evaluate current dictionary declarations using deterministic code. The latter includes six cash-on-cash cases across all eleven income classes. These observations are independent tests of the reference evaluator, not a second implementation.

| ID | Exact contract and source fields | Synthetic inputs → observed output | Financial-semantic conclusion |
|---|---|---|---|
| M01 | Dictionary hospitality `fb_gross_margin`; Format §4.34; `section-hotel-food-beverage.schema.json`: `(fb_revenue − fb_cogs − fb_labor) / fb_revenue`, 4 dp | Revenue 100,000 / COGS 30,000 / labor 20,000 → .5; zero labor → .7; absent labor → null; zero revenue → division refusal | Labor inclusion is explicit. Does not cover all departmental expenses. Whether producer COGS already includes labor must be established; no automatic double-count allegation follows. Current USALI naming/scope evidence incomplete. |
| M02 | Dictionary data_center `rent_index`; Format CC-DC-07: contracted `rent_per_kw_month / market_rent_per_kw_month`, `x`, 4 dp | 110/100 → 1.1; 80/100 → .8; absent market → null; zero market → division refusal | Deliberate subject/market orientation; values below .85 warn. Mark-to-market upside is a different question. |
| M03 | Dictionary data_center `annual_facility_kwh_at_contract`, `annual_power_cost`; Format §4.29–4.31 and capacity/power schemas | Contracted 1,000kW × design PUE 1.5 ×8,760 → 13,140,000kWh; tariff .1 → 1,314,000. Measured PUE 1.2→2 changes neither. Stated bill 700,000 or zero wins even without capacity/rate; missing tariff/no bill → null | Explicit continuous contracted/design-load scenario, not actual usage. Annual cost inlines rounded annual energy per migrated dependency rule. Metered-pass-through billing does not establish physical utilization. A utilization forecast needs defined inputs/period, not merely a billing enum. |
| M05 | Dictionary hospitality `revpar_index`: `round(rooms_revenue / available_room_nights,2) / market_revpar`, `x`, 4 dp | 60,000/1,000/50 → 1.2. Revenue 100.004, one night, market=1 → 100 after explicit cent rounding | STR scale is 100-based; compatible UWMD ratio×100 converts scale. RFC 0080 intentionally preserves intermediate dependency rounding. Changing rounding would change the metric, even if another convention preferred it. |
| M06 | Dictionary senior_housing `revpor`: `effective_gross_income / (occupied_units ×12)`, currency 2 dp; Format §4.3 roll | Annual EGI1,200,000 / occupied80 → 1,250 monthly; occupied100 →1,000; zero occupied → division refusal | Uses the stated roll count, not a calculated average resident/unit-month series. A snapshot-style roll is possible, but no evidence every producer necessarily uses a snapshot. Annual numerator and eligible revenue basis need disclosure for comparison. |
| M07 | Hospitality dictionary `occupancy`=occupied/available, `adr`=reported rooms revenue/occupied, `revpar`=reported/available; rent-roll schema | Same 100,000 reported revenue with occupied800 →ADR125; occupied900 →111.11; 800/1,000 →occupancy .8 | Numeric contracts cannot identify complimentary/no-show/promotional nights. STR eligibility is specific, with exceptions; do not impose a blanket free-night exclusion or assume one universal physical-occupancy definition. |
| M08 | Dictionary hospitality `gop_margin`: `gross_operating_profit / effective_gross_income`, fraction, 6 dp | GOP45,000/EGI150,000 →.3; same GOP/EGI180,000 →.25 | No faulty division. EGI may map to operating revenue in a particular accounting bridge. The reference hotel example explicitly sums hotel revenue lines to EGI; a discrepancy is not inherent in every record. Detailed authority-specific GOP exclusions remain unverified. |
| M10 | Format §4.1, Protocol §XIII.1, dictionary size_intensives/README: office/industrial RSF, retail GLA, storage NRSF | Price10m: office RSF50,000 →200/SF despite another area40,000; remove RSF →null; retail GLA40,000 →250/SF; storage NRSF25,000 →400/NRSF | Class categories exist and correct selection is reproduced. Missing standardized authority/edition/basis metadata is narrower than an absence of area semantics. Unit conversion cannot determine which space counts. Open payload/provenance can retain custom evidence. |
| M11 | Dictionary self_storage `economic_occupancy`: `EGI / gross_potential_rent.value`, fraction, 6 dp | Corpus EGI1,053,000/GPR1,080,000 →.975; EGI1.1m/GPR1m →1.1 | Deliberately includes whatever is in stated EGI. Existing fixture includes other income135,000 and vacancy/credit loss162,000. Above1 is not proof of impossible physical occupancy. Universal alternative not established. |
| M12 | Protocol §VIII.5.1; RFC0079 D3; all income-class dictionary `cash_on_cash` | Equity3m; unordered Y2=900,000, Y1=600,000 →.2. Y1zero→0; negative600,000→−.2; absentY1 with NOI1m/ADS700,000→.1; missing total equity despite sponsor3m→null; zero equity→division refusal | Explicit stated-Y1 levered flow / total equity, lazy NOI−ADS fallback. No sponsor substitution, capex inference, tranche aggregation or array-first-year assumption. Program-specific constraints on fallback or capital spending would be separately governed. |

M12's exact formula is preserved: `equity_total == null ? null : (Y1.net_cash_flow_levered != null ? Y1.net_cash_flow_levered : net_operating_income - annual_debt_service) / equity_total`, with the full paths in the dictionary. Missing inputs, arithmetic refusals and finite wrong stated values remain distinct under Protocol §§VIII.2/5/6/5.1. No reproduction fills absent inputs to clear a finding.

## Existing coverage and missing regression controls

The implementation paths are `packages/uwmd-verify/src/builtin-packs/{hospitality,data-center,senior-housing,self-storage}.ts`, shared income-class packs, `calc/{index,evaluator,builtins,quantize}.ts`, `section-resolution.ts`, `builtin-class-validation.ts`, and `validator.ts`. Runtime recipes agree with the dictionary in the inspected metrics; dictionary/pack parity tests cover all 171 class-scoped declarations. Agreement is internal correctness evidence, not external financial certification.

- `conformance/builtin-classes/01-hospitality-fixture/expected.json` pins RevPAR129.6, derived revenue3,784,320, per key47,304, index.81 and labor-inclusive F&B margin.2778. `02-no-comp-set` pins null index. These are explicit existing expectations, not values to regenerate.
- Data-center `06-data-center-fixture`, `08-data-center-no-comp`, `11-data-center-fallback`, `61-data-center-dependency-rounding` cover capacity, bill precedence/fallback, absent comps and dependency rounding. Fixture06 pins price/commissionedkW16,000 and rent index.8; generic `conformance/calc/fixtures/data_center-price_per_kw` covers the other price formula. None establishes a shared price authority.
- `conformance/calc/fixtures/self-storage-economic-occupancy` pins .975 with explicit EGI/GPR shape. Senior-housing care-revenue fixture tests a different metric; the metrics census pins `revpor_monthly` to7,583.02. The census pins hotel GOP margin to.417768. `conformance/metrics/controls.mjs` covers precision floors/ceilings, size selectors, shared cash-on-cash Y1/zero/missing equity/lazy evaluation and unresolved multi-tranche refusal.
- Excel parity inspection includes core hospitality/senior/self-storage pack tests, Excel `official-builtins.test.ts`, and workbook/import tests. These execute emitted formulas through JavaScript test helpers and inspect workbook bindings; no live Microsoft Excel process was run. Existing hospitality pack tests do not numerically execute populated F&B and comp-set index formulas because those optional example inputs are absent. This is a missing starter-tool regression control, not evidence the formulas disagree.
- Missing normative relationships: M04 same-basis numerator reconciliation, M09 shared-basis revenue/ADR/count reconciliation. Missing representation: interoperable period/model/eligibility/accounting/measurement authority assertions. The script records current absence; it does not silently establish new conformance requirements. Future RFC fixtures need matching, conflicting, absent, variant/period, zero, and quantization-boundary cases tied to the approved relationship and ownership.

## External authority evidence and gaps

Primary-source checks were performed independently on 2026-10-15. No search excerpt is promoted to a completed current-edition accounting review.

| Authority / edition / effective date | Verified scope | Limits for this audit |
|---|---|---|
| [CoStar/STR glossary](https://www.costar.com/products/str-benchmark/resources/glossary), current undated web resource; effective date not stated | RevPAR Index/RGI is subject/group RevPAR×100; parity100 | Verifies M05 scale. Does not establish required intermediate rounding, measurement period or accounting equivalence with UWMD. |
| [CoStar/STR Historical Benchmarking Data Reporting Guidelines](https://www.costar.com/products/str-benchmark/resources/guidelines/historical-benchmarking-data-reporting-guidelines), undated current page, identifies USALI12 | Ordinary complimentary/no-show/owner-use exclusions; qualifying promotional/contract free-night inclusions; supply/closure and room-revenue scope rules | Establishes benchmark-specific M07 requirements, not universal UWMD policy. Also permits same-day resale occupancy above100%, so naive occupancy caps are not a complete STR mapping. Do not weaken UWMD's existing stated fraction constraint without RFC. |
| [HFTP USALI11 PDF](https://www.hftp.org/downloads/documents/usali/usali-659-11-digital.pdf), historical 11th revised edition; [12th-edition presentation](https://www.hftp.org/downloads/documents/annual-convention/ac24-pres-usali02.pdf), indexed effective2026-01-01 | Historical indexed F&B schedule suggests revenue-minus-cost-of-sales gross-profit naming and separately presented labor | Full PDF retrieval failed. Current12th F&B/GOP schedules were not inspected. Need actual edition/schedule, accounting perimeter, labor/COGS mapping, other departmental expenses and GOP exclusions. Historical snippets cannot authorize a current formula change. |
| [Healthpeak Q2 2026 supplemental](https://www.sec.gov/Archives/edgar/data/765880/000162828026052608/ex99306302026.htm), periods ended2026-06-30 | Company-specific RevPOR using adjusted revenues, average occupied units/month and three/six-month divisors | Concrete alternative for M06, not universal senior-housing authority. Adjusted revenue/NREF variations require their reconciliation; resident vs unit, care/nonresident fees and averaging remain target-program decisions. |
| [Green Grid PUE glossary](https://www.thegreengrid.org/node/372), undated definition | Facility energy/ICT equipment energy | Does not prescribe utilization forecast, annual tariff, billing policy or the8,760-hour scenario. |
| [RICS Code of Measuring Practice](https://www.rics.org/profession-standards/rics-standards-and-guidance/sector-standards/real-estate-standards/code-of-measuring-practice), sixth edition globally effective May2015; page recommends sixth and/or IPMS All Buildings pending seventh | Measurement basis should be documented | Seventh still described as consultation draft despite stated2026-10-13 consultation close. No inference of final publication. No complete BOMA/IPMS/RICS crosswalk performed. |
| Detailed current GOP schedules and universal economic-occupancy definition | Not established | Indexed undated STR GOP sample could not be retrieved in full. M08 and external M11 alternatives remain unverified as universal definitions. Need exact authority, edition, effective date, revenue inclusion, concession/vacancy/credit loss treatment and exclusions. |

## RFC candidates, compatibility and implementation sequence

These are recommendations for the owner, not accepted RFCs or new required fields. Keep one dictionary and verification core.

1. **M04 price relationship:** decide whether these two numerators always describe one transaction consideration or may legitimately differ by scenario/interest/date. Select authoritative source/role/context and missing-input behavior. Formula unification changes results and receipt/pack identity; a new check changes conformance verdicts. Both require RFC and compatibility assessment.
2. **M09/M07 hospitality basis and reconciliation:** decide how comparable periods, actual/forecast status, eligible room supply/sales and revenue scope are asserted. Approve any occupancy/ADR/revenue relationship and quantization tolerance, then add validation. Retain canonical RevPAR unless separately approved. New required metadata would affect existing producers; optional assertions may avoid universal burden but need defined missing/unverifiable outcomes.
3. **M01/M06/M08/M10 authority mappings:** obtain selected current schedules and an adopter need before standardizing accounting/measurement basis. An optional authority-specific module/profile may be appropriate; existing optional conformance profiles do not already implement lender/STR/USALI compliance. A country label alone must not change formulas. Jurisdiction, program, version and effective date are requirements-crosswalk concerns, not grounds for a parallel metric registry.
4. **Editorial clarifications:** explain M02 orientation, M03 contracted/design assumption, M05 index scale and explicit rounding, M11 EGI scope, M12 Y1/fallback. Separately improve populated F&B/index Excel regressions against existing formulas if desired. Neither requires adopting an outside formula.
5. After owner decisions and accepted RFCs, implement narrowly scoped changes with synthetic positive/negative/absent/variant/period/boundary controls and run gates. Separate any subsequently demonstrated implementation defect into its own bounded PR. Never regenerate expected values merely to remove a discrepancy.

Release sequencing: no audit-driven release stop is established; no 5.0 actions are authorized here. Important interoperability disclosures can precede launch without claiming authority/program certification. Institutional/lender compliance and new actual-utilization or alternative return metrics are deferred extensions until selected and specified. A later confirmed financial defect must explicitly state its next-release impact and go to the owner independently of the release-engineering session.

## Verification record

Environment: Linux x86_64, kernel7.0.0-38-generic; Node24.21.0; npm11.19.0; Python3.12.3. Source SHA `79d4c92e1da15153f0d5e4e19db02038116b469e`. Scripts run against locally built workspace packages, not published tarballs. All synthetic case data are invented; no private deal material was used.

The three durable reproduction commands are:

```bash
node docs/reviews/2026-10-15-financial-audit-343.repro.mjs
node docs/reviews/2026-10-15-financial-audit-343.hospitality.repro.mjs
node docs/reviews/2026-10-15-financial-audit-343.remaining.repro.mjs
```

They pass **29 +15 +82 =126 synthetic cases**. The priority helper retains complete validator findings, including metadata omissions; `ok:true,value:null` is kept distinct from typed calculation refusal. The observations do not certify the deliberately minimal records as complete valid underwriting documents. [Evidence artifact](2026-10-15-financial-audit-343.evidence.json) retains observed outputs. They are review controls outside `conformance/`; this PR establishes no new financial baseline.

| Exact command | Result | Log suffix |
|---|---|---|
| `npm ci --cache /tmp/uwmd-npm-cache` | Exit 1; esbuild postinstall spawnSync EPERM | npm-ci / npm-ci-ignore-scripts |
| `npm ci --ignore-scripts --cache /tmp/uwmd-npm-cache` | Exit 0; 252 packages installed | npm-ci / npm-ci-ignore-scripts |
| `npm run build` | Exit 0; all eight workspaces built | build |
| `npm --prefix packages/uwmd-verify test -- src/builtin-class-validation.test.ts src/builtin-packs/metric-dictionary.test.ts src/builtin-packs/index.test.ts --pool=forks --maxWorkers=2` | Exit 0; 84 tests / 3 files passed | targeted-verify |
| `npm --prefix packages/uwmd-core test -- src/packs/hospitality.test.ts src/packs/senior-housing.test.ts src/packs/packs.test.ts --pool=forks --maxWorkers=2` | Exit 0; 26 tests / 3 files passed | targeted-core |
| `npm --prefix packages/uwmd-excel test -- src/official-builtins.test.ts --pool=forks --maxWorkers=2` | Exit 0; 2 tests / 1 file passed | targeted-excel |
| `npm test` | Exit 1; 3945 passed / 170 failed across all workspaces (173 files passed / 11 failed) | test |
| `npm run typecheck:tests` | Exit 0, all workspaces | typecheck-tests |
| `npm run validate-schemas` | Exit 0; 62 passed / 0 failed | validate-schemas |
| `npm run conformance` | Exit 1 in pre-run Node test; runner not reached | conformance |
| `node --test --test-reporter=spec --test-isolation=none scripts/conformance-targets.test.mjs` | Exit 1; 11 passed / 1 failed; subprocess returns empty stdout | conformance-targets-diagnostic |
| `node scripts/run-conformance.mjs` | Exit 0; 1089 passed / 0 failed / 0 updated | conformance-direct |
| `npm run conformance:profiles` | Exit 2; Python unit tests 8 passed; Node profile checker fails spawnSync python3 EPERM | conformance-profiles |
| `npm run verify-indexes` | Exit 0; 2 Node tests passed; schema/dictionary/RFC/source indexes agree | verify-indexes |
| `npm run verify-codes` | Exit 0; 277 emitted codes agree | verify-codes |
| `npm --prefix tools/docs-site run build` | Exit 127; vitepress absent before docs dependencies installed | docs-build |
| `npm --prefix tools/docs-site ci --ignore-scripts` | Exit 0; installed 126 packages | docs-ci |
| `npm --prefix tools/docs-site run build` | Exit 1; baseline dead link `./docs/reviews/2026-10-14-next-release-readiness` in `about/changelog.md` | docs-build-retry |
| `npm --prefix tools/docs-site run build` after rebasing onto PR #344 | **Exit 0**; 154 source copies, bundles and pages rendered; syntax/chunk-size warnings only | docs-build-final |
| `npm run verify-indexes` after rebase | Exit 0 | verify-indexes-rebased |


Full-suite workspace results: verify **2,582/0**, core **951/24**, batch **7/0**, CLI **15/139**, Excel **200/5**, lake **65/0**, report **3/2**, signing **122/0** (passed/failed). Signing passed all 122 here; the intake's prior timeout did not recur in this run. Targeted financial/parity checks passed **112 tests** (plus a separate hospitality/senior repeat of 10).

Direct reference corpus breakdown: Reader 26; Verifier 688; optional Integrity 32, Module 76, Representations 135, Portfolio 14, Sensitivity 5, Stochastic 7; starter products 106. This separates the **983 standard/profile checks** from starter-tool checks; none are an independent engine. No portable-driver pass is claimed for this audit: the profile guard could not complete its subprocess stage.

A minimal diagnostic `spawnSync(process.execPath,['-e','console.log(123)'])` reproduced `EPERM` with empty captured streams and status 0. All failed test files involve spawned CLI/output capture, and the wrapper/profile guard failed at that same boundary. This is infrastructure evidence, not an established numerical disagreement; remote CI must be assessed separately from these local results. This session's policy does not allow requesting unrestricted shell approval.

The initial docs failure originated in an existing `CHANGELOG.md` link to the next-release-readiness review. PR #344 fixed it in its owning workstream before this review was rebased. This report is not added to the site copy plan. No new docs-site route or normative index was introduced. Raw logs remain `/tmp/uwmd-343-*.log`; the evidence artifact records their hashes. Incidental executable-bit changes from npm installation were restored before preparing the diff.

Full gates are not represented as green where infrastructure failures intervene. The initial documentation failure was corrected upstream and its final rerun passed. The auditor's earlier 4,113/1 timeout result is historical intake evidence, not this audit's result. Reference and portable-driver results are not independent implementations; only actually executed checks below are claimed.

## Remote CI follow-up before merge

[GitHub Actions run 38701913406](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/38701913406), on review head `881fc68db968673a740b5ab9b4cdba02edf5f960`, completed all 13 non-lint jobs successfully, including Node 20/22 build and test, Windows build/test/conformance, coverage, schema and governance guards. Its Lint job alone failed on string concatenation in the hospitality reproduction helper. The follow-up uses template interpolation; all 126 local synthetic observations are unchanged, and repository lint now exits 0 (one existing warning). Final head-specific CI verification is recorded in the PR before merge.

Successful remote jobs do **not** replace the local full-suite result: **3,945 passed, 170 failed** remains the result of that local run. They provide separate execution evidence in an environment without the reproduced local subprocess restriction. M04 and M09 remain demonstrated consistency gaps requiring semantic decisions, not confirmed implementation defects. No normative formula, schema, conformance baseline or release version changes in this follow-up.

## Genuine owner decisions

- For M04, must both prices represent the same economic fact, and which source/selection context governs? If variants may differ, what assertion establishes comparability before validation?
- For M09, should reconciliation be required only after period, scope and actual/forecast basis are expressly matched? Which count/revenue relationship and tolerance should an RFC propose? Canonical RevPAR currently remains reported-revenue based.
- Which external compatibility claims matter for launch: STR benchmarking, a selected USALI edition, a particular senior-housing investor/lender convention, or area measurement standard? Who can supply current authoritative schedules and approve their mappings? These cannot be inferred from geography or generic industry practice.
- Should missing basis merely be disclosed, or should a selected optional program refuse to certify it? Requiredness and severity are normative decisions, not implementation cleanup.

No approval is needed to preserve existing M02/M11/M12 behavior. No financial convention is changed pending those decisions.
