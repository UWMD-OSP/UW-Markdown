// Deterministic DCF footing — the relationships inside a `dcf` block that follow
// unambiguously from the block's own stored inputs are footed here, so the editor,
// CLI, and Excel converter never disagree (invariant #4); plain arithmetic, never
// AI math (invariant #1).
//
// Scope is deliberately narrow and self-contained, in the same spirit as
// deriveValuation. We foot only what is an identity over stored fields:
//
//   Per projection year (annual_cash_flows[i]):
//     net_cash_flow_levered = net_operating_income − annual_debt_service
//     cash_on_cash_return   = net_cash_flow_levered / cumulative_equity_invested
//
//   Exit waterfall (exit_analysis):
//     disposition_costs       = exit_value_gross × assumptions.disposition_costs_pct
//     exit_value_net          = exit_value_gross − disposition_costs
//     net_proceeds_to_equity  = exit_value_net − loan_balance_at_exit
//
// Left as INPUTS on purpose (no unambiguous identity from stored fields):
//   - exit_value_gross — capitalizes a *forward* NOI by convention (year N+1),
//     which the block doesn't store; the trailing exit_noi alone can't foot it.
//   - returns.* (IRR / NPV / equity multiple) — depend on a cash-flow timing /
//     terminal-value convention; computing them here would invite silent drift.
//   - per-unit / per-sqft exit values — need the property section.

import { collector, numOrNull, type DerivedField } from './derived.js';

type Row = Record<string, unknown>;

const num = numOrNull;
const isObj = (v: unknown): v is Row => v !== null && typeof v === 'object' && !Array.isArray(v);

export interface DCFDerivation {
  fields: DerivedField[];
}

/** Foot a dcf content block. Pure: never mutates `content`. */
export function deriveDCF(content: Row): DCFDerivation {
  const c = collector();

  // ─── Per-year levered cash flow + cash-on-cash ──────────────────────────────
  const flows = content['annual_cash_flows'];
  if (Array.isArray(flows)) {
    flows.forEach((row, i) => {
      if (!isObj(row)) return;
      const noi = num(row['net_operating_income']);
      const ads = num(row['annual_debt_service']);
      if (noi == null || ads == null) return;

      const levered = noi - ads;
      c.add(
        `annual_cash_flows.${i}.net_cash_flow_levered`,
        `Year ${labelYear(row, i)} — Levered Cash Flow`,
        'currency',
        levered,
      );

      const equity = num(row['cumulative_equity_invested']);
      if (equity != null && equity > 0) {
        c.add(
          `annual_cash_flows.${i}.cash_on_cash_return`,
          `Year ${labelYear(row, i)} — Cash-on-Cash`,
          'rate',
          levered / equity,
        );
      }
    });
  }

  // ─── Exit waterfall ─────────────────────────────────────────────────────────
  const exit = isObj(content['exit_analysis']) ? content['exit_analysis'] : null;
  const assumptions = isObj(content['assumptions']) ? content['assumptions'] : null;
  if (exit) {
    const gross = num(exit['exit_value_gross']);
    const dispPct = assumptions ? num(assumptions['disposition_costs_pct']) : null;

    let dispCosts = num(exit['disposition_costs']);
    if (gross != null && dispPct != null) {
      dispCosts = Math.round(gross * dispPct);
      c.add('exit_analysis.disposition_costs', 'Disposition Costs', 'currency', dispCosts);
    }

    let net = num(exit['exit_value_net']);
    if (gross != null && dispCosts != null) {
      net = gross - dispCosts;
      c.add('exit_analysis.exit_value_net', 'Exit Value (net of costs)', 'currency', net);
    }

    const loanAtExit = num(exit['loan_balance_at_exit']);
    if (net != null && loanAtExit != null) {
      c.add(
        'exit_analysis.net_proceeds_to_equity',
        'Net Sale Proceeds to Equity',
        'currency',
        net - loanAtExit,
      );
    }
  }

  return { fields: c.fields };
}

function labelYear(row: Row, i: number): number {
  const y = num(row['year']);
  return y ?? i + 1;
}
