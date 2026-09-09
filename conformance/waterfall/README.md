# conformance/waterfall

Fixtures for the `distribution_waterfall` section (RFC 0035 + RFC 0036,
UW_FORMAT_SPEC §4.27 / Protocol §VIII.10): the WF-01…WF-03 structural rules and the
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
| `verify-irr-hurdle-boundary` | RFC 0036. `−1,000,000` at t0, `+1,150,000` at t1, ROC → 80/20 `until_lp_irr` 0.12 → 60/40: the hurdled tier pays LP exactly 120,000 / GP 30,000 by the closed-form hurdle balance and nothing remains; LP `xirr` reads 0.12 at 6 dp. The regression pin for the identity itself. |
| `verify-irr-hurdle-crossing` | Same ladder, `+2,500,000` at t1: tier 1 fills at 150,000 and hands 1,350,000 to 60/40 — LP 1,930,000 / GP 570,000, cell-for-cell. |
| `verify-irr-ladder` | ROC → 80/20 to 10% → 70/30 to 15% → 60/40 over five rows at 90/10; each hurdled tier's fill pinned; LP `xirr` above 15%. |
| `verify-irr-hurdle-already-met` | A 20% simple pref lands the LP above the 12% hurdle before the hurdled tier: capacity 0, the tier appears in no schedule row, the residual split absorbs the cash. |
| `verify-irr-hurdle-interleaved-call` | A capital call after a distribution (`−1,000,000`, `+300,000`, `−200,000`, `+1,500,000`): the balance identity credits both ROC receipts and the mid-hold call — the case where "solve the IRR and compare" could diverge, resolved by definition. |
| `verify-combined-hurdles-irr-binds` | One tier stating `until_lp_em: 1.5` **and** `until_lp_irr: 0.12`; over a five-year hold the IRR balance exceeds the 1.5x headroom — the larger capacity governs. |
| `verify-combined-hurdles-em-binds` | The twin over a one-year hold: the multiple binds (LP 500,000 / GP 125,000). |
| `verify-compound-pref-then-irr` | 8% `compound_annual` pref → catch-up → 80/20 until 12% IRR → 60/40: pref receipts are LP inflows in `F`, so the hurdle balance already credits them. |
| `verify-no-catchup` | A pref-then-split ladder — the singletons are optional. |
| `verify-promote-overstated` | A promote off past the cent → `failed`, `WF-OUTCOME-DISAGREES`. |
| `verify-moic-no-contributions` | Stated GP MOIC with zero GP contributions → `unverifiable`, never `failed`. |
| `verify-unresolvable-series` | `series: null` (WF-02 reaching the verifier) → `unverifiable`. |
| `reject-out-of-order` | Pref before ROC → WF-01. |
| `reject-capped-final-split` | A capped terminal tier → WF-01 (ladders need an uncapped residual). |
| `reject-gp-share-le-target` | `gp_share ≤ target_promote` → WF-01 (the tier could never fill). |
| `reject-irr-hurdle-out-of-range` | `until_lp_irr: 1.2` and `until_lp_irr: 0` → WF-01. |
| `reject-irr-hurdle-non-increasing` | 15% then 12% → WF-01 at the second tier. |
| `reject-irr-hurdle-lp-share-zero` | `lp_share: 0` with `until_lp_irr` → WF-01. |
| `reject-irr-hurdle-on-final-split` | The terminal tier capped by IRR → WF-01. |
| `reject-dangling-ref` | `cash_flow_ref.variant` that does not resolve → WF-02. |
| `reject-no-capital` | A referenced series with no contribution → WF-03. |
