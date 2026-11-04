// @vitest-environment jsdom
//
// Component tests for the footed-model surfaces. The contract every model shares
// (via model-kit's useFooting): editing one input re-foots the dependent totals
// and dispatches EXACTLY ONE section_replace through applyEdit() — no partial
// writes, no second path into the file. We assert on the dispatched op rather
// than the DOM so the test pins the calc-integrity behavior, not the markup.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { buildMeta, getSectionVariant, type EditOperation, type UWBlock } from '@uwmd/core/browser';
import { deepGet } from '../catalog.js';
import { loadInitialState, runEdit } from '../edits.js';
import { ValuationModel } from './ValuationModel.js';
import { DcfModel } from './DcfModel.js';
import { OperatingStatementModel } from './OperatingStatementModel.js';

afterEach(cleanup);

/** A minimal block — the surfaces only read `content` and `meta`. */
function block(content: Record<string, unknown>): UWBlock {
  return { content, meta: { field_overrides: [] } } as unknown as UWBlock;
}

/** Type the captured op as a section_replace and expose its content for paths. */
function dispatchedOp(spy: ReturnType<typeof vi.fn>): Extract<EditOperation, { kind: 'section_replace' }> {
  return spy.mock.calls[0][0] as Extract<EditOperation, { kind: 'section_replace' }>;
}

