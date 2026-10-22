# 13 — Build status (living document)

**Owner rule,2026-10-17.** AGENTS.md and CLAUDE.md carry the rule near the top:
all @uwmd npm packages launch together at5.0.0; prelaunch releases use4.x.x from
main as needed, including incompatible changes. Zero prelaunch compatibility:
no migration/deprecation work, consumer-breakage analysis, bump recommendations,
or prelaunch artifact preservation/repair. Earlier contrary work is retired.
Current RFC/conformance/read-only verification and source-integrity requirements
remain. No package numbers or release publication are changed here.

**Agent execution removed from the toolkit (owner decision, 2026-10-21).**
`@uwmd/core` and the CLI host no agents: the runner, tool schemas, provider
seam, Anthropic adapter, record/replay cassettes, `AgentHostCapability`,
`uwmd run` and core's `agent-host` manifest claim are gone, with the
`@anthropic-ai/sdk` peer and the four starter checks that needed an agent run
An unknown command exits 1 before any I/O. The generic writers,
`buildContext` and `uwmd edit` attribution stay.

**Implemented RFC 0111 — verify under the declared rule set (owner acceptance 2026-10-21, including D4).**
[RFC 0111](../rfcs/0111-verify-under-declared-rule-set.md) is now Protocol
[§XII.5](../../spec/UW_PROTOCOL.md): a record's declared `uw_version` names the
rule set it is verified under (Format rules and §5.2 bands, verification
procedures, receipt rules, metric dictionary); retention and forward-only fixes
bind from 5.0.0, with stricter security and soundness fixes applying to every
kept rule set. `@uwmd/verify`'s `RULE_SETS` registry holds the one entry,
`"3.0"`, pointing at the existing bands, dictionary and builtin packs.
Validation, stated-metric verification and receipts select from it and refuse
an unkept declaration, also on a document model (`UNSUPPORTED_FORMAT_VERSION`).
`ValidationResult`, `StatedMetricsReport`, receipt verification and receipts
(`computation.rule_set`, required) name the rule set; a receipt naming another
fails with `RCP-13`. Each portable conformance case names its `format_version`
and `runner.py --format-version` selects by it. The Python validator reports
`rule_set` too. Open before a second rule set exists: a UW Lite record may omit
`uw_version` and is compiled as 3.0 (RFC 0081 D12).

**RFC 0112 implemented: the Bancroft layer vocabulary is gone (2026-10-22).**
The Format no longer names a producer tool (§1.2), maps layers to sections
(§1.3 deleted), carries frontmatter `pipeline_state` (a record that still has it
reads it as an unknown key) or "Written by" lines; eight prohibitions became
**Source rules** for any non-user source. Spec examples use neutral agent ids
under the unchanged `agent/<id>` source. §6.8's producer rules are §3.6, the
validation result is §5.6, and Parts VI and VII are the starter
[CLI](../starter/cli.md) and [renderer](../starter/rendering.md) references.
Module manifests refuse `agent_layers` as an unknown member (`PROTO-MOD-055`
to `-060` retired and reserved), and `agent-host` left the capability
vocabulary. Core drops the layer registry and its builders, `uwmd layers`,
`agents/L0b-prompt.md` and the layer-profile check (1,235 indexed checks,
starter products 101, 397 portable). Examples and fixtures drop
`pipeline_state` and take neutral agent ids.

**Python certified — Issue #354 (2026-10-21).** The independent Python
implementation's manifest claims the Reader tier plus `parse`, `calc-evaluate`
and `validate`; CI runs the portable Verifier-tier corpus on three OSes with
`--no-skip`, so every case, including all 144 validate cases, must pass. The #425
validate differences are closed, and `UWMD_SPEC_DIR` lets `validate` run outside
a checkout. Not the Verifier tier: POL-01/02, dictionary reproduction, the
stated-figure verifiers and receipts are not implemented in Python (Protocol
§II.2/§II.5). Divergences found while certifying were fixed or filed: #404, #405,
#406, #413 (fixed), #424 (spec-ambiguity, non-portable).

**Release rules after launch ratified (owner, 2026-10-21).**
[RELEASE_RULES](../playbooks/RELEASE_RULES.md) now records the owner's rulings:
one public number ("UWMD 5.x") while records keep their Format version,
result-changing fixes as minor releases, a monthly minor train, standing approval
for green patch releases, the deprecation window, code reservation and key
rotation. GOVERNANCE.md starts owner-led and switches to collaborative mode when
the first outside RFC or PR arrives. The verifier rule-set rule is accepted
RFC 0111 (Protocol §XII.5). The lender acceptance kit moves to a post-launch
5.x milestone.

**Implemented RFC0113 — paid room nights (owner acceptance 2026-10-21).**
[RFC0113](../rfcs/0113-paid-room-nights.md): `occupied_room_nights` is paid room
nights sold (USALI basis); optional `complimentary_room_nights` records the
excluded nights. No formula changes. Builtin controls 62/63; Python counts 63.

**uwmd.org is hosted on Cloudflare Workers (2026-10-21).** The owner moved the
site to the Worker `uwmd-org` after #391 merged and disconnected Vercel. The
repository's Vercel configuration (`vercel.json`, `scripts/vercel-ignore-build.sh`)
is removed; `tools/docs-site/README.md` describes the Cloudflare host and its
project settings.

**Implemented RFC0110 — the stored deal flag's `band` (owner acceptance 2026-10-21, D2 and D3).**
[RFC0110](../rfcs/0110-financial-validity-entry-band.md): a §4.17
`financial_validity[]` entry carries `band: "error" | "warning"` in place of
`severity`, `metric` includes `ltc`, and an entry that crosses no band is not
recorded. Spec and corpus only; nothing reads the section. Sixteen hand-written
sections held only `pass` entries and now store `[]`; every changed record's
stored flags equal a fresh validate's `deal_flags`.

**Stored validation sections regenerated (owner ruling 2026-10-21 evening).**
The six examples and fixtures that state a §4.17 `validation` section now store
what a fresh `uwmd validate` reports, not the renamed old run: `clean`, the deal
flags in `financial_validity[]` (`flag_id` the FV code, the band in `severity`
until RFC 0110), completeness from `DQ-04`/`DQ-06`, cross-section entries
from `CC-*` issues, and the thresholds used. `policy_flags` and
`human_review_items` are kept: validation does not produce them. Record 24 is
regenerated with its adjacent institution config; fixture 57, which the reader
refuses on purpose, takes fixture 02's section.

**Implemented RFC0108 — the §4.17 validation section's vocabulary (owner acceptance 2026-10-21, D2 and D3).**
[RFC0108](../rfcs/0108-validation-section-vocabulary.md): a stored `validation`
section now speaks the validation result's words: `overall_status`
`clean | warnings | errors | blocking`, `completeness[].severity`
`error | warning | info` (a halting item goes to `blocking_flags`), and
`required_for_stage` the seven `deal_stage` values (`underwriting` →
`full_underwrite`). Spec and corpus only; nothing reads the section. Six corpus
files rewritten (`warnings_only` → `warnings`, completeness `blocking` →
`error`) and the `02-full-multifamily` parse baseline follows.

**Implemented RFC0107 — the LTC band's homes and code (owner acceptance 2026-10-21, D2 adds `quick_metrics.ltc`, D3 every stated value).**
[RFC0107](../rfcs/0107-ltc-financial-validity-home.md): Format §5.2's LTC row
reads `quick_metrics.ltc` (new, beside `ltv`) and
`sources_uses.equity_metrics.loan_to_cost`, as `FV-15` (warning above 0.80, error
above 0.90), for every stated value whatever the loan purpose. It is a deal flag
like every FV code (RFC 0109) and can be escalated by institutions. Both
implementations; portable cases `documents/malformed/68`–`69`.

**Implemented RFC0109 — financial-validity findings are deal flags (owner acceptance 2026-10-21, D1 separate list, D3 per-code).**
[RFC0109](../rfcs/0109-financial-validity-deal-flags.md): `FV-NN` findings leave
`issues` for a new, always-present `ValidationResult.deal_flags` (`band`, no
`severity`). They never set `overall_status`, the exit status, stage readiness or
receipt counts, so a weak deal reads as a valid record. An institution config's
`validation_overrides.financial_validity_errors` (strictly admitted) raises a
listed code's error band to an `error` issue; its warning band stays a flag.
CLI, renders, MCP, web editor and VS Code show flags apart from issues. Python
matches. New portable cases `institution-config/30`–`33`; case 67 and the FV
baselines re-derived. Parkview (`02-full-multifamily`) now reads `clean`.

**Owner rulings 2026-10-21 on RFC0104 implemented.** Protocol §III.6a names the
RFC 0093–0096 pass order as the one normative exception to non-normative issue
order. Frontmatter-scoped issues carry `section: "frontmatter"` in both
implementations: the reference adds it to `LOC-01`, `CUR-01`,
`INVALID-ASSET-CLASS-*`, `MOD-DEPENDENCY-UNDECLARED` and the `quick_metrics` FV
homes (Python already did).

