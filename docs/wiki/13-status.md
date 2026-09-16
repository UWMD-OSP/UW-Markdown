# 13 — Build status (living document)

Reconciled **2026-09-16** against `main` at `6d4d520`.
The last release is **v2.10.0**: Core/CLI **2.10.0**, signing **0.2.14** and
batch **0.8.9** are published on npm with SLSA provenance. Format stays **2.0**;
Protocol is **2.14.0 on `main` and unreleased** — 2.13.0 is what shipped. Four
RFCs (0049, 0054, 0055, 0056) have landed since the release and are described
under [Unreleased on `main`](#unreleased-on-main). See
[VERSIONS.md](../../VERSIONS.md) and [ROADMAP.md](../../ROADMAP.md).

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

Web editor/viewer, docs site and VS Code extension are implemented. Standalone
Excel **0.9.1**, report **0.8.13**, and hospitality/data-center module packages **0.1.1**
remain unpublished. Core's RFC 0043 binding API is published; the full Excel
exporter remains available from source. Native Excel 16.0 build 20326 passed
14 scenarios / 48 cell checks. Reverse import of additional inputs refuses.

## Verification

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

Data-center conformance is structurally complete as a reference module: six
dedicated runtime scenarios, 26 module tests, 11 calculations, seven
validations, and explicit fallback/degraded behavior. The Mesa Gateway fixture
is synthetic and the module package remains unpublished, so adopter validation
is still open. The built-in library covers nine calculation packs; mixed-use is
composition rather than a standalone pack.

RFC 0048 is released in 2.10.0: standalone
document/package examples with their own `standalone` conformance suite.
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
circularity is not solved, because the calc engine has no iteration.

## Unreleased on `main`

Four RFCs have landed since v2.10.0. None is published; all of it ships in the
next cut.

**Protocol 2.13.0 → 2.14.0**, registering the `LSE-NN`, `HDG-NN` and `ESC-NN`
code families. No wire format, formula or precision change.

RFC 0049 — implemented as `@uwmd/lake` 0.1.0 (`packages/uwmd-lake`,
unpublished): a PostgreSQL/JSONB lake adapter that plans idempotent
digest-keyed upserts over six tables from canonical envelopes, `block_values`
facts, receipts, package manifests and source-evidence references. Raw
canonical JSON sits in `jsonb` beside typed shadow columns, so unknown
sections, extension keys, explicit nulls and array order survive a load. It
takes no database driver, changes no protocol or financial math, and refuses
bytes-bearing source evidence. 52 unit tests cover it against an in-memory
warehouse double; **no live PostgreSQL instance has been exercised**, so a real
load and the publication decision both remain open.

RFC 0054 — **accepted as a decision, with its second half deliberately not
built.** Per-lease economics split by shape: the lease clauses are typed in
place on the commercial rent roll (that is RFC 0055), and the per-lease
periodic series waits for a consumer. The reason is structural rather than
scheduling — the calc grammar addresses neither collections nor two period
dimensions, so a monthly ledger is unreachable from pack formulas. See
[the calc-engine limits](10-conventions-invariants.md).

RFC 0055 — the commercial lease clauses that were untyped stubs since Format
1.0 are typed: `escalation_schedule`, `termination_option`, `co_tenancy_details`,
plus `lc_original` / `lc_outstanding_balance` beside the TI pair, under the
`LSE-01`–`LSE-09` family. Escalation steps state the resulting rent rather than
the increment. **Nothing is exercised**: no rent escalates, no break is taken,
no remedy applies, no balance amortizes. Straight-line TI/LC amortization stays
with the deferred periodic series.

RFC 0056 — `debt_structure.rate_hedge` and `sources_uses.uses.escrows` are
typed under the `HDG-NN` / `ESC-NN` families. A cap carries a strike, notional,
term and a stated `post_expiration_assumption` instead of the lone
`rate_cap_pct`; escrows carry upfront and monthly amounts under a closed
vocabulary with a label-bearing `other`. `ESC-04` ties a `"replace"` assumption
to a funded `rate_cap_replacement` line — the budget a three-year cap on a
five-year hold never had anywhere to go. `rate_swap` and `rate_collar` are
reserved and refused by `HDG-02`, because their mark-to-market can be negative
and a cap's cannot. **Nothing is priced and no strike crossing is projected.**

Current `main` passes **1,891 core tests** plus every other workspace,
**542 default + 76 declarative conformance checks**, three capability profiles,
42 validated schemas across 43 indexed, lint, and the index/version/lockfile
guards.

## Remaining work

- Validate RFC 0045 against a real deal. Levered/tax, post-sale and reserve-rollforward
  extensions remain separate contracts; declared completeness is not verified
  economics.
- Speculative leasing needs explicit renewal/vacancy, rent reset and TI/LC timing
  rules with an adopter example. Array iteration alone does not supply them.
- Reverse import, structural workbook edits, period defaults and cash-flow
  metric Excel export remain separate extensions.
- Waterfall extensions, per-value currency identity and stochastic VOI need
  bounded contracts. Retrieval and standalone optional-package publication remain
  demand-gated. DOCX remains scoped out by the owner.
- Validate `@uwmd/lake` against a live PostgreSQL server. The suite proves the
  planned statements and their idempotency, not that a real server accepts the
  DDL or that the indexes earn their keep on a real corpus.
- The RFC 0054 per-lease periodic series is unbuilt by decision, not oversight.
  It needs a named consumer **and** a calc-grammar answer for collections and a
  second period dimension before it is reachable; see
  [the calc-engine limits](10-conventions-invariants.md).
- RFC 0055 and 0056 type structures nothing yet consumes. Escalation, break
  exercise, co-tenancy remedies, TI/LC amortization, hedge pricing and strike
  crossing are all still adopter-side. Typed-but-inert is the intended state
  until a verifier is specified for each.
- Cut a release covering protocol 2.14.0 and RFCs 0049/0055/0056. Until then
  `main` and the registry describe different validator tables.

Historical implementation/preparation details are [archived](13-status-history-2.8.0-preparation.md).
They do not describe current release status.
