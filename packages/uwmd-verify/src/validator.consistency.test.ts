import { describe, expect, it } from 'vitest';
import { validateUWFile } from './validator.js';
import type { ParsedUWFile, UWBlock } from './types.js';

function block(section: string, content: Record<string, unknown>): UWBlock {
  return {
    annotation: { section },
    meta: { section, lifecycle: { revision: 1, superseded: false }, provenance: { source: 'manual', agent_id: null, agent_version: null, actor: 'user', timestamp: '2026-07-25T00:00:00Z', notes: null }, quality: { confidence: 'high', human_review_required: false, flags: [] }, integrity: { input_hash: null } },
    content,
    prose: '',
    rawJson: JSON.stringify(content),
    lineStart: 1,
    lineEnd: 1,
  };
}

function file(
  sections: ParsedUWFile['sections'],
  quickMetrics: Record<string, number> = {},
): ParsedUWFile {
  return {
    frontmatter: {
      uw_version: '3.0',
      deal_id: 'uw_2026_VALIDATOR',
      deal_name: 'Validator Fixture',
      asset_class: 'multifamily',
      quick_metrics: quickMetrics,
    } as ParsedUWFile['frontmatter'],
    sections,
    prose: {},
    pipeline_log: [],
    custom_calculations: [],
    custom_scenarios: [],
    extensions: {},
    superseded: {},
    raw: '',
  };
}

describe('financial-validity checks', () => {
  it('emits stable FV-NN codes for out-of-range underwriting metrics', () => {
    const parsed = file(
      {
        noi_model: block('noi_model', {
          income: { vacancy_credit_loss: { rate_applied: 0.01 } },
          expenses: { expense_ratio: 0.1 },
        }),
        dcf: block('dcf', {
          assumptions: { revenue_growth_rate: 0.2 },
          returns: { equity_multiple: 0.5 },
        }),
      },
      {
        dscr: 0.9,
        ltv: 0.9,
        debt_yield: 0.05,
        cap_rate: 0.02,
        irr_projected: 0.01,
      },
    );

    const codes = new Set(validateUWFile(parsed).issues.map((issue) => issue.code));

    for (const code of ['FV-01', 'FV-03', 'FV-04', 'FV-05', 'FV-07', 'FV-09', 'FV-10', 'FV-12', 'FV-13']) {
      expect(codes, code).toContain(code);
    }
  });
});

describe('cross-section consistency checks', () => {
  it('pins the material sources, debt, and purchase-price reconciliations', () => {
    const parsed = file({
      debt_structure: block('debt_structure', { loan_amount: 5_000_000 }),
      sources_uses: block('sources_uses', {
        sources: { loan_amount: 4_500_000 },
        uses: { purchase_price: 7_500_000 },
        total_sources: 7_000_000,
        total_uses: 7_500_000,
      }),
      valuation: block('valuation', { purchase_price: 7_200_000 }),
    });

    const issues = validateUWFile(parsed).issues;

    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'CC-03', severity: 'error' }),
      expect.objectContaining({ code: 'CC-04', severity: 'error' }),
      expect.objectContaining({ code: 'CC-10', severity: 'error' }),
    ]));
  });
});