function editField(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe('ValuationModel', () => {
  it('re-foots the indicated value (NOI / cap) on a single dispatch when NOI changes', () => {
    const dispatch = vi.fn();
    const { getByLabelText } = render(
      <ValuationModel
        sectionId="valuation"
        variant={undefined}
        block={block({
          income_approach: { noi_used: 400_000, cap_rate_applied: 0.05 },
          purchase_price: 8_000_000,
        })}
        dispatch={dispatch}
      />,
    );

    editField(getByLabelText('NOI to capitalize'), '500000');

    expect(dispatch).toHaveBeenCalledTimes(1);
    const op = dispatchedOp(dispatch);
    expect(op.kind).toBe('section_replace');
    expect(op.section_id).toBe('valuation');
    expect(deepGet(op.content, 'income_approach.noi_used')).toBe(500_000);
    // 500,000 / 0.05 = 10,000,000 — footed, not typed.
    expect(deepGet(op.content, 'income_approach.indicated_value')).toBe(10_000_000);
  });
});

describe('DcfModel', () => {
  const baseContent = () => ({
    assumptions: { disposition_costs_pct: 0.02 },
    annual_cash_flows: [
      {
        year: 1,
        net_operating_income: 400_000,
        annual_debt_service: 300_000,
        cumulative_equity_invested: 2_000_000,
      },
    ],
    exit_analysis: { exit_value_gross: 8_000_000, loan_balance_at_exit: 5_000_000 },
  });

  it('re-foots a year’s levered cash flow when its NOI changes, in one dispatch', () => {
    const dispatch = vi.fn();
    const { getByLabelText } = render(
      <DcfModel sectionId="dcf" variant={undefined} block={block(baseContent())} dispatch={dispatch} />,
    );

    editField(getByLabelText('NOI'), '450000');

    expect(dispatch).toHaveBeenCalledTimes(1);
    const op = dispatchedOp(dispatch);
    expect(op.section_id).toBe('dcf');
    expect(deepGet(op.content, 'annual_cash_flows.0.net_operating_income')).toBe(450_000);
    // 450,000 − 300,000 = 150,000, footed back into the per-year row.
    expect(deepGet(op.content, 'annual_cash_flows.0.net_cash_flow_levered')).toBe(150_000);
  });

  it('re-foots the whole exit waterfall when the gross exit value changes', () => {
    const dispatch = vi.fn();
    const { getByLabelText } = render(
      <DcfModel sectionId="dcf" variant={undefined} block={block(baseContent())} dispatch={dispatch} />,
    );

    editField(getByLabelText('Exit value (gross)'), '9000000');

    expect(dispatch).toHaveBeenCalledTimes(1);
    const op = dispatchedOp(dispatch);
    // disposition = 9,000,000 × 0.02 = 180,000; net = 8,820,000; proceeds = 3,820,000.
    expect(deepGet(op.content, 'exit_analysis.disposition_costs')).toBe(180_000);
    expect(deepGet(op.content, 'exit_analysis.exit_value_net')).toBe(8_820_000);
    expect(deepGet(op.content, 'exit_analysis.net_proceeds_to_equity')).toBe(3_820_000);
  });

  // RFC 0077: an unrelated edit keeps the whole-stack figure and re-foots common
  // from the stated redemption, instead of overwriting a stated common residual.
  it('re-foots proceeds to common equity from a stated preferred redemption', () => {
    const dispatch = vi.fn();
    const base = baseContent();
    const content = {
      ...base,
      exit_analysis: { ...base.exit_analysis, preferred_equity_redemption_at_exit: 1_500_000 },
    };
    const { getByLabelText } = render(
      <DcfModel sectionId="dcf" variant={undefined} block={block(content)} dispatch={dispatch} />,
    );

    editField(getByLabelText('Exit value (gross)'), '9000000');

    const op = dispatchedOp(dispatch);
    expect(deepGet(op.content, 'exit_analysis.preferred_equity_redemption_at_exit')).toBe(1_500_000);
    expect(deepGet(op.content, 'exit_analysis.net_proceeds_to_equity')).toBe(3_820_000);
    expect(deepGet(op.content, 'exit_analysis.net_proceeds_to_common_equity')).toBe(2_320_000);
  });

  it('takes the preferred redemption as an input', () => {
    const dispatch = vi.fn();
    const { getByLabelText } = render(
      <DcfModel sectionId="dcf" variant={undefined} block={block(baseContent())} dispatch={dispatch} />,
    );

    editField(getByLabelText('Preferred equity redemption'), '1000000');

    const op = dispatchedOp(dispatch);
    // proceeds to equity = 8,000,000 × 0.98 − 5,000,000 = 2,840,000.
    expect(deepGet(op.content, 'exit_analysis.net_proceeds_to_common_equity')).toBe(1_840_000);
  });

  it('adds a projection year via a single dispatch', () => {
    const dispatch = vi.fn();
    const { getByText } = render(
      <DcfModel
        sectionId="dcf"
        variant={undefined}
        block={block({ annual_cash_flows: [] })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(getByText('+ Add year'));

    expect(dispatch).toHaveBeenCalledTimes(1);
    const op = dispatchedOp(dispatch);
    const flows = deepGet(op.content, 'annual_cash_flows') as unknown[];
    expect(Array.isArray(flows)).toBe(true);
    expect(flows).toHaveLength(1);
  });
});

describe('operating statement input to serialized source to reload', () => {
  const sourceFor = (content: Record<string, unknown>) => {
    const meta = buildMeta('operating_statement', 1,
      { source: 'manual', actor: 'test', timestamp: '2026-11-04T00:00:00Z' });
    return [
      '---', 'uw_version: "3.0"', 'asset_class: multifamily', 'deal_id: synthetic-footing', '---', '',
      'Untouched prose before the section.', '',
      '```json uw:section=operating_statement variant=t12 source=manual',
      JSON.stringify({ _meta: meta, ...content }, null, 2), '```', '',
      '```json uw:section=x_unrelated source=manual', '{ "keep": "exact bytes", "amount": 123.45 }', '```', '',
    ].join('\n');
  };

  function editAndReload(content: Record<string, unknown>, label: string, value: string) {
    const original = sourceFor(content);
    const initial = loadInitialState(original);
    const dispatch = vi.fn();
    const selected = getSectionVariant(initial.parsed, 'operating_statement', 't12');
    expect(selected).not.toBeNull();
    const view = render(<OperatingStatementModel sectionId="operating_statement" variant="t12"
      block={selected!} dispatch={dispatch} />);
    editField(view.getByLabelText(label), value);
    expect(dispatch).toHaveBeenCalledTimes(1);
    const outcome = runEdit(initial, dispatchedOp(dispatch));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error(outcome.message);
    // This exercises actual component dispatch, runEdit/applyEdit and saved
    // source parsing. It does not claim a native file chooser/download test.
    const saved = outcome.state.source;
    const reloaded = loadInitialState(saved);
    expect(reloaded.source).toBe(saved);
    expect(saved).toContain('{ "keep": "exact bytes", "amount": 123.45 }');
    expect(saved).toContain('Untouched prose before the section.');
    expect(initial.source).toBe(original);
    return getSectionVariant(reloaded.parsed, 'operating_statement', 't12')!.content;
  }

  it('persists complete-detail footing and leaves unrelated source bytes alone', () => {
    const content = editAndReload({ income: { gross_potential_rent: 120000, other_income: { laundry: 12000 } },
      expenses: { insurance: 6000, real_estate_taxes: 24000 } }, 'Gross Potential Rent', '130000');
    expect(deepGet(content, 'income.effective_gross_income')).toBe(142000);
    expect(deepGet(content, 'expenses.total_operating_expenses')).toBe(30000);
    expect(content.net_operating_income).toBe(112000);
  });

  it('regression: persists the established half-away -101 loss after a half-dollar expense edit', () => {
    const content = editAndReload({ income: { gross_potential_rent: 0 }, expenses: { insurance: 100 } },
      'Insurance', '100.5');
    expect(deepGet(content, 'expenses.insurance')).toBe(100.5);
    expect(deepGet(content, 'expenses.total_operating_expenses')).toBe(101);
    expect(content.net_operating_income).toBe(-101);
  });

  it('preserves authored aggregate-only totals in saved source after an input edit', () => {
    const content = editAndReload({ income: { gross_potential_rent: 120000, other_income: { total: 12000 } },
      expenses: { utilities: { total: 6000 }, total_operating_expenses: 30000 }, net_operating_income: 102000 },
    'Gross Potential Rent', '130000');
    expect(deepGet(content, 'income.other_income.total')).toBe(12000);
    expect(deepGet(content, 'expenses.utilities.total')).toBe(6000);
    expect(deepGet(content, 'expenses.total_operating_expenses')).toBe(30000);
    expect(content.net_operating_income).toBe(102000);
  });
});

describe('aggregate-only EGI and partial expense editing', () => {
  it('does not replace source aggregates after adding the first expense detail', () => {
    const dispatch = vi.fn();
    const content = { income: { effective_gross_income: 132000 },
      expenses: { total_operating_expenses: 30000, insurance: 0 }, net_operating_income: 102000 };
    const view = render(<OperatingStatementModel sectionId="operating_statement" variant="t12"
      block={block(content)} dispatch={dispatch} />);
    expect(view.getByRole('status').textContent).toContain('stated value retained');
    editField(view.getByLabelText('Insurance'), '6000');
    const saved = dispatchedOp(dispatch).content;
    expect(deepGet(saved, 'income.effective_gross_income')).toBe(132000);
    expect(deepGet(saved, 'expenses.total_operating_expenses')).toBe(30000);
    expect(saved.net_operating_income).toBe(102000);
  });
});
