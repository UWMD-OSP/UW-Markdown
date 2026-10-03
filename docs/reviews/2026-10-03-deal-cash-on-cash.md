# Classification: generic cash-on-cash is deal-level

Owner direction: 2026-10-03.

## Evidence and decision

- Format §4.19's common-calculation table defines cash-on-cash in a specific
  year as year-N levered cash flow divided by total equity invested, using
  `sources_uses.equity_metrics.equity_total`. Format §4.8 separately represents
  sponsor/LP source contributions and aggregate equity; §4.9 represents annual
  levered cash flows. There is no normative sponsor-specific definition of
  generic `cash_on_cash` in the protocol or schemas.
- The schemas specify structural payloads and safe calculation declarations;
  they do not contract a sponsor denominator for this calculation ID.
- The existing multifamily implementation and wiki used
  `(NOI - debt service) / sources_uses.sources.equity_sponsor`. The no-stack
  capital-stack fixture and multifamily receipt issuance fixture supplied an
  all-sponsor amount and therefore failed to distinguish deal equity from a
  sponsor allocation. Generic receipt examples list the metric without a
  sponsor-specific definition.
- `deriveDCF` already computes annual cash-on-cash from levered cash flow and
  cumulative equity invested. That yearly denominator remains separate from
  the total-invested-equity denominator directed here.

Classification: an implementation defect against the existing generic meaning.
The owner authorized the correction, so no metric rename or normative RFC is
needed. No normative file, schema or public protocol type changes.

## Bounded implementation

Multifamily pack 1.0.1 reads stated year-1 DCF levered cash flow by year identity,
or the existing NOI minus debt-service fallback when it is absent. Both divide
by `sources_uses.equity_metrics.equity_total`. Missing total equity remains
uncomputed and is never inferred from sponsor contributions. Zero equity follows
the existing typed division-by-zero behavior. The role-free fallback retains
RFC 0066's refusal when debt blocks cannot be selected; a stated aggregate
year-1 flow does not require that fallback.

Sponsor/LP yield metrics are not introduced. Future `sponsor_cash_on_cash` and
`lp_cash_on_cash` need separate contribution and attributable cash-flow inputs;
they must remain uncomputed when those inputs are absent. Dividing deal cash
flow by one party's equity would not establish that party's yield.

Scope is multifamily and its Excel consumer. Other asset-class packs' existing
sponsor-denominator formulas remain visible follow-up work. No private Golden
Deals inputs are published: the GD05-style test is a synthetic shape reduction.
All financial evaluation remains in the deterministic calc pack and engine.
Refinement's existing conservative policy flags the conditional cash-on-cash
AST instead of attempting monotonic VOI bracketing; its implementation and
public diagnostic contract are unchanged.

The stale Excel input/import oracles used plain property traversal for the new
`annual_cash_flows.Y1.net_cash_flow_levered` binding. The repair independently
selects the row whose stated year is 1 only for that multifamily input; total
equity is still read directly from the corrected denominator's canonical path.
Other asset-class values and the mixed-use oracle are unchanged. The old core
test's “all pure ratios” assertion now pins only the existing conditional-AST
diagnostic for `cash_on_cash`.

HEAD is UTF-8 without a BOM. Byte inspection found an isolated Windows-1252
dash in the new Excel heading and a dash/section-sign in the new status paragraph.
Only those newly introduced bytes were replaced with their UTF-8 sequences;
pre-existing non-ASCII bytes and line endings were preserved.

The pack patch bump separates receipts for the corrected recipe from historical
1.0.0 receipts; an old version is unverifiable against a verifier holding only
1.0.1 (`RCP-06`). Receipt test baselines are refreshed with their scenario
mutations retained, and a dedicated historical-version regression pins refusal.
