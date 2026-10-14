import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { blockPayload, parseUWFile, type UWBlock } from '@uwmd/verify';
import { deriveSourcesUses } from './sourcesuses.js';

// A Format 3.0 document with no debt_structure: no hedge premium enters uses.
const doc = parseUWFile(`---
uw_version: "3.0"
asset_class: multifamily
---
`);

function field(d: ReturnType<typeof deriveSourcesUses>, path: string): number | undefined {
  return d.fields.find((f) => f.path === path)?.value;
}

describe('deriveSourcesUses — multifamily (nested closing costs, project-cost mirror)', () => {
  // Parkview shape: itemized closing_costs, total_project_cost mirror.
  const content = {
    total_project_cost: 0,
    sources: { senior_loan: 5_040_000, mezzanine_debt: null, equity_sponsor: 2_400_000, total: 0 },
    uses: {
      purchase_price: 7_200_000,
      closing_costs: {
        title_insurance: 28_000,
        transfer_taxes: 21_600,
        legal_fees: 15_000,
        due_diligence: 12_000,
        loan_origination_fee: 50_400,
        appraisal: 4_500,
        environmental: 2_800,
        survey: 2_500,
        inspection: 2_200,
        broker_commission: 0,
        other: 0,
        total: 0,
      },
      escrows: [{ name: 'operating', upfront: 96_000 }],
      other_reserves: 5_000,
      total: 0,
    },
  };
  const d = deriveSourcesUses(content, doc);

  it('foots the nested closing-costs total', () => {
    expect(field(d, 'uses.closing_costs.total')).toBe(139_000);
  });

  it('foots sources, uses, and the project-cost mirror to the same balanced figure', () => {
    expect(field(d, 'sources.total')).toBe(7_440_000);
    expect(field(d, 'uses.total')).toBe(7_440_000);
    expect(field(d, 'total_project_cost')).toBe(7_440_000);
    expect(d.balanced).toBe(true);
    expect(d.gap).toBe(0);
  });
});

describe('deriveSourcesUses — office (flat closing costs, top-level mirrors)', () => {
  const content = {
    sources: { loan_amount: 3_250_000, sponsor_equity: 2_150_000, total: 0 },
    uses: { purchase_price: 5_000_000, closing_costs: 150_000, escrows: [{ name: 'interest', upfront: 250_000 }], total: 0 },
    total_sources: 0,
    total_uses: 0,
  };
  const d = deriveSourcesUses(content, doc);

  it('foots flat buckets and the top-level mirrors', () => {
    expect(field(d, 'sources.total')).toBe(5_400_000);
    expect(field(d, 'uses.total')).toBe(5_400_000);
    expect(field(d, 'total_sources')).toBe(5_400_000);
    expect(field(d, 'total_uses')).toBe(5_400_000);
    expect(d.balanced).toBe(true);
  });

  it('does not foot a closing-costs sub-total when closing_costs is a scalar', () => {
    expect(field(d, 'uses.closing_costs.total')).toBeUndefined();
  });
});

describe('deriveSourcesUses — imbalance & empty', () => {
  it('reports the gap when sources do not equal uses', () => {
    const d = deriveSourcesUses({ sources: { loan: 100 }, uses: { cost: 150 } }, doc);
    expect(d.sourcesTotal).toBe(100);
    expect(d.usesTotal).toBe(150);
    expect(d.gap).toBe(-50);
    expect(d.balanced).toBe(false);
  });

  it('foots nothing for an empty block', () => {
    const d = deriveSourcesUses({}, doc);
    expect(d.fields).toHaveLength(0);
    expect(d.balanced).toBe(true);
  });
});

describe('RFC 0081 §7 footing', () => {
  const parsed = parseUWFile(`---
uw_version: "3.0"
asset_class: office
---
\`\`\`json uw:section=debt_structure variant=alpha
{"_role":"primary","loan_name":"alpha","rate_hedge":{"instrument":"rate_cap","premium":400000}}
\`\`\`
\`\`\`json uw:section=debt_structure variant=beta
{"loan_name":"beta","rate_hedge":{"instrument":"rate_cap","premium":400000}}
\`\`\`
`);
  it('counts each stated premium and the two named upfront escrows once; monthly deposits and other escrows do not enter uses', () => {
    const content = { sources: { equity: 2000000 }, uses: { purchase_price: 500000,
      escrows: [{ name: 'interest', upfront: 750000, monthly: 10000 },
        { name: 'operating', upfront: 50000 }, { name: 'tax', upfront: 90000 }], total: 0 } };
    const original = JSON.stringify({ content, parsed });
    expect(deriveSourcesUses(content, parsed).usesTotal).toBe(2100000);
    expect(JSON.stringify({ content, parsed })).toBe(original);
  });
  it('does not create a uses bucket when none is stated', () => {
    expect(deriveSourcesUses({}, parsed).fields).toHaveLength(0);
    expect(deriveSourcesUses({}, parsed).usesTotal).toBe(0);
  });
});

describe('renovation footing (RFC 0081 §7, RFC 0057)', () => {
  it('counts budget plus contingency once; the draw group, contingency_remaining and expense_targeted add nothing', () => {
    const renovation = {
      budget: 4000000, contingency: 500000,
      contingency_used: 120000, drawn_to_date: 1850000, as_of_date: '2026-09-01',
      contingency_remaining: 380000,
      expense_targeted: [{ label: 'LED retrofit', amount: 600000, targets: 'utilities',
        annual_savings: 95000, savings_begin: 'Y2', in_noi_model: false }],
    };
    const content = { sources: { equity: 4700000 }, uses: { purchase_price: 200000, renovation, total: 0 } };
    const original = JSON.stringify(content);
    const d = deriveSourcesUses(content, doc);
    expect(d.usesTotal).toBe(4700000);
    expect(field(d, 'uses.total')).toBe(4700000);
    expect(d.balanced).toBe(true);
    expect(JSON.stringify(content)).toBe(original);
  });

  it('derives the same total with or without the draw group stated', () => {
    const budgetOnly = { uses: { renovation: { budget: 4000000, contingency: 500000 } } };
    const drawn = { uses: { renovation: { budget: 4000000, contingency: 500000,
      contingency_used: 500000, drawn_to_date: 4500000, as_of_date: '2026-09-01' } } };
    expect(deriveSourcesUses(drawn, doc).usesTotal).toBe(deriveSourcesUses(budgetOnly, doc).usesTotal);
  });

  it('counts a lone budget or a lone contingency', () => {
    expect(deriveSourcesUses({ uses: { renovation: { budget: 4000000 } } }, doc).usesTotal).toBe(4000000);
    expect(deriveSourcesUses({ uses: { renovation: { contingency: 500000, contingency_remaining: null } } }, doc).usesTotal).toBe(500000);
  });

  it('derives budget plus contingency for conformance/capex/accept-draw-with-verified-remaining', () => {
    const path = resolve(__dirname, '../../..', 'conformance/capex/accept-draw-with-verified-remaining/deal.uwx.md');
    const parsed = parseUWFile(readFileSync(path, 'utf8'));
    const content = blockPayload(parsed.sections.sources_uses as UWBlock) as Record<string, unknown>;
    // 4,000,000 budget + 500,000 contingency; the 1,850,000 drawn, 120,000 used
    // and 380,000 remaining were previously counted again (6,850,000).
    expect(deriveSourcesUses(content, parsed).usesTotal).toBe(4500000);
  });
});