**Implemented RFC0105 — financial-validity homes (owner acceptance 2026-10-20, as drafted).**
[RFC0105](../rfcs/0105-financial-validity-homes.md): Format §5.2 now names the
code and the homes of each band. Both implementations read every
Format-defined home: `quick_metrics` and the section field for DSCR, LTV, debt
yield, cap rate and IRR; `noi_model` rate_applied and expense_ratio; `dcf`
revenue_growth_rate and equity_multiple. Each home draws one issue at its worst
band. The reference no longer reads `noi_model.vacancy_rate`,
`dcf.levered_equity_multiple` or `dcf.assumptions.annual_rent_growth`, and no
longer computes the OpEx ratio from totals. Python adds the frontmatter homes.
The LTC band still has no home or code. Portable case `documents/malformed/67`
(#428).

**Implemented RFC0104 — issue field paths (owner acceptance 2026-10-20, as drafted).**
[RFC0104](../rfcs/0104-issue-field-paths-and-order.md): Protocol §III.6a defines
`field` as the dotted path from the payload (or frontmatter) root, with array
elements by index, and makes issue order non-normative outside the metadata
and payload passes whose order it already fixes. The reference now names
`_meta` paths for `META_MISSING`, `META_FIELD_MISSING_*`,
`META_LOW_CONFIDENCE_NO_REVIEW_FLAG`, `SRC-01`–`03` and `DQ-01`–`03`; reports
`DQ-05` on the gaps item (`gaps`, `items[i].last_checked`); and addresses
capital-stack tranches by index in `CS-*` and `CC-03`, as Python now does too.
Portable case `documents/malformed/66` pins the spellings (#424).

**Implemented RFC0106 — refuse malformed block JSON (owner acceptance 2026-10-20, as drafted).**
[RFC0106](../rfcs/0106-malformed-block-json.md): Format §2.4 requires each
structured block body to be one I-JSON object, and Protocol §XI.2 registers
`SOURCE_BLOCK_MALFORMED` (`parse`). The reference no longer drops a block with
a syntax error, keeps the last of duplicate names, reads `1e999` as `Infinity`,
admits a lone surrogate, or crashes on a `null` root; Python now codes the
refusals it already made and adds the surrogate check. Superseded blocks are
refused too. Portable reader cases `documents/malformed/60`–`65` (#432).

**Implemented RFC0100 — refuse negative sizes (owner acceptance 2026-10-20, D2 = SIZE-01).**
[RFC0100](../rfcs/0100-nonnegative-sizes.md): Format §5.5's closed size contract
(`SIZE-01`, error) in TS and Python; per-size dictionary metrics are
`positive_size_denominator` (a negative size is unverifiable). The corpus measured
two existing documents that now also draw `SIZE-01` (MHC class fixtures 28/29,
negative and fractional `total_sites`); both keep their class findings.

**Implemented RFC0103 — four metric dictionary corrections (owner decisions 2026-10-20).**
[RFC0103](../rfcs/0103-metric-dictionary-corrections.md): USALI F&B gross margin
(no labor); data-center `mark_to_market` replaces `rent_index`; drawn power
(metered kWh, else an explicit `draw_factor`, measured PUE before design; zero
landlord cost under metered pass-through; null with no draw); stated booked
rooms revenue with the `CC-HOSP-05` 1% cross-check. Authorities are cited in the
metric dictionary README.

**Implemented RFC0099 — verify every stated home (owner acceptance 2026-10-20).**
[RFC0099](../rfcs/0099-verify-every-stated-home.md): the metric dictionary carries
a closed `statement_bindings` registry (output sections plus eleven aliases, the
former `conformance/metrics/statement-bindings.json`, now deleted). `uwmd verify`
and `verifyStatedMetrics` check every bound home, so a wrong
`valuation.going_in_cap_rate`, `price_per_sf` or sizing DSCR fails even when
`quick_metrics` is right (#416). `conformance/metrics/statement-homes/` proves
each alias. The Python implementation has no metric verifier yet, so it has
nothing to adopt.

**Implemented RFC0098 — capital point in time (owner acceptance 2026-10-19).**
[RFC0098](../rfcs/0098-capital-point-in-time.md): `capital_stack.point_in_time`
is required (`closing`|`stabilization`, `CS-04`); `debt_structure.point_in_time`
is optional, absent meaning outstanding at both points (`DS-01` for an unknown
value); `sources_uses` is the closing statement; `CC-03` selects one senior per
point and compares like-dated figures (coverage evidence keys
`debt_structure@<point>`). Corpus and example stacks state `stabilization`.
The TypeScript reference is complete; the Python validator update rides the
Issue354 WIP, which is not on main. Other senior-preferring checks keep their
single selection (RFC0098 Unresolved questions).

**Reader canonical block — Issue #404.** The last non-superseded block of a
section (or variant key) is canonical, per Format §2.7; the overwritten block
stays retained under `superseded`.

**Reader variant routing — Issue #395.** Actual block shape distinguishes a
single block from a map of lawful variant labels. Current peers named
`annotation`, `content` or a prototype member retain exact selection and history;
parser routing consults own keys only. Envelope, receipt/document-signature
subject construction and existing consumers use the same shape distinction.
Synthetic controls cover both source orders, current/history accounting, parts,
role-opted sections, malformed blocks, source bytes and real signature tampering.
This corrects existing Format2.8/RFC0040/0066 behavior; it changes no schema,
Envelope representation, financial procedure, receipt rule or capability claim.
Issue365/RFC0089's extension representation remains separate.

**Accepted RFC0097 — owner decision2026-10-19 at4a31eb3c.**
[RFC0097](../rfcs/0097-institution-config-refusal.md) allocates two typed
validate-operation errors for unreadable/malformed selected configuration,
error-only JSON/exit1, atomic admission of the three documented overrides and
automatic-absence defaults. Exact lexical selection, strict JSON/Unicode profile,
opaque data and config-relative pointer authority are accepted. The synchronized implementation provides the strict file adapter and CLI
transport, public canonical wire type, minimum schema and Format/Protocol/pointer
rules. The independent private Python helper is main-safe; full validation CLI
wiring remains in Issue354's unadvertised WIP. Twenty-nine paired source/config
controls supplement the unchanged111 original portable validation cases. Pure API
threshold maps and receipt identity/count/authentication rules remain separate;
no new financial threshold/comparison is introduced. Discovery stays parse-only
until complete validation and applicable native/platform requirements certify.

**Accepted RFC0096 — owner decision2026-10-19 at1926efe4.**
[RFC0096](../rfcs/0096-bounded-stated-payload-admission.md) allocates closed
LU-05/REC-11/CS-03/WF-16 validation-only errors. The owner accepted all six
reviewed dispositions: current canonical/all current variants under assembled
model authority, no physical-history expansion, LU-05 target grammar only,
unchanged recovery null qualification, existing lexical-only waterfall dates,
and untouched financial selector/result rules. Thirty bounded observations
and four actual CLI partial refusals remain evidence with their stated limits.
The synchronized implementation adds the four closed TypeScript predicates,
independent private Python admission helper, Format/Protocol/schema/remediation
and eight authored native conformance controls. The six document controls pin37
ordered new-code findings, including lawful and current-peer cases; two recovery
controls distinguish missing prototype-named references from actual own variants.
The only prior expectation change is two REC-02 findings becoming one for a
member without a method, as the accepted presence table requires; its source is
unchanged. Structural recovery own-member corrections preserve financial
expressions, selectors and result rules. Python's complete-validation integration
remains on Issue354; the main helper adds no command, and discovery remains
parse-only until complete capability certification. Dictionary/financial/receipt
obligations remain separate.

**Accepted RFC0095 — owner decision2026-10-18 atc551e956.**
[RFC0095](../rfcs/0095-optional-metadata-and-provenance-references.md) accepts
META-05/06/error with META-01–04 and absence warnings unchanged. DQ-06/info
remains stage readiness only; symmetric canonical/any-stated-override reference
assertions belong to META-06 with exact identity/carrier dedup. The as_of domain
is whole ASCII Gregorian YYYY-MM-DD, years0001–9999, without normalization.
The reviewed89-reference inventory is frozen as the activation baseline, with
its population limits preserved. Synchronized TS/Python source predicates,
Format/Protocol/registry/schema and six authored native controls implement the
accepted allocation. Complete META-05 and META-06 passes follow META-04;
malformed-parent/sibling boundaries and current physical/model authority remain
explicit. Independent frozen calendar vectors exercise both runtimes. A bounded
SRC override correction uses only the existing sections/current-variant population.
The separate complete-validation WIP still requires composition, full admission,
applicable native/platform evidence and actual certification. Discovery remains
parse-only; receipt subject/authentication rules and release state are unchanged.

**uwmd.org refresh — owner direction C,2026-10-18.** The approved refresh
leads with document versions, identifies normative versus guide/starter/project
pages, keeps the current starter host described accurately and applies the
approved public-identity/copy sweep. The contrast prerequisite merged as
`fa9a9ea37d31b918f5993eae4276b159f31719f3`; its main CI is recorded separately.
The remaining refresh belongs with the Cloudflare migration, not an independent
site cutover. No normative text removal, accepted RFC change, package version,
release, tag or publication is authorized by this presentation work.

**Python expression execution — Issue354.** A coherent read-only `calc` CLI
implements the accepted expression grammar, all21 builtins, exact source/variant/
role/period selection, scalar/null overrides and quantized result/refusal transport.
Its independent Python pinned procedure uses embedded constants and no experiment
runtime imports. Actual unchanged110-case portable calculations, source-preserving
CLI controls and numerical/reporting boundaries are checked separately from the
Reader projections. The existing three-platform Python CI jobs retain actual
calc evidence. Discovery stays parse-only; complete validation, dictionary/stated-
result verification and receipts remain required before a Verifier claim. No
normative arithmetic, schema, conformance expectation or version changes.

**Accepted RFC0094 — owner decision2026-10-18 at47e6a547.**
[RFC0094](../rfcs/0094-present-invalid-metadata-leaves.md) accepts META-04/error
for exactly present-invalid confidence, revision and timestamp. Absence warnings
and META-01/02/03 remain unchanged; conditional provenance references stay separate.
The independently verified main0450 inventory has174 candidate leaves in78 files:
166 confidence=`verified` values in scoped reserve fixtures and8 timestamp markers
in normalized editor AFTER templates. Those are not174 demonstrated live validation
failures or automatic expectation edits. The owner selected T1B, exact uppercase UTC-Z
with Gregorian validity and second00–59. Schema-library permissiveness does not define this contract.
Synchronized TS/Python implementation applies the exact accepted closed predicates
and ordered physical/model pass, with Format/Protocol/registry/schema and authored
conformance controls. Existing absence warnings and subject/receipt precedence stay
unchanged. Python discovery stays parse-only while complete-validation gates close.

**Accepted RFC0093 — owner decision2026-10-18 at0306d126.**
[RFC0093](../rfcs/0093-metadata-shape-diagnostics.md) accepts exactly the three
META-01 additions: late/misplaced canonical `_meta`, present invalid/mismatched
canonical `_meta.section`, and absent/nonobject required `_meta.quality`.
All-retained-physical applicability, separate shape pass before actors/booleans,
exact source/model order boundaries and Lite's existing compilation path are
accepted unchanged. Already allocated absences and META-02/03 remain unchanged.
PR384 records docs-only acceptance. The synchronized Issue354 implementation
adds TypeScript/Python predicates and exact source/model admission, including
composed root/part physical accounting; Format/Protocol, remediation and schema
annotations agree. Four authored native controls pin exact metadata issue order;
existing source fixtures and expectations are unchanged. Python discovery remains
parse-only; complete validation and Verifier certification remain separate gates.
Exact-final-head integration CI is required before this implementation merges.

Strict invalid-Unicode rejection in #373 merged as `765e2c4b6e2caf532f13d06c94234615932b47c7`; [exact-main CI38999614992](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/38999614992) is the integration evidence, separate from reviewed-head CI38995962876. Historical bytes and signing evidence remain preserved; no fallback or retrospective authentication claim.

**Accepted RFC0088 — owner decision2026-10-18.** Architecture A is accepted:
one exact pinned fdlibm pow/exp/log procedure for all exponent classes. All20
production numerical sites use the same public pinnedPow/pinnedExp/pinnedLog
bindings; financial graphs, quantizer and IRR/XIRR solver remain unchanged.
Supplied receipt signatures authenticate before computation and refusal, after
existing source/subject/dependency preflights. Normative Protocol/Receipt text,
schema annotations and current conformance synchronize in #357. Final-head and
exact-main integration CI remain separate gates; no release is authorized.

The owner accepts the spreadsheet study's findings as export-contract limits.
Native recalculation may differ beyond about eleven significant digits and may
error on subnormals/overflow. UWMD verifies the stated record, never spreadsheet
recomputation. LibreOffice24.2.7.2 completed all10 controls/change-restore;
13cells agree at comparison precision,1differs and6are #NUM!. Browser/raw kernel,
independent Python/composed and current-corpus evidence remain scoped proofs.
Python #354 implementation resumes after integration. RFC0089/#368 and RFC0085/
#335 remain separate drafts;0092 U3-U7 and pending metric decisions stay with the
owner. No model-generation expansion, metric fix, version, tag or publication.

**Actor reconciliation — accepted RFC0090.**
[RFC0090](../rfcs/0090-provenance-actor-admission.md) records the owner's
accepted Issue354 contract: required nonempty-string actors, narrow META-01/error,
all retained physical blocks, existing shape precedence and explicit mutable-model
authority. Its synchronized validators and governed expectations preserve original
sources, historical expectations and authenticated artifacts. The schema/type
already require actor and remain unchanged. META-01 remediation covers both the
bare/nested shape and nonempty actor. Final integration requires exact-head CI
and subsequent exact-main CI; no release version is allocated. Python discovery
remains parse-only. RFCs0085/0089 remain separately draft;0088 is accepted.

**Python diagnostic reconciliation — accepted RFC0091, unreleased.**
[RFC0091](../rfcs/0091-required-metadata-booleans.md) records the owner's
2026-10-17 acceptance of the bounded META-02/03 contract and six new-kit review
declarations. It separates the nine native partial refusals into existing
REC/container admissions and two required canonical boolean diagnostics.
Independent evidence preserves943 absences in205 original conformance sources,
unchanged111 portable responses, five historical native sensitivity differences
and their governed dispositions. TS/Python predicates preserve META-01,
container/actor precedence, physical/history scope, mutable-model authority and
issue ordering. Incomplete admitted canonical metadata, including history, now
receives errors; validation exits and newly issued receipt policy counts may
change. Sources and historical subjects are never repaired or rewritten.
The former2,731-artifact retention gate is retired by the owner rule above. Exact-head CI and
subsequent exact-main CI are integration gates; no release/version is allocated.
Complete Python validation remains separately gated, with parse-only discovery.
RFC0085/0089 remain draft;0088 is accepted under the2026-10-18 owner decision.

**RFC0048 kit disposition — owner option(a), accepted declarations.** New positive
examples under examples/standalone/authored-2026-10-17 carry explicit authored
block declarations/reasons, new provenance/identities and a new package. Original
records/ZIP remain metadata-incomplete historical examples with unchanged bytes;
positive, composition and fidelity assertions are preserved. StackUW's audited
Format3 adapter emits both flags but defaults each to false; writers must choose
intentional review/lifecycle declarations, not infer missing historical values.
RFC0091's prelaunch version recommendation, writer migration note and artifact
retention obligations are withdrawn under the owner rule above; diagnostic
predicates and current verification requirements are unchanged.

**Python priority — minimum-complete capabilities.** The current implementation
has no Reader/Verifier tier and advertises only parse. The completion matrix in
the Python README now maps accepted obligations, implemented scope, exact corpus
ownership, dependencies and whole-capability exit gates. Next engineering is one
complete `validate` surface, followed by metric/calculation-method closure,
remaining stated-figure verification and receipt verification. More isolated
inspectors do not close those obligations. Current dictionary arithmetic can
advance independently of RFC0088; source identity/lifecycle, key admission and
published metadata severities are preserved by ordinary precedent; their prose
omission is a documentation gap, not an owner blocker.

The prior currency checkpoint #371 merged as
`fbf8f66aa00fa2ca50dbf4dd7d006d3b3a3b53b1`, identical to reviewedf3b3ee47.
Exact-head [CI38984264689](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/38984264689)
passes17 ordinary jobs; Ubuntu/Windows/macOS each demonstrate151methods and
Reader17/17. [Exact-main CI38985670740](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/38985670740)
is tracked separately. No complete-tier claim follows. A focused correction
keeps absent metadata outside the registered present-malformed META-01 domain
without adding completeness findings outside the partial inventory; twelve focused
methods pass.

The bounded Python Reader lifecycle correction shares source-history routing
with existing verification: exact fence `superseded=true` or JSON lifecycle true
excludes a block from current selection and role opt-in, retaining it in ordered
history. It does not rewrite metadata, source bytes, digests or receipt rules,
resolve RFC0089 identity questions, or promote discovery beyond parse.

**Bounded Python source-admission correction.** The Reader admits sequence
mapping entries such as Format §2.2a's `modules` objects, including continuation
members and unknown-key lists. Numeric spellings/pointers/byte spans and input
bytes remain unchanged; duplicate keys, deeper mappings and unsupported YAML
features still refuse. This extracts a reviewed prerequisite from the larger
complete-validation WIP without advertising validate or a Reader/Verifier tier.
The existing three-platform Python jobs exercise the correction and actual
portable Reader cases. It does not load modules or activate a draft contract.

## Bounded parallel workstreams

One integrator owns sequencing, independent review, shared indexes/changelog/
status/spec files, remote publication and merges. Three workers own disjoint
implementation or research files and use separate worktrees/remote branches.
Focused local checks precede full exact-head CI at integration checkpoints.

| Lane | Remote branch | Scope and gate |
|---|---|---|
| A Python verification | `codex/python-complete-validation` | Minimum-complete capability gates; completevalidate next, then dictionary/stated figures and receipts. Parse-only until complete obligations are demonstrated. |
| B numerical determinism | `codex/numerical-determinism-356` / #357 | DraftRFC0088, existing numerical study and isolated experiments; no production arithmetic, expected-result or acceptance changes. |
| C Envelope | `codex/rfc-0089-extension-envelope` / #368 | DraftRFC0089, the existing365review section and illustrative evidence; no Envelope1/schema/digest/receipt change before owner approval. |

RFC0085/#335 remains coordinated without a fourth worker. Provisional direction
is not design acceptance. Independent versioning and the public5.0 launch
reservation remain unchanged; StackUW owns generation, agents and workflows.

**Latest Python milestone — replacement funding merged; bounded block integrity.**
PR #367 merged as `fbbd1a7704f5c7df20e633e9123273b7dcc4ac43`, with the
reviewed §V.12 replacement verifier, 119 Python controls, 71 explicitly adapted
standalone comparisons and separate Reader17/17. Exact-main CI
[38980859508](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/38980859508)
succeeded: all 17 ordinary checks passed; optional publication verification
skipped. Ubuntu, Windows and macOS jobs passed 119 Python methods and genuine
Reader17/17 with zero failures, skips or unverifiable cases.

The bounded continuation adds accepted §V.9 hashes and supported §V.10 sequence
assessment, preserving all physical blocks and explicit unchecked signatures.
Its 132-method suite retains the earlier controls and adds 11 frozen hash-only
standalone comparisons. Historical identity ambiguity stays locally unsupported;
no new missing-history/root refusal or full integrity-profile claim is added.
Discovery remains parse-only; generic verify/validate/calc stay unsupported.
The work is independent of Envelope #365 and draft numerical RFC0088.
#357/#335 remain drafts; owner-controlled decisions remain preserved. Older
checkpoint statements below describe their stated historical heads.


**Earlier Python checkpoint — reserve draws merged; replacement-funding bindings.**
PR #366 merged as `64b9b109abd1d0851087f31c49f07409b5433142`, with the
reviewed §VIII.12 verifier, 103 Python controls, direct reserve28/draw46 evidence
and separately reported Reader17/17. Exact-main CI
[38929022272](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/38929022272)
succeeded: all 17 ordinary checks passed; optional publication verification
skipped. The three operating-system jobs passed 103 Python methods and genuine
Reader17/17 with zero failures, skips or unverifiable cases.

The bounded continuation implements accepted §V.12 replacement commitments:
relevant structural prerequisites and a separately recomputed exact result,
without full validation, expression evaluation, pricing or tier claims. Its
119-method suite preserves earlier controls and adds 71 explicitly adapted
standalone comparisons against frozen expectations. The catalogue's validate
capability remains unsupported and discovery stays parse-only. The selected
cash-vector digest is independent of whole-Envelope shape;
[Issue #365](https://github.com/UWMD-OSP/UW-Markdown/issues/365) remains separate.
#357/#335 stay drafts; owner-controlled decisions remain unchanged. Older
checkpoint statements below describe their stated historical heads.


**Earlier Python checkpoint — reserve accounts merged; reserve-draw bindings.**
PR #364 merged as `b733127df50962469b7f08936ae2bd6de3e46747`, with the
reviewed standalone §VIII.11 reserve verifier, independent Envelope/JCS digest
prerequisite, 91 Python controls, 28 direct shared reserve cases and separately
reported Reader 17/17. Exact-main CI
[38924242203](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/38924242203)
succeeded: all 17 ordinary checks passed; optional publication verification
skipped.

The bounded continuation implements accepted §VIII.12 reserve-draw bindings:
exact nullable source identities, selected-variant full reserve checks, closed
CF/lease-up structural sources and ordered allocations at the existing quantum.
Its 103-method suite retains all prior controls and adds the 46 unchanged direct
shared binding cases. Discovery stays parse-only; no expression evaluator, full
validation, tier, receipt or authentication claim is added. The prerequisite
fence-only superseded-history projection fix preserves source content and the
existing Reader projection. [Issue #365](https://github.com/UWMD-OSP/UW-Markdown/issues/365)
separately tracks the unresolved extension-map/Envelope shape boundary. #357 and
#335 remain drafts, with all owner-controlled decisions preserved. Older
checkpoint statements below describe their stated historical heads.


**2026-10-15 — independent Python foundation merged; narrow reserve verification.**
PR #358 merged as `24ae8f49664a9291f097bd5bebba1c41990c3e66`. Exact-main
CI [38862722485](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/38862722485)
succeeded: 17 ordinary checks passed; optional publication verification skipped.
The merged foundation preserves 74 Python controls and actual portable Reader
17/17 on three operating systems, with a parse-only manifest and no tier claim.
PRs #357 (numerical determinism) and #335 remain drafts; owner decisions remain
unchanged. Earlier handoff/recovery notes below are historical checkpoints.

The next narrow Python implementation adds standalone reserve-account structure,
ordered balance/explicit continuity checks and an independent complete-envelope
digest prerequisite under accepted §VIII.11. Its direct 28-case shared-driver
evidence is separate from capability/tier certification; no full validation,
expression evaluator, receipt or authentication is claimed. The Reader's
role-opted extension variant map versus Envelope 1.0's single extension block
remains an explicit digest_unavailable boundary, not a new representation rule.


## Integration queue reconciliation — 2026-10-15 (America/Phoenix)

Prepared against integration base **`bac58c25f15f90bc9c97402a86cad9b8f4c50d55`**,
after the two completed integrations below. Current PR heads and their exact CI
runs remain authoritative after further rebases; the older session sections below
are historical evidence. Published 4.3.0, Format 3.0, Protocol 4.1.0 and receipt
1.1 remain unchanged. No release preparation, normative expectation change or
RFC acceptance is implied by this queue cleanup.

- **Parser [#362](https://github.com/UWMD-OSP/UW-Markdown/pull/362), merged
  `9aa26bf9b00248cd49d4bbfa39b30ea818d8971d`.** Reviewed head
  `0b4e7767d400b22996631901b30aa1c6b4805b54` passes all 14 ordinary CI jobs in
  [38853895243](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/38853895243).
  Fresh Windows build, all 4,203 workspace tests, test typecheck and official
  1,089 reference checks pass, with zero updated expectations. Existing
  Appendix D scalar meaning already requires decoded string-key identity;
  bare typed-key policy remains separate. Decoded duplicate/unsafe names refuse.
  Final real-Ed25519 and receipt controls verify equivalent plain/quoted keys.
  Historically misdecoded subjects refuse INT-11/RCP-01 under existing rules,
  before any signature fallback. Source bytes and old artifacts are not rewritten.
  Publication engine/pin/version decisions remain separately governed.
- **Architecture [#361](https://github.com/UWMD-OSP/UW-Markdown/pull/361), merged
  `bac58c25f15f90bc9c97402a86cad9b8f4c50d55`.** Rebased reviewed head
  `f25eaec17e0ae2698d8f27d1573cec3c2115fec0` passes all 14 ordinary CI jobs in
  [38855904488](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/38855904488).
  Proposal blobs are unchanged. Only the two existing planning/evidence documents
  and their changelog entry are integrated. No public export, runtime, SDK,
  skill/workflow asset, URL, compatibility policy or activation is removed or
  approved. RFC, normative text, conformance and version states are unchanged.
- **Independent Python [#358](https://github.com/UWMD-OSP/UW-Markdown/pull/358).**
  The published `ef1c5a72` foundation has 59 methods and genuine portable Reader
  17/17 with zero skips, including three-OS CI 38854398177. The bounded continuation
  adds grammar/AST and syntax-only reference evidence without expression evaluation.
  Complete Format validation, runtime resolution, financial verification and
  receipts remain unfinished; the manifest remains parse-only with no tier claim.
  Final reviewed continuation heads and CI belong on the PR, not in old pass counts.
- **[RFC 0088 / #357](https://github.com/UWMD-OSP/UW-Markdown/pull/357) and
  [RFC 0085 / #335](https://github.com/UWMD-OSP/UW-Markdown/pull/335) stay draft.**
  The former's pinned candidate helper/resource study and isolated JS/Python bit
  adapters select no production financial kernel. The latter's projection/archive
  proposal is not accepted. Rebase these lanes after integrations; once #358 lands,
  remove only already-landed Python seed/CI deltas from #357 while retaining all
  newer Reader controls and CI. Exact procedures, financial conventions,
  compatibility, activation, versions and RFC acceptance remain owner decisions.

### Durable recovery and CI evidence

Both remote recovery refs were rechecked through GitHub and still point to their
original immutable commits:

| Recovery branch | Preserved commit |
| --- | --- |
| `experimental/recovery-python-354-2026-10-15` | `790b2c7a4ad8676f2bb8ab87e7ebe16f2af6c1d1` |
| `experimental/recovery-designs-2026-10-15` | `65b164b1c72d4d4fe4f14ee02f30b5ce1b9fc5a9` |

The [54-file disposition record](../reviews/2026-10-15-recovery-disposition.json)
is preserved byte-for-byte, including original recovery readback/manifests and
all limits on historical evidence. No recovery branch or archived patch is
merged. Only missing period/grammar concepts were selectively reviewed against
accepted Protocol text and adapted around the active Python Reader; the old
Reader, calendar dependency, evaluator and superseded model-generation proposal
remain recovery research. Original source/Reader/seed controls are retained.

The previous #363 head `6c682663` passed 14 ordinary jobs in CI 38854600106.
Its Vercel preview failed at the project deployment rate limit; GitHub branch
protection/rulesets and `gh pr checks --required` reported no required preview
gate. The refreshed handoff needs its own current-head ordinary CI; its PR
records that exact outcome. Rate-limited previews are reported separately, with
no status rewrite, account change, paid-plan action or admin bypass. Explicit
publication observation is skipped in ordinary development and never counted as
a pass. Failed historical Linux runs below remain failed; new Windows and CI
passes do not erase them. No independent spreadsheet or full Python Verifier
conformance is claimed.

UWMD stays lean and verifier-focused. StackUW/adopters own model generation,
AI agents, skills and workflows. The owner's current session authorizes the
bounded parser, planning-document and durable-handoff integrations; it authorizes
no proposed numerical contract, product retirement, release or publication.

---

## Session handoff — 2026-10-15 (America/Phoenix)

Canonical GitHub `main` is `50bf4c13206560848c5bb9b045f4532ad3cd8633`
(merged #359); its CI 38846578128 passed all 14 ordinary jobs. No PR was
merged during this closeout. All tracked workstream PRs remain drafts. The local owner
checkout is on an older RFC 0085 branch, and the cached `/tmp` checkout's
`main` still points at the published release; neither is canonical main.
Fetch GitHub before resuming. Published 4.3.0 and its independent verification
remain recorded below and in the publication record.

| Lane / PR | GitHub branch | Exact current head | Latest CI at closeout |
| --- | --- | --- | --- |
| Numerical #357 / RFC 0088 | `codex/numerical-determinism-356` | `32aed4629dcbacd2dffaae1453cfa5d843a9ff66` | 38848963510: success, 17 ordinary jobs |
| Python #358 / Issue #354 | `codex/python-source-354` | `b079923ab765a75852b7751b2cd45deecc9bb19e` | 38850234668: success, 17 ordinary jobs |
| Architecture #361 / Issue #355 | `codex/agent-retirement-scope` | `65539e24d5e70ba7c23d57ba022fc77d5d2d0081` | 38848268602: success, 14 ordinary jobs |
| Quoted-key correction #362 | `codex/quoted-frontmatter-key-fidelity` | `588107a5c14ff40ddb146e62dcbeccdd76349e3f` | 38850699635: success, 14 ordinary jobs |
| Provenance #335 / RFC 0085 | `claude/rfc-0085-compaction-provenance` | `ce8ae0100a28b9fe82612a651afce1f8c041d425` | Previously verified 38831751616: success, 14 ordinary jobs |

The opt-in publication-observation job is skipped in ordinary PR runs; it is
not counted as a pass. Recheck exact heads and CI before integrating anything.
The four current lanes target main directly. #358 is no longer stacked on #357.

### Completed evidence and next bounded steps

- **Python:** 44 unit methods and genuine 17/17 portable Reader cases pass on
  Ubuntu, Windows and macOS, with no skipped/failed/unverifiable cases. Nine
  additional frozen Reader refusal fixtures are unit coverage, not extra
  portable passes. Manifest remains parse-only, without a tier or Verifier
  claim. Source-scanner input counts are not conformance results. Bare
  numeric/boolean/null YAML-key projection remains unresolved. Continue Reader
  completeness independently of numerical semantics. Review #358 for ordinary
  integration; after it lands, reconcile #357 to remove already-landed Python
  seed/CI changes while preserving the newer Reader CI, README and every test.
- **Numerical:** reproduced cross-runtime evidence and architectural choices
  are preserved. RFC 0088 is direction-ready, not yet a fully specified,
  acceptance-ready numerical contract. Next research must pin one procedure,
  constants/helpers/bit semantics, admitted domains and resource behavior,
  financial operation graphs, independently derived vectors, accuracy/range
  evidence and receipt/consumer compatibility before acceptance. Experimental
  work must remain outside production evaluators and normative expectations.
- **Architecture:** exact proposed future export, CLI, SDK, documentation and
  workflow-asset retirement scope is in the existing
  [removal proposal](../reviews/2026-10-15-agent-removal-5.0.md) on #361.
  Preserve generic editing/context, neutral provenance, bindings and developer
  instructions. No automatic StackUW migration or public deletion under 4.x.
- **Quoted keys:** #362 fixes demonstrated string-key misdecoding and signing
  source-accounting paths, with sequence-literal regressions. Local verifier
  tests pass 2,623/2,623 and direct reference checks 1,089/1,089 with no baseline
  updates. Wait for current-head CI, then review separately. Corrected semantic
  signing subjects may differ for historically misdecoded records; future
  release work must assess verifier identity/pins and historical compatibility.
  This is not permission to rewrite signatures, receipts or baselines.

Local full-suite results remain **failed**, separately from remote CI: Python
foundation 3,999 passed / 180 failed; quoted-key correction 4,023 passed / 180
failed. Subprocess-dependent wrapper/profile/release/package failures remain
recorded; direct reference-runner success does not turn those gates green.
No independent Microsoft Excel recalculation or full Python Verifier is claimed.

### Remaining owner-controlled decisions

RFC 0088 requires direction on an exactly specified portable procedure versus
universally correctly rounded primitives, whether stability rearrangements are
separate, and numerical-contract/engine versioning with existing receipt wire
subjects versus a new selector. Recommended directions are portable procedure,
separate rearrangements and existing wire subjects, subject to concrete evidence.
No kernel, domain restriction, activation or RFC acceptance is approved.

The architecture proposal requires approval of the exact removal set, governed
producer/writer boundary, retired-command refusal behavior, asset/URL transition
policy and eventual activation. RFCs 0085–0088 remain drafts; 0086/0087 financial
authority/basis/precision decisions remain separate. Issue #343 stays open.
#349 was owner-approved and merged as `a18ed8ee7f502e2bd538c3c96be1584f94c458b9`;
the older statement below that it is held is historical.

### GitHub-complete cross-machine recovery and worker shutdown

All completed lane contents are on the GitHub heads above. Local worker commits
have different Git metadata but identical complete trees: numerical `b2d721be`,
Python `3cbb2562`, architecture `c8ee8964`, quoted-key fix `5e892911`.
No worker remains running; no local test/build process was intentionally left.

The owner uses two separate Linux machines. The earlier manual-transfer
requirement is withdrawn: useful unpublished work is now recoverable from the
canonical GitHub repository on two **experimental recovery branches**, with no
changes to #335/#357/#358/#361/#362. No manual backup transfer is required.

| Recovery scope | Remote branch | Immutable recovery commit |
| --- | --- | --- |
| Earlier Python period/structural/expression prototype, tests and historical evidence | `experimental/recovery-python-354-2026-10-15` | `790b2c7a4ad8676f2bb8ab87e7ebe16f2af6c1d1` |
| Unpublished RFC 0085 C+D expansion/probe and superseded projection research | `experimental/recovery-designs-2026-10-15` | `65b164b1c72d4d4fe4f14ee02f30b5ce1b9fc5a9` |

Both branches start at canonical main `50bf4c13` and add material only under
`experiments/recovery-2026-10-15/`, outside active implementation, RFC-index and
conformance paths. Their README files label every claim unfinished/unreviewed.
Each includes `RECOVERY-MANIFEST.json` with payload SHA-256 hashes. They are
recovery references, not implementation PRs to merge.

- **Python:** reuse period/expression research selectively; the older Reader
  must not replace #358's byte-preserving Reader. Preserve its historical
  limitations and blocked numerical semantics. Its old numeric dependency has
  known year-zero/host-date limitations; no correction is implied by archiving.
- **Provenance:** the complete unpublished expansion and synthetic reader probe
  are preserved separately from canonical draft #335. No proposed result state,
  compaction behavior, archive or signature policy is accepted.
- **Superseded planning:** the old acquisition-engine proposal and associated
  documentation patch are historical design input only. Its former RFC 0088
  assignment is invalid; #357 owns that number. Current owner direction keeps
  model generation with adopters and Issue #355 bounded to financial assurance.

The [recovery disposition evidence](../reviews/2026-10-15-recovery-disposition.json)
accounts for all 54 archived source/research files, including duplicates and
superseded work. The duplicate source scanner/tests are already byte-identical
on #358. The nested patch-check tree, TAP renderings, obsolete announcements and
redundant full snapshots add no unique development work. Six old documentation
edits reconstruct byte-for-byte from their GitHub base plus the retained text
patch; that patch is not to be applied to an active branch.

Verification: all **27 recovery files** were independently read back from GitHub
at the exact commits above, compared byte-for-byte and recovered into an empty
directory. All **25 payload SHA-256 hashes** match both manifests. Two duplicate
scanner files were also read back from #358 and matched. The older Python
snapshot passes its 24 historical unit tests and 17/17 portable Reader cases in
a disposable checkout; this does not strengthen its capability claims. Shell
`git ls-remote` failed DNS resolution, so no successful shell clone is claimed;
the remote refs, Git trees and every recovery file were verified through the
GitHub API. A normal network-enabled clone/fetch needs no laptop files.

The selected files contain code, public-fixture-based synthetic evidence and
design prose. Review and secret-pattern scanning found no credentials or private
deal material. No private repository was required. Git bundles, caches, local
inventory files and 392 routine logs were not uploaded. Their local copies may
be discarded after recovery verification; exact local intermediate commit
metadata and raw logs are intentionally not preserved as a cross-machine
dependency. Local original worktrees remain untouched, not deleted.

On the other Linux machine, clone/fetch the canonical repository and read this
handoff from `origin/codex/session-closeout-2026-10-15` until #363 is integrated:

```sh
git fetch origin
git show origin/codex/session-closeout-2026-10-15:docs/wiki/13-status.md
git show origin/experimental/recovery-python-354-2026-10-15:experiments/recovery-2026-10-15/python-354/README.md
git show origin/experimental/recovery-designs-2026-10-15:experiments/recovery-2026-10-15/README.md
```

Use separate worktrees for any selective continuation; never reset current PR
branches to these archival snapshots. Recheck live heads and CI. Keep one
serialized integrator. No RFC acceptance, normative
arithmetic/conformance change, release-version change, publication or 5.0 launch
preparation is authorized by this handoff.

---

**2026-10-15 — interim4.3.0 published and independently checked.**
Annotated `v4.3.0` (object `1aba40faeff4553fa957355c5c0bd205f55be40f`) targets
#351 merge `80c68c3d0950948c85a1d3a90c02cd05f3a650a4`. Release38821844153
published all8 packages: core/CLI 4.3.0, verify0.2.1, signing0.6.0, batch0.9.2,
Excel0.9.19, report0.9.0 and lake0.3.2, with independent semver/exact pins.
Verification38822782450 checks registry/latest/gitHead, all tarball hashes,
signatures/provenance, fresh consumers, strict types/public APIs and the actual
published CLI350/350. Receipts name verify0.2.1. Two early registry-visibility
failures remain recorded; the later probe passes. See the
[publication record](../releases/4.3.0-publication.md).

Financial corrections #347 and #348, Phase2 evidence/regressions #350 and the
#346 CLI compatibility behavior ship. Format 3.0, Protocol 4.1.0, receipt1.1,
metric formulas, schemas and numerical conformance expectations are unchanged.
Local full-suite3993/180 and subprocess failures remain separate from successful
remote CI; no independent spreadsheet recalculation is claimed.

5.0 stays reserved for the coordinated public launch; no production deployment
or account change occurred. PR349 remains held and RFC0085/0086/0087 remain
drafts. Issue343 stays open for substantive decisions. The Phase2 review and
roadmap track the next bounded sequence. Earlier release records below are
historical.

Reconciled **2026-10-14** (America/Phoenix) for published and independently
verified **4.2.0**. `@uwmd/verify` **0.2.0**, core/CLI **4.2.0**, signing
**0.5.0**, batch **0.9.1**, Excel **0.9.18**, report **0.8.30** and lake
**0.3.1** are published from annotated `v4.2.0` on
`238dbf35a8654e2f8394088b9c3982159b11af8f`. They pair with Stable Protocol
**4.1.0** and Format **3.0**. Protocol 4.1.0 carries RFC 0084, now
`implemented`: an optional detached document snapshot signature over
the `uw-envelope-semantic` digest (§V.13) with the Integrity capability
`document-signature-verification`, codes `INT-09`–`INT-15`, a guarded
source-block accounting that refuses ambiguous or lossy sources, the
`conformance/document-signatures/` suite (15 scenarios, 14 portable cases)
and the CLI's `sign-document` and `verify --document-signature`. Block
signatures keep their six-field input and remain independent attribution. The
generation also carries the #322 canonical-encoding refusal, `uwmd init`'s
overwrite refusal and a browser-loadable `@uwmd/signing`. **`@uwmd/verify`
0.2.0** is the engine every receipt names: the two issuance baselines and the
three `failed` verification receipts move with it; 1,087 reference checks and
350 portable cases otherwise stand, and the lender fixture stays 187/0/0.
Signing **0.5.0** pins verify 0.2.0 and core 4.2.0, batch **0.9.1** and lake
**0.3.1** pin verify 0.2.0, Excel **0.9.18** and report **0.8.30** pin core
4.2.0, and core's optional signing peer is 0.5.0. The workflow publishes eight
packages, `@uwmd/verify` first, through the trusted publishers already bound
for 4.1.0 ([release run 38663508062](https://github.com/UWMD-OSP/UW-Markdown/actions/runs/38663508062)).
The registry-installed CLI passes 350/350 portable cases with no skips and
authenticates the document-signature fixtures; the published `@uwmd/verify`,
installed alone, resolves and checks signing subjects; all 672 published
files equal a local pack of the tagged source. PR #328 (closed CLI flag
vocabulary) merged to `main` after the preparation and is not in 4.2.0. See
the [publication evidence](../releases/4.2.0-publication.md) and the
independent
[verification review](../reviews/2026-10-14-rfc-0084-release-hardening.md).

Reconciled **2026-10-13** (America/Phoenix) for published and independently
verified **4.1.0**. `@uwmd/verify` **0.1.0**, core/CLI **4.1.0**, signing
**0.4.0**, batch **0.9.0**, Excel **0.9.17**, report **0.8.29** and lake
**0.3.0** are published from annotated `v4.1.0` on
`9d18a13c236b6ee46857382a25ec75c0ff6ccf86`. They pair with Stable Protocol
**4.0.0** and Format **3.0**, the same contract as 4.0.x; the release moves
nothing normative, so neither version does. It carries RFC 0083, now
`implemented`: **`@uwmd/verify` 0.1.0**, the reference
implementation of the standard, is its own package with no `@uwmd/*`
dependency, and core is the starter toolkit on top of it, depending on it
exactly and re-exporting its whole surface. Receipts name `@uwmd/verify` as
their engine; a receipt issued by core 4.0.1 or earlier whose results
disagree reports `RCP-07` `unverifiable`, not `failed` (UW Receipt §5.3).
`uwmd --version` prints the verify version too. No conformance expectation
changes: 1,069 reference checks and 336 portable cases, and the lender
fixture stays 187/0/0. Signing **0.4.0** pins verify 0.1.0 and core 4.1.0,
batch **0.9.0** and lake **0.3.0** pin verify 0.1.0, Excel **0.9.17** and
report **0.8.29** pin core 4.1.0, and core's optional signing peer is 0.4.0.
The release workflow published eight packages, `@uwmd/verify` first, through
the trusted publisher the owner bound after bootstrapping the new name (wiki
11). The published `@uwmd/verify`, installed alone, reads, validates and
verifies stated metrics and a receipt issued by the published core 4.1.0, and
batch and lake install without core. See the
[publication evidence](../releases/4.1.0-publication.md).

Reconciled **2026-10-13** (America/Phoenix) for published and independently
verified **4.0.1**. Core/CLI **4.0.1**, signing **0.3.1**, batch **0.8.23**,
Excel **0.9.16**, report **0.8.28** and lake **0.2.12** are published from
`v4.0.1` on `442dfc6aecfb591ce744f00776a9e2c7a601854c`. They pair with Stable
Protocol **4.0.0** and Format **3.0**, the same
contract as 4.0.0; the patch moves nothing normative, so neither version
does. It carries three fixes: the starter `deriveSourcesUses` footing counts
a typed `uses.renovation` as `budget + contingency` (RFC 0081 §7; Format
§4.8 now states the rule, and derived totals change only for 16
`conformance/capex/` documents), `@uwmd/signing` reads `SIGNING_VERSION`
from its own manifest, and the private web editor reads its own name and
version. No conformance expectation changes; 1,069 reference checks and 336
portable cases, and the lender fixture stays 187/0/0. Every dependent
pins core 4.0.1 exactly, and core's optional signing peer is 0.3.1. The release
workflow published the same seven packages, and the published signing 0.3.1
exports `SIGNING_VERSION` `'0.3.1'`. See the
[publication evidence](../releases/4.0.1-publication.md).

Reconciled **2026-10-12** (America/Phoenix) for published and independently
verified **4.0.0**. Core/CLI **4.0.0**, signing **0.3.0**, batch **0.8.22**,
Excel **0.9.15**, report **0.8.27** and lake **0.2.11** are published from
immutable annotated `v4.0.0` on
`d52a42394be238b00c55942afc1a31cc5c00061b`. Stable Protocol **4.0.0** pairs
with Format **3.0**, the one protocol and the one format the reference
implementation reads (RFC 0081: `SUPPORTED_FORMAT_VERSIONS = ['3.0']`,
`SUPPORTED_PROTOCOL_VERSIONS = ['4.0.0']`, and `FORMAT_VERSION` /
`PROTOCOL_VERSION` equal them). A missing or other `uw_version` is
`UNSUPPORTED_FORMAT_VERSION`. One block shape (bare payload, nested `_meta`
first; flat `_meta` and the `section_id` wrapper are `META-01`), a block
digest over the payload minus `_meta`, the G1 lone-fact groups, the
consolidated hospitality fields and module manifests by
`requires_conformance` / `requires_profiles` only. The migrators, the CLI
`migrate` commands, `init --format`, the RFC 0080 transition surface and both
module packages are gone; 3.0.0 is the last release that reads older formats.
The corpus uses content names (`documents/`, `calc/`,
`starter/{editor,refinement,agent}/`). Conformance: 1,069 reference checks,
336 portable cases; the lender fixture stays 187/0/0. Signing **0.3.0**
(a minor step: it stamps and verifies `_meta.integrity` under the new
digest), batch **0.8.22**, Excel **0.9.15**, report **0.8.27** and lake
**0.2.11** pin core 4.0.0. The release workflow published seven packages for
the first time; neither module package published again. Core takes a major
because the cut breaks public surfaces (CHANGELOG 4.0.0, which also carries
the migration notes). RFC 0081 is `implemented`. See the
[publication evidence](../releases/4.0.0-publication.md).

Reconciled **2026-10-11** (America/Phoenix) for published and independently
verified **3.0.0**. Core/CLI **3.0.0**, signing **0.2.26**, batch **0.8.21**,
Excel **0.9.14**, report **0.8.26**, lake **0.2.10** and both module packages
**0.2.0** are published from immutable annotated `v3.0.0` on
`44ab7347a8a3054fc377e19e85f89ad6f1539dea`. Stable Protocol **3.0.0** pairs
with Format **2.1**. Protocol 3.0.0 carries RFC 0078 (the Protocol is
verification: **Reader** and **Verifier** tiers, six optional profiles, the
normative metric dictionary and the non-normative starter products guide),
RFC 0079 (stated-metric precision and one LTV and cash-on-cash definition)
and RFC 0080 (data center and manufactured housing as full builtins, with
Format 2.1). No new §X floor applies. Core takes a major because the cut
breaks public surfaces (CHANGELOG 3.0.0). The release workflow published nine
packages for the first time: Excel, report and lake joined core, CLI,
signing, batch and the two module packages, which shipped 0.2.0 as
declaration-free compatibility shells and their final version. The owner
deprecated both module package names on npm on 2026-10-11. RFCs 0078–0080 are
`implemented`. See the [publication evidence](../releases/3.0.0-publication.md).

Reconciled **2026-10-10** (America/Phoenix) for published and independently
verified **2.21.0**. Core/CLI **2.21.0**, signing **0.2.25**, batch **0.8.20**
and both official modules **0.1.13** are published from immutable annotated
`v2.21.0` on `6e5ffaf75425d35554c57d72bea28c59c6047839`. Stable Protocol
**2.25.0** pairs with unchanged Format **2.0**. The generation carries RFC
0065's optional external, digested plan binding selected RFC 0064 internal
reserve draws to already-stated gross expenditures, with `RDB-01`–`RDB-09`
codes, the separately invoked §VIII.12 verifier and the read-only
`verify-reserve-draws` CLI. No new §X floor applies. RFC 0065 is
`implemented`. See the
[publication evidence](../releases/2.21.0-publication.md).

Reconciled **2026-10-10** (America/Phoenix) for published and independently
verified **2.20.0**. Core/CLI **2.20.0**, signing **0.2.24**, batch **0.8.19**
and both official modules **0.1.12** are published from immutable annotated
`v2.20.0` on `020e8b088307ac53a0023bfc0b881c31fb40db91`. Stable Protocol
**2.24.0** pairs with unchanged Format **2.0**. The generation carries RFC
0072's business-plan `scenario` vocabulary and single-site `build_to_rent`
identity with warning-only `DQ-07`–`DQ-09`, RFC 0064's optional
`reserve_accounts` section (Format §4.28) with `RSV-NN` codes and the
separately invoked §VIII.11 reserve-account verifier, and the §VIII.5
quantizer fix for an integral decimal shift. No new §X floor applies. RFCs
0064 and 0072 are `implemented`. See the
[publication evidence](../releases/2.20.0-publication.md).

Reconciled **2026-10-09** (America/Phoenix) for published and independently
verified **2.19.0**. Core/CLI **2.19.0**, signing **0.2.23**, batch **0.8.18**
and both official modules **0.1.11** are published from immutable annotated
`v2.19.0` on `139268f34be9550287d8782e44767a9f7e8273b1`. Stable Protocol
**2.23.0** pairs with unchanged Format **2.0**. The generation carries RFC
0075's `senior` preference and RFC 0076's refused-selection `HDG-08` for the
hedge and escrow rules (Protocol §V.12.1), RFC 0077's definition of exit
proceeds to equity with junior capital (Format §4.9, two optional fields), and
SDK-free strict TypeScript declarations for the optional Anthropic provider.
No new §X floor applies. RFCs 0075, 0076 and 0077 are `implemented`. See the
[publication evidence](../releases/2.19.0-publication.md).

Reconciled **2026-10-08** (America/Phoenix) for published and independently
verified **2.18.0**. Core/CLI **2.18.0**, signing **0.2.22**, batch **0.8.17**
and both official modules **0.1.10** are published from immutable annotated
`v2.18.0` on `4e0a8c18091377fa25800dc2b16954a636be1d83`. Stable Protocol
**2.22.0** pairs with unchanged Format **2.0**. The generation carries RFC 0071's `is_calendar_date` predicate and RFC
0074's §VII.3 dependent overrides, each with a `>=2.22.0` §X floor. It also
carries the unrelated-conflict refusal, CLI reporting clarity, the `uwmd init`
and `--version` fixes, and the early-year actual-days correction. It is the
first six-package generation, adding both official modules at 0.1.10. RFCs
0071 and 0074 are `implemented`. [Publication evidence](../releases/2.18.0-publication.md)
is separate from [preparation](../releases/2.18.0-preparation.md).

Reconciled **2026-10-03** (America/Phoenix) for published and independently
verified **2.17.0**. Core/CLI **2.17.0**, signing **0.2.21** and batch **0.8.16**
are published from immutable annotated `v2.17.0` on
`98dc5e4a040cf04f7b907a76e3d83825868d1d9f`. Stable Protocol **2.21.0** pairs with
unchanged Format **2.0**. RFC 0070 is `implemented`; its frozen replacement-funding
contract and synchronous/async boundary are unchanged. This complete generation
also includes the later multifamily pack 1.0.1 deal-level cash-on-cash correction.
[Publication evidence](../releases/2.17.0-publication.md) is separate from
[preparation](../releases/2.17.0-preparation.md).

Reconciled **2026-10-02** for published and verified **2.16.0**. Core/CLI
**2.16.0**, signing **0.2.20** and batch **0.8.15** are published from the
immutable `v2.16.0` tag with verified provenance. Stable Protocol **2.20.0**
pairs with unchanged Format **2.0**. RFC 0069 is `implemented`; see
[Released student bed-count contract](#released-student-bed-count-contract-rfc-0069).
The generation includes both RFC 0066 fence-order conformance repairs and
PR #240's publication-neutral release-state guards. The preparation and
publication records are separate sections in `docs/releases/2.16.0-candidate.md`.
Draft RFCs 0065, 0067 and 0068, and accepted-but-unreleased RFC 0071,
remain outside the current released contract. RFC 0070 shipped subsequently in 2.17.0 above. The historical publication is
[2.15.0](#released-in-2150), pairing core/CLI 2.15.0 with Protocol 2.19.0.
See [VERSIONS.md](../../VERSIONS.md) and [ROADMAP.md](../../ROADMAP.md).

## 2026-10-14 — Public-launch onboarding audit (published 4.2.0)

The published packages were installed from npm into empty directories and
their READMEs followed as a new adopter would. Full record:
[launch onboarding audit](../reviews/2026-10-14-launch-onboarding-audit.md).

- **Next version for PR #328.** The closed flag vocabulary refuses
  invocations 4.2.0 documents (`validate --stage`, `export --compact`), so
  under semver-per-surface core and CLI take a major: **5.0.0**. Signing,
  Excel and report take repin patches. Verify, batch and lake do not move,
  and neither do Protocol 4.1.0 and Format 3.0. This is not a lockstep
  generation, and nothing is prepared or tagged without owner authorization.
- **Works from npm:** `@uwmd/verify` alone, a strict TypeScript consumer of
  every entry, browser bundles of verify and `core/browser` (run in
  Chromium), and receipts and document signatures from the library and the
  CLI. The four verification scenarios are runnable in
  `examples/verification/` (PR #330).
- **Launch blockers:** `uwmd verify` does not recompute stated metrics, so it
  prints `OK` for a document whose stated cap rate disagrees with its record
  (Protocol §II.2 item 2; the library reports it). The README quick start's
  `init my-deal.uwx.md` ignores the filename, so its next `validate` exits 1.
- **Should fix:** `npx uwmd` is advertised but the unscoped npm name is
  unregistered. `@uwmd/signing` declares Node `>=18.4.0` but fails on 18.20.8,
  and does not document `node:fs` as a bundler external. Missing-signing
  errors are misleading. Stale Protocol 4.0.0 and `--stage` references remain
  (README, VERSIONS.md pinning, Format spec Part VI). `compact` output fails
  `verify` (`POL-02`), and `package verify` cannot reach `VERIFIED` because the
  CLI supplies no semantic digest. The CLI blockers (D-01, D-02, D-04),
  D-10 and the `uwmd-report` output name are fixed on `main`, unreleased.
  D-09 and the dangling-`parent_hash` gap are open normative questions in
  draft RFC 0085 (record §9–§11).
- **Next-release readiness (read-only, same day):**
  [docs/reviews/2026-10-14-next-release-readiness.md](../reviews/2026-10-14-next-release-readiness.md).
  - **Packages that would move:** core/CLI 5.0.0, because the closed flag
    vocabulary refuses invocations 4.2.0 accepted, while core's library API
    is unchanged. Signing 0.5.1 (its pins), Excel 0.9.19 (its pins) and
    report 0.8.31.
  - **Packages that stay:** verify, batch and lake, whose packed contents are
    byte-identical to the published ones apart from lake's README. Format and
    Protocol don't move.
  - **Gates:** all pass on `8203f00c`. Reference conformance is 1,089/0.
    The portable driver gives 350/350 for both the candidate and the
    published CLI, so it does not catch D-01 or D-10.
  - **Node 18:** although every package declares it, `@uwmd/report` (via
    `playwright-core`) and `@uwmd/signing` (no global Web Crypto) fail on
    Node 18.
  - **Open owner decisions:** the version plan, the Node floor, and D-07
    (Part VI still shows `validate --stage`). Nothing is prepared, tagged or
    published.
  - **RFC 0085** records the owner's provisional direction (complete records
    are the authority; stripped outputs are projections) as a preference,
    still a draft.

## Released in 4.1.0: the `@uwmd/verify` split (RFC 0083, 2026-10-13)

[RFC 0083](../rfcs/0083-verify-package-split.md) landed in three phases and
is `implemented`. Phase 1 (PR #317) drew the standard/starter line inside core and
added `verifyStatedMetrics`. Phase 2 (PR #319) created `packages/uwmd-verify`
(`@uwmd/verify` 0.1.0): the standard modules moved there with
their tests, core depends on it exactly and re-exports its whole surface, and
signing, batch, lake and the VS Code extension build on it. No public name of
`@uwmd/core` or `@uwmd/core/browser` was removed; the browser entry gained the
integrity verifiers and the other names verify exports. Receipts now name
`@uwmd/verify` (`VERIFY_VERSION`) as their engine, including those issued
through core; the issuer stays core's, the two receipt issue baselines and
three verify fixtures were updated, and every verdict is unchanged. `uwmd
manifest`, every other conformance expectation (1,069 checks; the lender
fixture at 187/0/0) and the portable driver are unchanged. Phase 2 moved no
package version. Phase 3 (PR #320) prepared the release: core/CLI 4.1.0 with
`@uwmd/verify` 0.1.0, signing 0.4.0, batch 0.9.0 and lake 0.3.0 (minors,
because their dependency sets changed), Excel 0.9.17 and report 0.8.29. The
owner bootstrapped the new `@uwmd/verify` name and bound its trusted
publisher (wiki 11), and `v4.1.0` published all eight
packages ([publication record](../releases/4.1.0-publication.md)).

## CLI reporting clarity (2026-10-03; core/CLI 2.18.0)

Human-readable CLI validation distinguishes validity, Stage Readiness (workflow
section/field completeness), cross-check coverage and unchecked receipt readiness.
Receipt issuance names computed/uncomputed metrics and prints canonicalization
and document/results hashes. A complete receipt can cover partial metrics;
verification compares recorded statuses and hashes independently. Typed refusals
retain available resolver details; missing packs still refuse. JSON payloads,
exit behavior and normative contracts are unchanged. Regression tests cover clean
but incomplete workflow, partial/complete receipts, unresolved pack and variant
selection, and verified/mismatched receipts using only repo-owned synthetic data.

The [element/package design candidate](../roadmap/element-package-validation.md)
builds on existing RFC 0018 packages, RFC 0021 composition/rollups and RFC 0048's
standalone kit. Standalone rent-roll/T-12/debt-schedule/property profiles,
ZIP/folder stitching, canonical package hashes, assembly provenance and receipt
scope need a future RFC; this reporting work implements none of those extensions.

Rebased onto `main` on 2026-10-05, after 2.17.0. `validate` keeps RFC 0070's
complete/structural/replacement-funding lines under the new labels, and the
receipt output names multifamily pack 1.0.1. The 2.18.0 preparation updated
the docs-site quickstart (`tools/docs-site/tutorials/quickstart.md`) to the
new receipt output.

## Built and released

- Reader/editor/calc/agent-host foundations; Format 2.0 metadata, provenance,
  scoped edits, deterministic asset packs, class-aware readiness and validation.
- Calendar cash flows, xirr/xnpv, typed capital stacks, lease-up schedules,
  mixed-use component aggregation and LP-IRR waterfalls.
- Signed blocks/modules, capability tokens, receipts and conformance profiles;
  JSON/XML/CSV interchange, optional HTTP/MCP profiles, document composition,
  market data, portfolio relationships and batch corpus fact tables.
- RFCs 0040/0041 in 2.7.0: signed block roles and explicit period identities.
- RFCs 0042–0044 in 2.8.0: fixed stated period refinement inputs, contextual
  workbook binding APIs, validated CLI calculation context, and explicit
  lease-up cash-flow projection with semantic source evidence.

## Implemented supporting tools

Web editor/viewer, docs site and VS Code extension are implemented. Excel
**0.9.17** and report **0.8.29** pair with core 4.1.0, and lake **0.3.0** with
`@uwmd/verify` 0.1.0; all three are published through the release workflow,
as they have been since 3.0.0 (Excel
0.9.14, report 0.8.26, lake 0.2.10); through 2.21.0 they were source-only. Lake 0.2.9 was published by hand from `v2.21.0` on
2026-10-11 so its trusted publisher could be configured; it carries no
provenance. The hospitality/data-center module packages **0.2.0** pair with
core 3.0.0 as compatibility shells (RFC 0080), their final version, and both
names are deprecated on npm (2026-10-11); 0.1.10 was their first public
generation. RFC 0081 deleted both from the repository, and 4.0.0 did not
publish them. The
registry does serve a stale `0.3.0` of excel and report from a hand publish on
2026-08-16, deprecated by the owner on 2026-10-02; see [VERSIONS.md](../../VERSIONS.md). Core's
RFC 0043 binding API and the full Excel exporter (`@uwmd/excel`) are both
published. Native Excel 16.0 build 20326 passed
14 scenarios / 48 cell checks. Reverse import of additional inputs refuses.

## Verification

The 2.17.0 prepared generation passes build, **2,801 workspace tests / 144
files**, test typechecks, **734 default conformance checks**, **158/158 portable
cases with no skips**, all three capability profiles, schema/package/lockfile/
version/index/code/release-record guards, the intended `v2.17.0` tag check,
static release readiness, lint and the documentation build. Receipt updates
change only engine/Protocol identity. All accepted RFC 0070 normative/API/
conformance bytes and merged financial runtime remain unchanged. The initial
CLI worker-reporting timeout and docs-link failures are resolved; full results,
environment and limitations are in [the preparation record](../releases/2.17.0-preparation.md).
Exact-main push CI run 37169227124 succeeded before owner-authorized tagging.
Release run 37172975077 succeeded; all four versions/`latest`/`gitHead` match.
Independent registry/DSSE signatures, authenticated TUF/Fulcio/SCT trust, all
eight Rekor bundles/live records and 462 delivered file contents verify.
The registry-installed CLI passes **158/158**, with zero failures or skips;
`npm audit signatures` verifies 13 package signatures and 8 package attestations.
See [the publication evidence](../releases/2.17.0-publication.md).
The 2.16.0 evidence below remains historical publication evidence.

Release run 37075007121 succeeded on tagged commit
`a1ca815e2aee5da374caf7627ba3702849ecd257`. All four npm versions/`latest`
and registry `gitHead` values match. Registry/DSSE signatures, Fulcio chain/
identity/SCTs, authenticated TUF trust and Rekor timestamps/inclusion proofs
verify; all eight live log entries match. All 454 published file contents
equal the prepared build. The registry-installed CLI passes **101/101**
portable cases with zero skips. `npm audit signatures` verifies registry
signatures for 13 installed packages and attestations for 8 packages. Exact
public evidence is in `docs/releases/2.16.0-publication-evidence.json`.

The 2.16.0 prepared tree passes pinned Node 22.14.0/npm 11.5.1 verification:
**2,690 workspace tests / 140 files**, test typechecks, core coverage floors,
**675 default checks**, **101/101 portable cases**, all three profiles,
47 JSON schemas, 227 codes, version/package/lockfile/index checks,
ordinary and intended-tag release-state checks, static OIDC eligibility,
lint over 1,196 files and a clean docs build. Clean web-editor and VS Code
extension builds pass with 71 and 28 tests respectively.
The private golden comparison passes 640/640 and 20/20 refusals on both this
tree and the published 2.15.0 baseline; the 640 assertion ledgers are identical
and no private file changed. All nine local tarballs pass inspection, and
the four installed workflow artifacts pass consumer checks and 101/101 portable
cases. First-/last-fence resolver negative controls still fail the four
strengthened fixtures. See `docs/releases/2.16.0-candidate.md` for the exact
receipts and limits. Jared reconfirmed all four npm trusted publishers on
2026-10-02 from his personal 2026-10-01 inspection, with no settings changes
since; the inspection clock time was not recorded. The reported fields match
the canonical release workflow; this is owner-reported account evidence.

Release 2.15.0 passed its gates on the final tree, `main` at `7b33f00` plus the
documentation-only release commit `aaa9ec3`, under the pinned Node
22.14.0/npm 11.5.1 toolchain:
- build, **2,628 workspace tests** across 139 files (**2,201 core**), test
  typechecking;
- **667 default conformance checks** and the 93-case portable driver;
- all three RFC 0030 profiles, **47 JSON schemas**, lint over **1,185 files**;
- **221 emitted codes**, the lockfile/package/version/index/release checks, the
  documentation build and the OIDC release-readiness guard.

The tag workflow published core/CLI 2.15.0, signing 0.2.19 and batch 0.8.14
through trusted publishing with provenance; see the
[release record](../releases/2.15.0-candidate.md).

Release 2.14.0 passed its gates at `6ad146a` under the pinned Node
22.14.0/npm 11.5.1 toolchain: build, **2,573 workspace tests** across 138
files (**2,166 core**), test typechecking, **652 default conformance checks**,
the 78-case portable driver, all three RFC 0030 profiles, **46 JSON schemas**,
lint over **1,168 files**, **221 emitted codes**,
lockfile/package/version/index/release checks, the documentation build and the
OIDC release-readiness guard
([review](../reviews/2026-09-28-2.14.0-pre-release.md)). The release commit
`641554d` changed documentation only. The tag workflow published core/CLI
2.14.0, signing 0.2.18 and batch 0.8.13 through trusted publishing with
provenance.

Release 2.13.0 passed build, **2,433 workspace tests** across
138 files (**2,032 core**), test typechecking, **589 default conformance
checks**, all three RFC 0030 profiles (161 checks passed, 67 capability skips),
**46 JSON schemas**, lint over **1,047 files**, **221 emitted codes**,
lockfile/package/version/index/release checks, the documentation build, and the
OIDC release-readiness guard. The frozen private golden corpus also passes all
eight runnable cases: 532 Artifact B assertions accounted for, 526 passing, six
documented source/baseline defects, and 20 refusal assertions. GD04 and GD07
were evidence-blocked in that frozen release corpus; see the
[review](../reviews/2026-09-21-golden-deal-release-comparison.md). The tag
workflow published core/CLI 2.13.0, signing 0.2.17 and batch 0.8.12 through
trusted publishing with provenance.

Release preparation for 2.10.0 passed build, **1,778 core tests** plus every
other workspace, test typechecking, **504 default + 76 declarative conformance
checks** and three capability profiles, **38 JSON schemas**, lint,
lockfile/package/version/index/release checks and the documentation build. The
`v2.10.0` tag published core, CLI, signing and batch through trusted publishing
(OIDC) with provenance attached. Separate tarball and registry installations verified
core/browser assembly and projection, synthetic pinned metrics, explicit zeros, CLI success/refusal,
signing exports and batch indexing. Source documents remained unchanged.

PCG64 independently matches NumPy 1.26.4's compiled implementation over
11 seeds, 11,264 raw draws and 176 doubles. See the [record](../reviews/2026-09-12-pcg64-reference.md).
No financial formula, precision boundary or calculation digest changed in the
release repin. The three receipt edits changed engine-version labels only.

## Released in 2.15.0

The following work shipped from the reviewed `v2.15.0` tag.

- **Calc variant resolution (RFC 0066, Protocol 2.19.0).** Ordinary calc
  identifiers over variant-map sections select one block, or refuse with
  `CALC-RESOLVE-002`; details are below.
- **Format 2.0 payload reading.** The cascade, refinement and Excel read a
  block's v2 `content` envelope through `blockPayload`, as the evaluator
  already did.
- **RFC 0062 portable coverage.** Tier-3 fixtures `period-09` … `period-12`
  carry the same-day selection rule into the RFC 0004 driver.

## Released in 2.14.0

The following work shipped from the reviewed `v2.14.0` tag.

- **Same-day cash-flow rows (RFC 0062, Protocol 2.17.1 errata).** Legal
  same-day `cash_flow_series.series` rows no longer emit PS-02. A repeated
  requested date refuses `CALC-PERIOD-002`, and a unique date in the same
  ledger resolves. Other registered series and the whole-column Excel guard
  keep their duplicate refusal.
- **Final-period exclusive boundary (RFC 0063, Protocol 2.18.0).** The optional
  closed `disposition_period_rule` plan member admits the exact exclusive end
  of the final monthly or quarterly source period with `allow_exclusive_end`.
  Absence and `within_final_period` keep the legacy rule.
- **Decimal quantization for stated-value checks.** Cash-flow, net-sale, tax,
  escrow, hedge and capex comparisons use calc reporting's half-away-from-zero
  decimal algorithm (PR #221).
- **§4.5 `noi_model` read paths.** The student-housing and self-storage pack
  formulas, the office Excel layout, the chat renderer and the `noi_model` view
  model read `gross_potential_rent` and the other §4.5 lines as the stated
  object shape (PRs #223, #228 and #229).

No formula quantum or source amount changed in the release repin. Excel ↔ calc
parity is unchanged.

## Released in 2.13.0

The following work shipped from the reviewed `v2.13.0` tag. Withdrawn
experiments remain documented here because neither is part of the published
surface.

- **The SQL export surface was added and then withdrawn.** `src/sql.ts`
  exposed `exportSql`, `exportSqlStatements`, `UWSqlError` and
  `ExportSqlOptions` from `@uwmd/core` and its browser entry, plus
  `uwmd export --format sql`, emitting **PostgreSQL and Snowflake** DDL for six
  tables and four reporting views. All of it is removed; nothing consumed it
  outside its own tests.

  RFC 0049's Non-goals name "warehouse-specific SQL" explicitly, and the RFC
  gives the relational boundary to `@uwmd/lake` — `docs/DATA_LAKE.md` opens by
  saying UWMD "is the backbone of a CRE data lake, not the lake itself." The
  exporter also **collided** with the lake: both define `uw_documents` with the
  same primary key and the same three index names but different columns, and
  both default to schema `public`, so they are the same relation. Loading core's
  narrower table first makes the lake's `INSERT` fail on `format_version`;
  loading the lake's first lets core's `INSERT` write catalog rows with a null
  validation verdict.

  Withdrawn rather than re-homed: a second, BI-shaped projection is a real
  architectural choice, and there is no adopter requirement to justify deciding
  its package and schema now. If one appears, it returns through an RFC.
  `@uwmd/lake` remains the single relational boundary. JSON export is untouched.
- **RFC 0060 decided the four tranche-class candidates — none opens the enum.**
  `ground_lease`, `pace`, `tax_credit_equity` and `soft_debt` were taken up in
  one bounded RFC, as the roadmap required, and `TrancheClass` is unchanged.
  `pace` and `soft_debt` are `other_debt` **for the subset the existing fields
  express**; `tax_credit_equity` defers with its mechanics; `ground_lease` was a
  layer error — a `Tranche` has no field for tenure. No code, schema or fixture
  changed.

  The RFC closes the **enum question only** and does not claim these domains are
  modelled. Ground leases are notably *not*: §4.4 has no `ground_rent` key, §4.5
  `noi_model.expenses` has no ground-rent line and no generic bucket at all, and
  nothing types the leasehold as an object. PACE assessment servicing, soft-debt
  contingent payment and forgiveness, and tax-credit pay-in and recapture are
  equally unmodelled. Each is preserved as demand-gated mechanics, profile or
  tenure work, not tranche-class debt. `decided` is terminal.
- **Period-indexed path navigation** (§VIII.2a): a registered series resolves by
  stated period identity, `dcf.annual_cash_flows@Y3`, never by row position.
- **The Tier-3 collection surface was added and then withdrawn.** Sixteen
  builtins and numeric bracket indexing landed on this branch and have been
  removed. They were not in §VIII.3's enumerated set, the grammar change was
  the one §VIII.2a explicitly excludes, and `filter`/`map_by` returned arrays
  into a `CalcResult.value` that `calc-result.schema.json`, the normative schema
  for Part VIII, types as scalars. RFC 0019 had already
  weighed this primitive and rejected it, keeping slots static so the Excel
  emitter stays static — so the addition reopened the parity hole that design
  closed. Nothing consumed it. The calc engine therefore still has **no
  collection iteration**, by design; see the RFC 0053 and RFC 0059 notes above,
  which are unaffected.
- **RFC 0024 bisection restored.** An intermediate commit on this branch swapped
  `irr`'s bisection for a Newton-Raphson pass — the procedure §VIII.3 step 5
  forbids — and it was reverted. `irr` bisects to the normative `1e-9`/`1e-12`
  stopping conditions again. Note for future work: **conformance cannot detect
  this class of regression**, because Newton and bisection agree within the
  §VIII.5 quantum on every pinned fixture; only the property suite caught it,
  and only on a lucky seed. That suite is now seeded by default (`UWMD_FUZZ=1`
  to explore).
- **Prototype-pollution guard.** The evaluator refuses `__proto__`,
  `constructor` and `prototype` path segments with the new `CALC-FORBIDDEN-PROP`
  code, alongside the existing `MAX_NODES` bound.
- **Release readiness check.** `scripts/check-release-readiness.mjs` verifies the
  npm Trusted Publishers OIDC configuration before a `v*` tag triggers a publish.
- **Golden-deal release comparison.** A frozen private corpus accounts for 532
  Artifact B assertions: 526 pass, six remain documented source/baseline
  defects, and 20 refusal assertions pass. All eight runnable cases pass in the
  release evidence. Published 2.12.0 fails seven model-fidelity round-trips because an
  empty frontmatter array becomes a bare YAML key and reparses as `null`; the
  2.13.0 implementation preserves `[]`. See the
  [de-identified record](../reviews/2026-09-21-golden-deal-release-comparison.md).

**Invariant 4 is intact.** The parity risk here was the collection surface, and
withdrawing it removes the risk rather than deferring it: every remaining
builtin is in §VIII.3 and has a static Excel counterpart. Any future collection
primitive must arrive through an RFC that pins its Excel emission alongside its
semantics — the emitter targets Excel 2016, where an array-valued cell has no
representation, so parity is a design constraint on such a primitive, not a
follow-up task.

## Released in 2.12.0

Two contracts and one guard, all additive.

| RFC | Surface | Family |
|---|---|---|
| 0058 | Expense recoveries and the CAM true-up on the commercial tenant record (§4.3). | `REC-NN` |
| 0059 | Distribution-waterfall clawback as a terminal true-up (§4.27, protocol §VIII.10 step 5). | `WF-10`–`WF-15` |

RFC 0058 leaves two figures **stated, not recomputed**, and the spec says why:
the capped amount, because a cumulative or compounding cap depends on base-year
history no single document carries, and the pool allocation across tenants,
because that needs a vacant-space policy and is a modeling decision. `REC-05`
anchors on the rent roll's own `as_of_date` and is skipped when absent.

RFC 0059's every basis is closed-form — the IRR floor reuses RFC 0036's hurdle
balance rather than iterating, because the calc engine has no iteration. A test
pins the boundary: at a floor equal to the IRR the LP achieved, the true-up is
exactly zero.

`verify-codes` joins CI. RFC 0058 first shipped nine of its ten codes: `REC-09`
was in the RFC, the format spec and the schema, and nowhere in the validator,
and nothing went red — a missing refusal looks exactly like a document with
nothing to refuse. The guard cross-checks every code an implemented RFC or a
format-spec bullet promises against what `@uwmd/core` actually emits.

Current gate totals: **1,994 core tests**, **589 default conformance checks**,
three capability profiles, **46 JSON schemas**, **221 emitted codes**.

## Released in 2.11.0

Five contracts. All additive, every member optional, so a document stating none
of them validates exactly as it did at 2.10.0.

| RFC | Surface | Family |
|---|---|---|
| 0049 | `@uwmd/lake`, the PostgreSQL/JSONB adapter. Plans SQL; takes no database driver. | — |
| 0054 | Decision only: per-lease economics split by shape. The periodic ledger waits for a named consumer. | — |
| 0055 | Commercial lease clauses — escalation steps, break options, co-tenancy, TI/LC balances (§4.3). | `LSE-NN` |
| 0056 | Rate hedges (§4.7) and escrow cash lines (§4.8). `rate_swap` / `rate_collar` reserved and refused. | `HDG-NN`, `ESC-NN` |
| 0057 | Renovation draw and expense-targeted capex (§4.8). | `CAPX-NN` |

**RFCs 0055, 0056 and 0057 type structures nothing yet consumes.** No rent
escalates, no break is exercised, no balance amortizes, nothing is priced, no
strike crossing is projected and no stated saving is applied. Typed-but-inert is
the intended state, not an unfinished one: the format learns to *say* these
things before anything acts on them, and each consumer arrives with its own
contract.

RFC 0054's periodic-series half is likewise **unbuilt by decision**. It needs a
named consumer, and a calc-grammar answer for collections and a second period
dimension, before it is reachable from a pack formula at all.

Three of the new rules require a disclosure rather than defaulting one, because
the unstated reading is the one that misleads: `HDG-06` (what happens when the
cap expires), `CAPX-07` (whether a stated saving is already inside the NOI) and,
from 2.10.0, `TAX-08` (whether the terminal tax is inside exit NOI).

Current deterministic gates cover **2,032 core tests**, **589 default
conformance checks**, and **46 JSON schemas**. Protocol **2.17.0**. RFC 0061
keeps both protocol-document release labels mechanically synchronized with
`VERSIONS.md` and `PROTOCOL_VERSION`.

For the lake adapter, a live load **has now been run** (2026-09-16, after the
2.12.0 cut): the whole conformance corpus — 382 documents, 24,380 facts, 24,809
statements — into PostgreSQL 18, twice, for identical row counts. It found three
defects the in-memory double could not, all fixed in `@uwmd/lake` **0.2.0** /
lake schema **0.2**:

- `uw_facts.value_json` was `NOT NULL`, so the **21.6% of canonical facts that
  are containers** — an object or an array, which UWMD represents by its
  flattened children and leaves valueless — could not load at all;
- `uw_receipts.verdict` projected a field no receipt carries, because a verdict
  is what *verifying* a receipt produces, not something it states. The unit test
  missed it by inventing the field in its fixture;
- the documented DDL call could not work: a multi-command script cannot go
  through a parameterized `query(sql, params)`.

The publication decision stays open — no managed service, network or concurrent
loader has been exercised. See the
[load record](../reviews/2026-09-16-lake-live-postgres.md).

## Property cash-flow assembly released in 2.9.0

RFC 0045 adds `assemblePropertyCashFlows` and `uwmd assemble-property` under
Protocol 2.12.0. It assembles explicitly covered unlevered/pre-tax cash in one
declared currency, with real purchase anchoring, reserve assertions and source
evidence. The owner selected a synthetic test ledger; real-deal review remains
separate. See the [workflow](../PROPERTY_CASH_FLOW_WORKFLOW.md).
This API and CLI are published in 2.9.0.

## Development released in 2.10.0

The source CLI adds `verify-cash-flows` for selected stated-metric comparisons,
with explicit no-claim results, input guards and read-only behavior. This reuses
the published metric engine without changing the protocol or financial math.
Private archived-deal comparisons informed the workflow; no private ledgers or
property identifiers are included in public fixtures. Complete real-deal
assembly still needs explicit expense/reserve coverage and payment timing.

RFC 0046 is released in 2.10.0: optional
document-level `currency_code` makes display denomination explicit without
changing numeric storage, calculation, or locale separators. `CUR-01` refuses
malformed identity; per-value/multi-currency representation and FX remain
deferred.

RFC 0047 is released in 2.10.0:
`inspectPropertyCashFlowInputs` and `inspect-property-cash-flows` inventory the
source shape needed for RFC 0045 authoring without classifying rows or inferring
expense, reserve, or payment timing.

Hospitality and data-center are now approved together as official first-party
public npm packages. Ordinary release infrastructure supports six publishing
packages for generations after 2.17.0; historical 2.17.0 publication remains four.
Neither module is published by this tooling change. Current package versions are
0.1.9 with exact core 2.17.0 pins, independent manifest contract 0.1.0 and schema
`manifest_version: "1"`. First publication awaits human npm name/bootstrap and
trusted-publisher confirmation, then the next owner-authorized ordinary release.
See [wiki 11](11-build-release-governance.md#official-first-party-module-distribution).
No Format/Protocol, loader, signature-policy or financial behavior changes.

Data-center conformance is structurally complete as a reference module: six
dedicated runtime scenarios, 26 module tests, 11 calculations, seven
validations, and explicit fallback/degraded behavior. The Mesa Gateway fixture
is synthetic, so adopter validation is still open. Data center is now a builtin
class (RFC 0080) and its module package was deleted by RFC 0081. The built-in library covers nine calculation packs; mixed-use is
composition rather than a standalone pack.

RFC 0048 is released in 2.10.0: standalone
document/package examples with their own `standalone` conformance suite.
RFC 0049 is implemented as `@uwmd/lake` (`packages/uwmd-lake`; **0.2.12**,
on npm since 3.0.0): a PostgreSQL/JSONB lake adapter that plans
idempotent digest-keyed upserts over six tables from canonical envelopes,
`block_values` facts, receipts, package manifests and source-evidence
references. Raw canonical JSON sits in `jsonb` beside typed shadow columns, so
unknown sections, extension keys, explicit nulls and array order survive a load.
It takes no database driver, changes no protocol or financial math, and refuses
bytes-bearing source evidence. 52 unit tests cover it against an in-memory
warehouse double, and a live PostgreSQL 18 load **has** now been run — see the
live-load subsection above for the three defects it found and what it does not
prove. The publication decision remains open.

RFC 0050 is released in 2.10.0: split preferred-equity
coupons use one tranche with `cash_rate` for coverage, `accrued_rate` excluded
from coverage, and full `rate` for weighted cost. Debt PIK toggles and accrued
compounding remain deferred.

RFC 0051 is released in 2.10.0: `hurdle_mode: "any"`
enables dual-hurdle tiers to end as soon as either `until_lp_em` or
`until_lp_irr` is met (smaller capacity), while default `hurdle_mode: "both"`
preserves existing behavior (larger capacity). `WF-01` rejects `hurdle_mode`
when both hurdles are not present.

RFC 0052 is released in 2.10.0: an optional closed `sale_deductions`
vocabulary names every cost-of-sale row at the disposition slot, and an optional
`net_sale_proceeds` figure is verified against gross sale less exit costs at the
currency quantum. `prepayment_penalty`, `defeasance` and `loan_payoff` are
reserved and refused by this unlevered assembler. A plan stating neither member
behaves exactly as it did before.

RFC 0053 is released in 2.10.0: the `noi_model`
reassessment basis and abatement schedule are typed, the `TAX-NN` validator
family is registered, and `dcf.exit_analysis.terminal_tax` names the next
buyer's tax. Everything is stated-and-verified; the exit-value/terminal-tax
circularity is not solved, because the calc engine has no iteration. Note that
a collection primitive would not solve it either: traversing a collection is
not iterating a formula to convergence.

## Completed-corpus validation (2026-09-24)

The [reconciled evidence pass](../reviews/2026-09-24-completed-golden-corpus-validation.md)
records 640/640 registered comparisons, 20/20 existing refusals and a separate
stale-workbook integrity refusal. Both monthly projections and 14 dated metric
claims pass; stated-source agreement is not complete forecasting/assembly parity.
The prior four stale reference crosswalks are reconciled. RFC 0062 resolves the
same-day PS-02 interaction as described below. Legacy RFC 0045 plans still refuse
the final-period disposition boundary and reserve-funded spending. The accepted
RFC 0063 opt-in below changes only boundary admission.

The [terminal-boundary design brief](../reviews/2026-09-24-terminal-boundary-design.md)
is integrated in main at `22d993b5`. Its evidence places final monthly cash on
economic disposition at the final source period's exclusive end, not after
sale. Jared accepted [RFC 0063](../rfcs/0063-final-period-exclusive-boundary.md)
at `f04b34a` on 2026-09-24 and authorized implementation. The implementation
integrated on canonical `main` at `413a645` shipped in 2.14.0. The released
contract is Protocol **2.18.0**, with a closed `disposition_period_rule` enum
for both monthly and quarterly sources. Absence and `within_final_period`
preserve legacy behavior; `allow_exclusive_end` additionally admits only the
exact exclusive upper boundary. No new period or coverage cell, proration,
inferred timing, grace period or post-sale cash is introduced. Reserve-funded
spending still refuses. Quarterly is a calendar generalization, not direct
Golden Deal evidence. RFC 0063 shipped in 2.14.0 and is **implemented**;
Format is unchanged. See the
[implementation verification record](../reviews/2026-09-24-rfc-0063-implementation.md).

## Same-day reconciliation (RFC 0062, released in 2.14.0)

[RFC 0062](../rfcs/0062-same-day-cash-flow-selection.md) resolves
the narrow reconciliation identified above. Jared accepted it on **2026-09-24**,
retaining Protocol **2.17.1** as normative errata. The reference implementation,
integrated at `e49eb43`, shipped in core/CLI 2.14.0; RFC status is
`implemented`. Legal same-day cash-flow rows
no longer emit PS-02, repeated requested dates still refuse CALC-PERIOD-002,
and unique dates in the same ledger resolve. Other series and the whole-column
Excel guard remain unchanged. Schemas and public types did not change.

## Calc variant resolution (RFC 0066, released in 2.15.0)

[RFC 0066](../rfcs/0066-calc-identifier-variant-resolution.md) was accepted on
**2026-10-02** through owner decisions D1–D3. It shipped in core/CLI 2.15.0
with Protocol **2.19.0** and is `implemented`.

- **The defect.** Before it, four readers chose differently from one
  role-bearing `debt_structure` map. The evaluator read `null`, the cascade the
  first fence, the workbook a blank input, and one adopter's adapter the last
  fence.
- **One selection now.** All of them select through `resolveSectionBlock`: an
  explicit variant, the calculation's declared `section_roles`, then RFC 0040's
  generic order.
- **Ambiguity refuses.** It refuses as `CALC-RESOLVE-002`, while a missing
  section stays `null`.
- **Built-in packs.** Lender-side debt metrics declare `senior`.
  `cash_on_cash` declares no role and refuses on multi-tranche maps until a
  total-debt-service input is contracted.
- **Excel.** The workbook writes `#VALUE!` where the engine refuses.
- **Refinement.** It reports excluded targets in `diagnostics.section_inputs`.
- **Fixture hardening after the release.** StackUW's UPSTREAM-021 found that
  `variant-05` and `variant-11` put the block their calc context names in the
  last fence. A reader that kept the last fence therefore passed both.
  - **Change.** Both now append a third `junior` fence, so the named block is
    the middle one: a first-fence reader reads 0.6 and a last-fence reader 0.2,
    against the unchanged 0.1.
  - **Guard.** `section-resolution.test.ts` checks every context fixture
    against both fence-order readers.
  - **Scope.** Conformance evidence included in the 2.16.0 generation. The rule, expected
    results and counts are unchanged.

- **First-fence hardening after PR #240.** The successful no-context cases
  `variant-01`, `-02`, `-04` and `-10` now prepend a non-selected
  `producer-b-note` junior fence (2,000,000). The original selected block
  (6,000,000) is in the middle, before the original junior (1,000,000).
  - **Distinct rules preserved.** Unique primary, default key, unique declared
    senior and an unclaimed senior falling back to primary still decide their
    respective cases. No primary or matching-role collision is introduced.
  - **Guard and mutants.** `section-resolution.test.ts` discovers every
    successful non-null no-context variant case and pins the selection reason.
    A built resolver that validates the selection and then returns the first
    fence passed 43/43 default calculation checks and 42/42 portable cases before
    this change. First- and last-fence mutants now fail all four in both runners.
  - **Unchanged.** Expected 0.6, Protocol/RFC/package state, 675 default checks
    and 101 portable cases. This conformance evidence is included in the 2.16.0 generation.

## Released student bed-count contract (RFC 0069)

[RFC 0069](../rfcs/0069-student-rent-roll-bed-counts.md) was accepted on
**2026-10-02**. It declares four OPTIONAL fields on the top-level §4.3
`rent_roll`: `occupied_beds`, `preleased_beds`, `preleased_as_of` and
`preleased_term_start`. The `STUDENT_HOUSING_PACK` already read the two counts,
and its formulas do not change.

- **A stated count is a complete fact.** It must be a nonnegative integer
  (`BED-01`), within `property.total_beds` (`BED-02`), and dated:
  - `occupied_beds` on a real roll `as_of_date` (`BED-03`);
  - `preleased_beds` with both pre-leasing dates present (`BED-04`), real
    (`BED-05`) and in order (`BED-06`).

  Every `BED` code is an error.
- **Absence is not an issue.** A roll without the counts draws nothing, and
  `occupancy` and `pre_lease_rate` stay `null`.
- **Nothing is derived.** No rule compares the two counts, or a date with the
  clock.
- **Scope.** The rules read the property-level roll's payload under RFC 0040
  selection. They do not extend to `senior_housing` or to a `mixed_use`
  component. Another class that states the fields draws no issue for doing
  so, but the rules apply to what it states.
- **Not in scope.** Future-phase capacity is deferred, and `BED-02` is not
  weakened for it. CC-13's acceptance of any finite `total_beds` is a separate,
  pre-existing size-validation concern.
- **Version.** Published core/CLI **2.16.0** pair with stable Protocol
  **2.20.0** and unchanged Format **2.0**. RFC 0069 is `implemented` after
  independent post-publication verification. The tag retains its accepted
  release-prepared lifecycle wording.

## Release records true of their tag (UPSTREAM-020)

StackUW's re-vendor of `v2.15.0` found that the tagged tree calls its own
generation unreleased, and `v2.14.0` does the same:

- `VERSIONS.md` labels the packages `(candidate; …)` and the Protocol
  `(accepted, unreleased)`;
- the rows flipped only in the post-release reconciliation, after the tag.

Per the owner's 2026-10-02 decision, the fix covers future tags. Both
historical tags stay as they are, and no `v2.15.1` is cut.

A generation now passes through three states with distinct records. See
[wiki 11](11-build-release-governance.md#the-three-release-states).

1. **Candidate.**
2. **Release-prepared.** This is the commit the owner tags. Its records are
   final and publication-neutral:
   - a dated heading;
   - no candidate, unreleased or `published <previous>` wording for the
     generation;
   - exact core/CLI/protocol pairings;
   - a protocol status such as "Accepted release contract".

   It has no `### Released`, and the RFC stays `accepted`.
3. **Released and verified.** This is the post-publication reconciliation. It
   adds `### Released`, the publication statements, the run, registry,
   provenance and Rekor evidence, and the RFC's move to `implemented`.

The guards:

- `verify-release` enforces state 2's records once the heading is dated.
- It requires a tag for every `### Released`, with no exemption.
- `release.yml` re-runs it with `--tag` before publishing.
- Its tests pin the `v2.15.0` shape as failing, and the real `v2.14.0` and
  `v2.15.0` tags as unmoved.

## Remaining work

- [RFC 0075](../rfcs/0075-hedge-senior-role-preference.md) (#266, merged as
  PR #276) and [RFC 0076](../rfcs/0076-hedge-checks-under-refused-selection.md)
  (merged as PR #277; D1–D7 accepted 2026-10-06) shipped in 2.19.0 with
  Stable Protocol 2.23.0 and are **implemented**
  ([publication record](../releases/2.19.0-publication.md)).
- [RFC 0077](../rfcs/0077-exit-proceeds-with-junior-capital.md) (#278; D1–D6
  accepted 2026-10-07; PR #279) shipped in 2.19.0 under Format 2.0 and is
  **implemented**. StackUW moves its common residual to
  `net_proceeds_to_common_equity`.
- Decide RFCs 0068 and 0067, in that order. No post-sale settlement
  category or lag is authorized. Reserve-account, financing, investor-tax and post-sale work remain
  separate contracts.
- [RFC 0071](../rfcs/0071-calendar-date-predicate.md) and
  [RFC 0074](../rfcs/0074-module-declaration-override-semantics.md) shipped
  in 2.18.0 and are **implemented**
  ([publication record](../releases/2.18.0-publication.md)). Both §X floors
  are `>=2.22.0`.
  - RFC 0071: PR #250. No current module
    calls the predicate.
  - RFC 0074: see the 2026-10-05 dependent-overrides entry below. The 23
    overriding registry fixture manifests declare the floor. No first-party
    or corpus module overrides.
  - RFC 0068 is to adopt the predicate in a later revision of its own. No
    numeric-type predicate is authorized.
- [RFC 0064](../rfcs/0064-property-reserve-account-roll-forward.md) (PR #290) shipped in 2.20.0 with Stable Protocol 2.24.0 and is **implemented** ([publication record](../releases/2.20.0-publication.md)): optional source-attributable `reserve_accounts` §4.28 and separate custody-balance verification. RFC 0045 reserve refusal stays unchanged. Draw-to-expenditure binding is RFC 0065 (§VIII.12, below); PR #219 remains abandoned. Format is 2.0.
- [RFC 0072](../rfcs/0072-frontmatter-scenario-semantics.md) (#255; PR #285)
  shipped in 2.20.0 with Stable Protocol 2.24.0 under Format 2.0 and is
  **implemented**.
- [RFC 0065](../rfcs/0065-reserve-draw-gross-expenditure-binding.md) (PR #293)
  shipped in 2.21.0 with Stable Protocol 2.25.0 under Format 2.0 and is
  **implemented** ([publication record](../releases/2.21.0-publication.md)).
- [RFC 0078](../rfcs/0078-protocol-is-verification.md) (PRs #298–#300, #303,
  #304), [RFC 0079](../rfcs/0079-metric-precision.md) (PR #301) and
  [RFC 0080](../rfcs/0080-official-classes-are-builtins.md) (PR #302)
  shipped in 3.0.0 with Stable Protocol 3.0.0 under Format 2.1 and are
  **implemented** ([publication record](../releases/3.0.0-publication.md)).
  RFC 0078's `@uwmd/verify` package split (D8) shipped as RFC 0083 (below);
  the levered and after-tax definitions (D7) remain a follow-up RFC.
- [RFC 0081](../rfcs/0081-one-format-one-protocol.md) (PRs #307–#312)
  shipped in 4.0.0 with Stable Protocol 4.0.0 under Format 3.0 and is
  **implemented** ([publication record](../releases/4.0.0-publication.md)).
- [RFC 0083](../rfcs/0083-verify-package-split.md) (PRs #317, #319, #320)
  shipped in 4.1.0 with `@uwmd/verify` 0.1.0 and Stable Protocol 4.0.0 under
  Format 3.0 and is **implemented**
  ([publication record](../releases/4.1.0-publication.md); see
  [the split](#released-in-410-the-uwmdverify-split-rfc-0083-2026-10-13)).
- Contract a total-debt-service input over `capital_stack` (RFC 0026) so a
  multi-tranche `cash_on_cash` can compute. RFC 0066 leaves it refused rather
  than senior-only.
- Speculative leasing needs explicit renewal/vacancy, rent reset and TI/LC timing
  rules with an adopter example. Array iteration alone does not supply them.
- Reverse import, structural workbook edits, period defaults and cash-flow
  metric Excel export remain separate extensions.
- Waterfall extensions, per-value currency identity and stochastic VOI need
  bounded contracts. Retrieval and standalone optional-package publication remain
  demand-gated. DOCX remains scoped out by the owner.
- Exercise `@uwmd/lake` beyond a single local load. The 2026-09-16 run proves a
  real PostgreSQL 18 accepts the DDL and the corpus, but **not** network
  behaviour, concurrent writers, a managed service, or that the GIN index earns
  its keep — the planner did not choose it at corpus scale.
- RFCs 0055–0059 type structures **nothing yet consumes**. No rent
  escalates, no break is exercised, no balance amortizes, nothing is priced and
  no strike crossing is projected. Typed-but-inert is the intended state until a
  verifier is specified for each; it is not a gap to be closed by inference.
- The RFC 0054 periodic ledger is unbuilt **by decision, not oversight**. It
  needs a named consumer *and* a calc-grammar answer for collections and a
  second period dimension before it is reachable from pack formulas at all.
  See [the calc-engine limits](10-conventions-invariants.md).

Historical implementation/preparation details are [archived](13-status-history-2.8.0-preparation.md).
They do not describe current release status.

## 2026-10-03 — Multifamily deal-level cash-on-cash correction

The multifamily pack is 1.0.1 in source. Generic `cash_on_cash` uses total
invested equity (`sources_uses.equity_metrics.equity_total`) and the stated
year-1 DCF levered cash flow, falling back to NOI minus debt service when the
year-1 flow is absent. Missing sponsor/LP allocation does not block it; missing
aggregate equity leaves it uncomputed. The debt fallback keeps RFC 0066's
role-free refusal on ambiguous multi-tranche maps. Excel uses the same formula.

This corrects implementation drift from Format §4.19. No sponsor/LP metrics,
format/protocol/schema changes were included in that correction. The correction
is carried by the 2.17.0 generation above. Other packs'
sponsor-denominator formulas remain follow-up work. Synthetic GD05-style
coverage uses public invented inputs, never private corpus amounts.

## 2026-10-04 — Early-year day-count correction

The early-year day-count bug is corrected; core/CLI 2.18.0 carries the fix.
- **Contract.** Protocol §VIII.9.1 already states actual-day counts on the
  proleptic Gregorian calendar. The fix moves no version, and no RFC was
  needed.
- **Root cause.** `actualDays()` in `calc/day-count.ts` counted through
  `Date.UTC`, which ECMAScript defines to read a numeric year 0–99 as
  1900–1999. The `CF-02` date-ordering check in `validator.ts` used the same
  call.
- **What it broke.** For dates in years `0000`–`0099`:
  - `actual/365f` and `actual/360` were wrong, and so were `xnpv`, `xirr`, the
    cash-flow verifier and the waterfall accrual that build on them;
  - `0000-01-01`→`0001-01-01` counted 365 days instead of 366;
  - `0099-12-31`→`0100-01-01` counted −693,959 days instead of 1;
  - correctly ordered early-year series were refused, and reversed ones were
    accepted.
- **Fix.** Both sites now use one integer `dayOrdinal`, built on the same leap
  rule and month lengths `parseISODate` validates against. Neither uses
  `Date` any more.
- **Scope of the change.**
  - Every valid date in years `0100`–`9999` gives exactly the same result as
    before.
  - `30/360us` reads date parts directly and was never affected.
  - `is_calendar_date` (RFC 0071) only checks validity and is unchanged.
- **Coverage.** Regression and independent-oracle tests, plus three
  `conformance/cash-flow` fixtures:
  - `calc-early-year-day-count`;
  - `valid-early-year-ordering`;
  - `reject-early-year-unordered`.

## 2026-10-04 — Adopter feedback intake

Adopters and independent implementers now report through three structured
issue forms: bug or interoperability, spec question, and capability request.
[`docs/FEEDBACK.md`](../FEEDBACK.md) defines the evidence, the deal-data
boundary, the label taxonomy and the lifecycle. The rest is in the
[review](../reviews/2026-10-04-adopter-feedback-loop.md).
- **Drift repaired.** Three of the five labels the old forms applied did not
  exist on GitHub, so they were silently dropped. `.github/labels.json` now
  lists all 16 labels; `labels.yml` creates them on merge, and the
  `verify-issue-forms` CI guard holds the forms and the guide to the manifest.
- **Not yet exercised.** No issue has been filed through the new forms, and
  the labels exist on GitHub only after the merge runs `labels.yml`.
- **No protocol change.** No report envelope or diagnostic object was added.
  The manifest, validation codes, `ProtocolError`, receipts and the runner
  report already carry what a report needs.
- **Owner decisions left open:** whether to offer a private channel for
  confidential, non-security reproductions, and whether to enable GitHub
  private vulnerability reporting alongside the security mailbox.

## 2026-10-05 — Unrelated module declaration conflicts enforced (Protocol §VII.3)

The reference registry now enforces §VII.3's existing MUST, the defect the
renamed-identifier review found.
- **What is refused.** Two unrelated modules declaring one section id,
  calculation id or view-model `section_id` refuse the whole registry with
  `PROTO-MOD-080`, `-081` or `-082`, in either order.
- **What "unrelated" means here.** No `depends_on` path joins the two in
  either direction. Sibling dependents of one module count as unrelated.
- **Classification.** `bug` plus `conformance-gap`. No RFC and no version
  change.
- **Deferred to RFC 0074, now implemented (next entry).** Pairs joined by
  `depends_on`, and the dependent-override semantics, were split out of
  PR #267 at the normative boundary.
- **Guard.** `modules.test.ts` covers this, along with scenarios 01–04 of the
  `conformance/modules/registry/` suite.
- **Left open.** Two view models for one `section_id` inside one manifest
  are outside §VII.3 and are not refused.

## 2026-10-05 — Dependent declaration overrides (RFC 0074 accepted and implemented)

[RFC 0074](../rfcs/0074-module-declaration-override-semantics.md) defines
what Protocol §VII.3's "the dependent module's declarations override"
means. The owner decided O1–O3 on 2026-10-05 and accepted it by merging
the implementation, PR #273, on 2026-10-06.
- **Implemented.** The registry tracks one owner per id and namespace.
  - Only a direct `depends_on` on the current owner authorizes an
    override. Otherwise the code is `080`–`082` (O1).
  - `PROTO-MOD-083` refuses an override that leaves a prior-result reader
    unserved (O2, order-independent).
  - `PROTO-MOD-084` refuses an override narrower than the overridden
    module's scope.
  - The runtime evaluates only the effective calculation and checks only
    the effective section.
- **Restored from design evidence.** The code and tests are #267's
  `31ccff4`, which the reduction `7dc78b8` removed. `main` was
  byte-identical to `7dc78b8` on those paths. They were checked against
  the final RFC text and owner decisions: O1's direct-dependency rule and
  O2's reader rule were already what `31ccff4` enforced.
- **Specs.** Protocol §VII.3 states the rules, and §X states the O3 floor.
  The floor follows RFC 0071's precedent: no loader check or code beyond
  the existing `PROTO-MOD-030`.
- **Conformance.** `conformance/modules/registry/` has 24 scenarios. Every
  scenario from 05 on fails against the pre-RFC implementation, except
  22, a sibling refusal #267 already made.
- **Review fixes.** An independent review found two defects in `31ccff4`,
  both now fixed with tests:
  - a replacement that reads its own id loaded and evaluated to `null`.
    It is now refused with `083` (scenario 20).
  - in a chain, `getModuleCalculationsForAssetClass` listed the effective
    declaration twice.
- **Release.** Protocol 2.22.0 carries the rules in the 2.18.0 preparation.
  The RFC stays `accepted` until that release ships.

## 2026-10-06 — Rate hedges read from the senior loan (#266, RFC 0075)

StackUW (UPSTREAM-024) reported that the hedge and escrow rules registered no
role preference. With a `senior` and a `junior` `debt_structure`, neither keyed
`default` or `base`, the hedge was refused (HDG-08). With the junior keyed
`base`, the hedge rules read the junior, and the senior's outright replacement
funding passed unchecked. All seven of the issue's documents reproduced on
`main` at `b042af2`.
- **Contract.** [RFC 0075](../rfcs/0075-hedge-senior-role-preference.md)
  registers `senior` on `debt_structure` for `HDG-01`–`HDG-10` and `ESC-04`,
  as one shared selection. That is the preference CC-02/03/05/09 already use.
  Format §5.3 and §4.7 and Protocol §V.12.1 step 1 say so. The PR that
  carries the RFC also implements it, and merging it records the acceptance.
- **Implemented.** `CROSS_CHECK_ROLE_PREFERENCE` gains eleven entries. The
  validator's hedge pass and `checkReplacementFundingStructure` (which the
  async verifier shares) pass a hedge rule code to the existing resolver. No
  other API changes.
- **Not changed.** `sources_uses` selection, refusal on two seniors,
  component exclusion, RFC 0070's exact-variant reference, and role-free
  documents. A hedge stated only on a non-selected junior is not read (D3).
- **Conformance.** Six `hedge/0075-*` cases, also run by the v2 driver.
  Against the pre-RFC code, all but `0075-two-seniors` fail; that one pins the
  refusal this RFC keeps.
- **Merged.** PR #276, 2026-10-06, which records the acceptance. Its one
  unresolved question is answered by RFC 0076, next entry.
- **Release.** Published in core/CLI 2.19.0 with Stable Protocol 2.23.0;
  `implemented` after independent verification.

## 2026-10-06 — Hedge checks under a refused selection (RFC 0076 accepted and implemented)

[RFC 0076](../rfcs/0076-hedge-checks-under-refused-selection.md) answers
RFC 0075's unresolved question. The owner accepted D1–D7 as recommended on
2026-10-06, and PR #277 implements them.
- **Measured first.** Every refusal path behaved alike: two `senior`, two
  `primary`, two `junior`, and components only. A role-free
  `debt_structure` never refuses, because the parser keeps one block. A
  stated hedge was checked only if it stated `replacement_funding`.
  Otherwise it was silent, malformed or not, and ESC-04 misreported a lawful
  replacement escrow. The same false ESC-04 occurred when `sources_uses` was
  the refused selection.
- **Contract.** One `HDG-08` for any stated hedge whose loan or cash lines
  cannot be selected. No rule that needs the refused side is evaluated; on a
  refused `sources_uses` the debt-only rules still run. The verifier reports
  `unresolvable_source`. Format §4.7/§4.8 and Protocol §V.12.1 say so.
- **Implemented.** `checkReplacementFundingStructure` sets an internal
  `selectionRefused` flag, kept apart from `unresolvable` (which a missing
  cash-flow variant also sets), and the validator skips ESC-04 on it. No
  export or type changes.
- **Not changed.** An absent `sources_uses` or `uses` still gets ESC-04.
  Documents with no stated hedge, resolvable documents, CC-16 and coverage
  are unchanged.
- **Conformance.** Eight `hedge/0076-*` cases. Against the RFC 0075 code all
  fail except the no-hedge control, which pins D7. Decided unit tests
  replace RFC 0075's two `undecided:` pins.
- **Release.** With RFC 0075, published in core/CLI 2.19.0 with Stable
  Protocol 2.23.0; `implemented` after independent verification.

## 2026-10-07 — Exit proceeds with junior capital (#278, RFC 0077 accepted and implemented)

StackUW (UPSTREAM-025) asked what `exit_analysis.net_proceeds_to_equity`
means beside a §4.24 `preferred_equity` tranche. §4.9 never said, and
`deriveDCF` footed it as `exit_value_net − loan_balance_at_exit`.
- **Verified, and more.** The repro gave 3,800,000 beside a stated
  2,300,000. Only the web editor re-derives the field; the CLI and Excel
  converter never read it, contrary to the report. The editor's footed
  models write every footed value over the stated one on each edit, so a
  stated common residual was silently replaced. Mezzanine debt left the
  same ambiguity in `loan_balance_at_exit`.
- **Contract.** [RFC 0077](../rfcs/0077-exit-proceeds-with-junior-capital.md),
  D1–D6 accepted by the owner on 2026-10-07. `net_proceeds_to_equity` is the
  whole equity stack after all debt (footing unchanged), and
  `loan_balance_at_exit` repays every debt-class tranche. A stated, never
  derived, `preferred_equity_redemption_at_exit` gives a footed
  `net_proceeds_to_common_equity`. StackUW's reading (a), which redefined the
  field as common's, was declined: it would make one field mean two things.
- **Implemented.** `deriveDCF`, the editor's DCF model (redemption input,
  common row; also checked in the running editor) and the report. Format
  §4.9 states the definitions. No export or type changes.
- **Proof.** Tier-1 fixture 17 validates clean, and `deriveDCF` foots
  exactly its stated figures. Five new footing tests fail against the
  previous code. No existing baseline changed.
- **Release.** With RFCs 0075 and 0076, published in core/CLI 2.19.0;
  `implemented` after independent verification.

## 2026-10-04 — Renamed identifiers (#263, draft RFC 0073)

Issue #263 (StackUW `UPSTREAM-023`) asks for previous ids on module and
implementation manifests after a namespace move. The
[review](../reviews/2026-10-04-renamed-identifiers.md) finds:

- **Module ids.** Only the asset-class id resolves a document. Renaming a
  module id alone leaves old documents resolved.
- **Class ids.** Renaming one breaks old documents unless the renamed module
  keeps declaring the retired id. Keeping it works on every current host.
- **Implementation ids.** Nothing resolves, persists or verifies by one.

Draft [RFC 0073](../rfcs/0073-previous-asset-class-identifiers.md) proposes
`previous_ids` on `declares_asset_classes[]` entries only. It waits on the
reporter's answers and owner acceptance. Nothing is defined or shipped.

- **Found on the way:** the reference registry does not enforce Protocol
  §VII.3. Two unrelated modules declaring one calculation id both load, and
  registry order decides the threaded result. This is recorded in the review
  and not fixed here. `MOD-ASSET-CLASS-CONFLICT-001` has no conformance
  fixture.
- **Guard.** Three `asset-class.test.ts` tests pin current rename behavior.
  The review's `.repro.mjs` exits 1 if any finding stops reproducing.

## 2026-10-04 — ProtocolError category lockstep

Protocol §XI and `protocol-error.schema.json` now list the `package` and
`portfolio` categories that `ProtocolErrorCategory` and the reference
implementation have used since RFC 0018 and RFC 0015 (2.1.0) shipped.
- **Classification.** Schema and protocol-text omission (`drift`) of
  already-shipped behavior. The 2.1.0 release record announced `portfolio`
  as a new error category, but neither mirror was updated.
- **No RFC, no version change.** The fix only widens the enum. No
  conformance case changes, and no implementation gains a new obligation,
  because neither RFC binds its codes to a category.
- **Guard.** A `protocol.test.ts` suite checks the union, the schema and §XI
  against each other, and validates emitted refusals against the schema.

## 2026-10-04 — `uwmd init --scenario`

`uwmd init --scenario <value>` now writes frontmatter `scenario`, as Format
§6.7 documents. It accepts only the twelve values §2.2 lists and refuses
anything else; before this fix it dropped the flag and always wrote `null`.
- **Classification.** Implementation drift from §6.7. No RFC and no version
  change.
- **Still undefined.** No `scenario` value has a defined meaning, and no
  validator, pack or cross-check reads one. Defining them, including
  `build_to_rent` and a rule for a deal that fits several values, is issue
  #255 (StackUW `UPSTREAM-022`) and needs an RFC. Draft
  [RFC 0072](../rfcs/0072-frontmatter-scenario-semantics.md) carries the
  owner's 2026-10-04 direction: `scenario` names the business plan, stays
  single-valued with a closed vocabulary, and is descriptive only;
  `build_to_rent` is not a scenario but a product/subtype on `multifamily`.
  Field design, vocabulary and migration (R1–R8) remain RFC work, and the
  current free-string `asset_subtype` is not ready to carry a defined value as
  is. Nothing is defined or shipped.
- **Guard.** `init.test.ts` holds the accepted list to the §2.2 line, and the
  CLI smoke suite covers a written value, an unlisted value and a bare flag.


## 2026-10-09 — RFC 0072 business plans and single-site BTR identity

The dated 2026-10-04 “Still undefined” note above is superseded by this entry.

[RFC 0072](../rfcs/0072-frontmatter-scenario-semantics.md) is `accepted` with
its implementation in the same PR; the merge is acceptance. `scenario` now
names one execution strategy from eight standard plans or a reverse-DNS
extension. `INIT_SCENARIOS` narrows from 12 to 8 values; init also accepts
reverse-DNS extensions and refuses retired/unlisted bare arguments.
`--asset-subtype build_to_rent` identifies single-site BTR on multifamily,
independently of its actual plan. No new class/module or financial behavior.

- **Compatibility.** DQ-07–09 are warnings only in both format generations.
  No existing valid document gains errors. Subtypes remain open; the 28
  pre-RFC free-value corpus files and Sundance's unlisted plan are not migrated.
- **Identity.** Frontmatter subtype governs; property is a fallback when
  absent/null. Only BTR agreement and class scope add checks.
- **Guards.** Core/CLI tests and the default `scenario` conformance suite pin
  standard/extension, absent/null, retired/malformed and BTR behavior. The v2
  CLI driver exercises the same fixtures. D5 regressions preserve stage,
  coverage, default and pack results.
- **Deferred.** General subtype taxonomy and legacy Appendix B terminology.
- **Release.** Published in core/CLI 2.20.0 with Stable Protocol 2.24.0;
  Format stays 2.0. `implemented` after independent verification.

## 2026-10-04 — `uwmd init` frontmatter serialization

`generateBlankUWFile` now writes every caller-supplied frontmatter value
through one serializer, and checks that the generated file reads back to
exactly the supplied strings. Before, values were pasted in unescaped. See the
CHANGELOG for the rule.
- **Relaxed after the reader repair.** A value with both quote kinds, or
  quotes and backslashes together, used to be refused. It is now written as
  one escaped double-quoted scalar by `writeDoubleQuotedScalar`, which sits
  beside the shared reader in `yaml-scalar.ts`. Physical line breaks,
  non-printable characters and lone surrogates are still refused: init
  writes single-line metadata, and the deal name is also the heading.
- **Classification.** Robustness defect in the writer. No spec or version
  change.
- **Coverage.** Each quoted field round-trips quotes, backslashes, colons,
  `#`, padding, YAML-looking scalars and non-ASCII text, checked against both
  the reference reader and the `yaml` library (a root dev dependency, used by
  the test only). Refusals and the CLI are covered too. With the old
  behavior, 29 of the new tests fail.
- **Writer → reader dependency, checked 2026-10-04.** The round-trip check
  makes `init.ts` import `parser.ts` at runtime. The runtime import closure
  of `init.ts` is `meta-shape.ts`, `parser.ts` and `types.ts`. None of them
  imports `init.ts`, so there is no cycle, and none imports a `node:` module
  or a package. `parseUWFile` is already exported from `@uwmd/core/browser`,
  so the browser entry gains no module. The check is pure, with no I/O or
  clock, and only adds refusals of values that would not read back.
  `UWInitError` stays internal to `init.ts`; it is not exported from either
  entry.
- **Found, then resolved** by the frontmatter YAML scalar repair below:
  - **Contract gap.** Format Appendix D lists single- and double-quoted
    scalars but does not say whether YAML escapes (`\"`, `\\`, `''`) apply
    inside them. The reference reader (`parseScalar` in `parser.ts`) keeps
    quoted content verbatim, while any YAML library unescapes it, so the same
    file reads differently. A separate review classifies this and the two
    items below; no parser change is part of this fix.
  - **False rejections.** The reader's unsupported-feature pre-pass scans
    inside quoted values, so a legal value such as `"Smith: &Co"` is rejected
    as an anchor. `init` refuses such values instead of writing them.
  - **Stale citation.** `parser.ts` and its `UNSUPPORTED_YAML_FEATURE`
    message cite "Appendix A" for the YAML subset. Appendix A is file
    naming; the subset is Appendix D.

## 2026-10-04 — Frontmatter YAML scalar semantics

Both frontmatter readers now read admitted scalars with their YAML 1.2
meaning. The owner confirmed on 2026-10-04 that supported constructs keep
their YAML 1.2 semantics unless the Format narrows them. That reconciles the
existing contract, so no RFC was needed. The
[review](../reviews/2026-10-04-frontmatter-yaml-subset.md) has the analysis.
- **Contract.** Format Appendix D gains a "Scalar semantics" paragraph, and
  Lite §3 points to it. The Protocol error table and the reader's citations
  now name Appendix D. No version moves.
- **Readers.** `parser.ts` and `lite.ts` share `yaml-scalar.ts`:
  - double-quoted escapes and single-quoted `''` are decoded;
  - quoted `&`, `*` and `!` are content;
  - a trailing comment is not part of a value;
  - flow mappings and non-empty flow sequences are refused.

  So a Tier-2 `frontmatter_set` or a UW JSON → UWX conversion now reads back
  exactly.
- **Conformance.** New document positive fixture `16` (its parsed baseline is a
  YAML library's reading), document refusals `11`–`14`, Lite positive `08` and
  Lite refusals `13`–`15`. Before the reader change, exactly the 8 new cases
  failed. After it, no existing baseline changed.
- **Compatibility.** A quoted value that is not valid YAML is now refused
  with `UNSUPPORTED_YAML_FEATURE` (Lite: `LITE_FRONTMATTER_SYNTAX`). That
  covers an undefined escape such as `"C:\deals"`, an unescaped inner quote
  such as `"a"b"` or `'O'Brien'`, an unterminated quote, and content after
  the closing quote. Flow values are refused too (Lite:
  `LITE_FRONTMATTER_NESTING_UNSUPPORTED`). Plain values ending in ` # …` lose
  the comment, and `key: # …` now opens a block or reads as null. No corpus
  document was affected.
- **Not changed.** The Lite reader still does not detect anchors or tags
  outside quotes, and Lite `key: []` still reads as before. Plain-scalar
  typing is unchanged in both readers.

## 2026-10-09 — RFC 0064 property reserve accounts

Optional `reserve_accounts` records explicit property custody facts across asset classes. Ordinary validation checks closed shapes, sources, classes, dates and order (`RSV-01`–05); `verifyReserveAccounts` / `verify-reserve-accounts` separately checks the stated identity and explicitly claimed continuity at the existing currency quantum (`RSV-06`–08), preserving source digest and item evidence. No gross expenditure netting or RFC 0045 admission is added. Release: published in core/CLI 2.20.0 with Stable Protocol 2.24.0; Format stays 2.0. `implemented` after independent verification.

## 2026-10-10 — RFC 0065 reserve draw bindings

The optional external reserve draw binding plan and §VIII.12 verifier use RFC 0064 account identities and exact source variants, complete selected-draw allocation, explicit expenditure funded shares and the shared currency quantum. `RDB-01`–09 codes, schemas, browser/API exports and a read-only CLI ship with synthetic conformance and cent negative controls. Ordinary validation, gross expenditure and RFC 0045 reserve refusal are unchanged. External-transfer verification and owner-cash/financing assembly remain future contracts. Release: published in core/CLI 2.21.0 with Stable Protocol 2.25.0; Format stays 2.0. `implemented` after independent verification.

## 2026-10-10 — RFC 0078 phase 1: the Protocol is verification

RFC 0078 (accepted 2026-10-10) separates the standard from the starter products. Phase 1 rewrites Protocol §0, §I and §II around two tiers, **Reader** and **Verifier**, plus six optional profiles (`module`, `integrity`, `representations`, `portfolio`, `sensitivity`, `stochastic`), and retitles the document "UW Protocol — verification" (filename unchanged). Display conventions, view models, byte-preserving editing, multi-variant and frontmatter edit rules, the fallback cascade and default tables, refinement, workbook bindings, the AI host contract and capability tokens moved verbatim to the non-normative [starter products guide](../starter/README.md); the Protocol keeps a stub at each old heading. `ImplementationManifest.tier` is now `reader | verifier` with a `profiles` list; the four 2.x values stay accepted, deprecated, during 3.x (`readConformanceTier`). The reference manifest claims `verifier` with all six profiles. This is the Protocol 3.0.0 contract. Release: published in core/CLI 3.0.0 with Stable Protocol 3.0.0 (phase 5); `implemented` after independent verification.

## Official builtin classes (RFC 0080)

All twelve official classes are full builtins, including `data_center` and `manufactured_housing`. Their normative metric definitions and size selectors live in `spec/metrics/`, with bidirectional pack/registry parity tests. Both new packs use all six RFC 0079 standard income definitions, including equity_total-based cash-on-cash. Source size is `property.critical_it_load_kw` or `property.total_sites`, mirrored against the detailed capacity/site count. They have Excel layouts and starter defaults, and take the base stage lists verbatim like multifamily (no stage overlay; a missing `rent_roll` is DQ-06). Default tables are owner-approved starter proxies (2026-10-10), never verification inputs; data center publishes no expense-ratio default, so producers state it.

Hospitality owns `hotel_metrics`, `hotel_brand` and `hotel_food_beverage`; its sole RevPAR definition stays rooms revenue divided by available room nights. Official module packages are compatibility shells only. They shipped 0.2.0, their final version, in the 3.0.0 transition release, and the owner deprecated both names on npm on 2026-10-11; RFC 0081 removed them from the repository and the release workflow, and 4.0.0 publishes seven packages. Release: published in core/CLI 3.0.0 with Format 2.1 and Stable Protocol 3.0.0; `implemented` after independent verification. Through 3.0.0, legacy `org.uwmd.data_center` read without source/digest mutation (CLS-01) and official module dependencies were satisfied by core (CLS-02); from 4.0.0 (RFC 0081) the alias is `INVALID-ASSET-CLASS-002` and `CLS-01`/`CLS-02` are retired. Third-party classes remain module extensions.

## 2026-10-10 — RFC 0078 phase 4: project docs

Phase 4 (docs only) carries the standard/starter split into the project's own guidance. `AGENTS.md` gains a "standard vs starter products" orientation, names the metric dictionary and receipts in the contract, and marks the module packages as compatibility shells; invariant 4 (Excel ↔ engine parity) and invariant 3 (byte preservation) are starter-product quality bars, still blocking, with their numbers unchanged because source comments cite them. Wiki 04 and 05 reframe the engine and packs as starter code over the normative dictionary and §VIII notation; wiki 10 labels each invariant's layer; wiki 11 adds the Protocol 3.0 versioning rule, the starter-product RFC rule and an updated "needs an RFC?" table. The docs site's navigation splits into **Standard** and **Starter products**. No spec, schema, protocol or conformance change. Release: published in 3.0.0.


## 2026-10-11 — RFC 0078 phase 3: corpus owners and selectors

Every existing reference case is tagged exactly once as Reader, Verifier, one
optional profile or a starter-product check. All 1,056 reference checks
(1,053 previously default + three opt-in agent shapes) now run by default;
all 332 portable cases retain their commands, arguments, capabilities and
expectations. Legacy paths stay stable and no fixture/baseline is changed.
Reports separate product counts; both drivers accept deprecated tier aliases
through generated `readConformanceTier` readings, without inferring profiles.
Coverage guards reject missing, duplicate and unclassified cases. The lender-only
metric fixture remains 187 verified / 0 failed / 0 unverifiable. Review
follow-up: the §II.2 Verifier requirements own their cases (IRR, dictionary
reproductions, §VIII.1–VIII.3 notation incl. `date-*`/`period-*`/`variant-*`,
the no-stack capital-stack pins), Lite compilation and the package-context
invariants move to Representations, and five new validate-only Verifier checks
(`CUR-01`, `LOC-01`, `SRC-01`, `POL-01`, `POL-02`) bring the reference total to
1,061 (Verifier 679 / 280 portable, Module 68 / 1). Release: published in
core/CLI 3.0.0 with Stable Protocol 3.0.0.

### Cloudflare static-host preparation

The owner-directed `codex/site-cloudflare-migration` branch contains direction C
first, then Workers static-asset configuration. `tools/docs-site/README.md` gives
the exact build, watch-path and project settings. Merged in #391; the owner
then moved uwmd.org to the Cloudflare Worker `uwmd-org` and disconnected Vercel,
and the Vercel configuration was removed from the repository.
