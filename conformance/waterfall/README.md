# conformance/waterfall

Fixtures for the `distribution_waterfall` section (RFC 0035, UW_FORMAT_SPEC
§4.27 / Protocol §VIII.10): the WF-01…WF-03 structural rules and the
three-state `verifyWaterfall` verifier, which recomputes the **entire
allocation** — period by period, tier by tier — never trusting the stated
splits.

Scenario kind is dispatched by the files a directory carries (see
`scripts/run-conformance.mjs`):

- `case.json` + `expected.json` — `{waterfall, series}` run through
  `verifyWaterfall` (`series: null` = the WF-02 situation reaching the
  verifier); `expected.json` pins the verdict (and optionally one issue
  code).
- `deal.uwx.md` + `expected.json` — a full document run through the
  validator; `expected_codes` must each appear.

The classic case is **fully hand-worked** (see `waterfall.test.ts` for the
arithmetic on paper): $1.0M at 90/10, ROC → 8% simple pref → 100% GP
catch-up to 20% → 80/20 residual, chosen so every year fraction is exactly
1.0 and every tier figure an exact decimal. The catch-up lands the GP at
exactly 20% of profit; only the per-party XIRRs come from the engine (the
§VIII.9.3 procedure, quantized at 6dp).

| Scenario | Pins |
|---|---|
| `verify-classic-outcomes` | All eight hand-worked outcomes + both XIRRs → `verified`. |
| `verify-classic-schedule` | The same, plus the per-date per-tier schedule cell-for-cell. |
| `verify-compound-pref` | `compound_annual` accrual (unpaid pref compounds): promote 200,000 vs simple's 200,640. |
| `verify-em-hurdle-boundary` | An 80/20-to-1.5x tier caps mid-distribution and hands off to 60/40. |
| `verify-no-catchup` | A pref-then-split ladder — the singletons are optional. |
| `verify-promote-overstated` | A promote off past the cent → `failed`, `WF-OUTCOME-DISAGREES`. |
| `verify-moic-no-contributions` | Stated GP MOIC with zero GP contributions → `unverifiable`, never `failed`. |
| `verify-unresolvable-series` | `series: null` (WF-02 reaching the verifier) → `unverifiable`. |
| `reject-out-of-order` | Pref before ROC → WF-01. |
| `reject-capped-final-split` | A capped terminal tier → WF-01 (ladders need an uncapped residual). |
| `reject-gp-share-le-target` | `gp_share ≤ target_promote` → WF-01 (the tier could never fill). |
| `reject-reserved-irr-hurdle` | `until_lp_irr` → WF-01 (reserved for a future RFC). |
| `reject-dangling-ref` | `cash_flow_ref.variant` that does not resolve → WF-02. |
| `reject-no-capital` | A referenced series with no contribution → WF-03. |
