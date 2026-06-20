// @vitest-environment jsdom
//
// Component tests for the footed-model surfaces. The contract every model shares
// (via model-kit's useFooting): editing one input re-foots the dependent totals
// and dispatches EXACTLY ONE section_replace through applyEdit() — no partial
// writes, no second path into the file. We assert on the dispatched op rather
// than the DOM so the test pins the calc-integrity behavior, not the markup.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import type { EditOperation, UWBlock } from '@uwmd/core/browser';
import { deepGet } from '../catalog.js';
import { ValuationModel } from './ValuationModel.js';
import { DcfModel } from './DcfModel.js';

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
