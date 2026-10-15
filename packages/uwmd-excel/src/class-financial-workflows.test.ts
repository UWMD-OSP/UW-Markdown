import ExcelJS from 'exceljs';
import { evaluateCalc, parseUWFile, quantizeDecimal } from '@uwmd/core';
import { describe, expect, it } from 'vitest';
import { getLayoutForAssetClass } from './layouts.js';
import { toWorkbook } from './toWorkbook.js';

// Synthetic connected statements, not independent industry metric definitions.
// The small evaluator executes persisted workbook formulas; it is not Excel.
function runFormula(formula: string, values: Record<string, number | null>): number | null {
  let expression = formula.replaceAll('<>""', '!==null').replaceAll('=""', '===null').replaceAll('""', 'null');
  for (const name of Object.keys(values).sort((a, b) => b.length - a.length)) {
    expression = expression.replace(new RegExp(`\\b${name}\\b`, 'g'), String(values[name]));
  }
  expect(/^[0-9.eE +*/(),!<>=\-nullIFROUNDORA]+$/.test(expression), expression).toBe(true);
  return new Function('IF', 'ROUND', 'OR', 'AND', `return (${expression});`)(
    (test: boolean, yes: unknown, no: unknown) => test ? yes : no,
    quantizeDecimal,
    (...tests: boolean[]) => tests.some(Boolean),
    (...tests: boolean[]) => tests.every(Boolean),
  ) as number | null;
}

async function parity(asset: string, sections: Record<string, unknown>, expected: Record<string, number | null>) {
  const parsed = parseUWFile(`---\nuw_version: "3.0"\nasset_class: ${asset}\nquick_metrics:\n  purchase_price: 10000000\n---\n${Object.entries(sections).map(([section, value]) => `\n\`\`\`json uw:section=${section} source=manual\n${JSON.stringify(value)}\n\`\`\`\n`).join('')}`);
  const layout = getLayoutForAssetClass(asset)!;
  const emitted = await toWorkbook(parsed);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await emitted.xlsx.writeBuffer());
  const values: Record<string, number | null> = {};
  for (const input of layout.namedInputs) {
    const range = workbook.definedNames.getRanges(input.name).ranges[0]!;
    const match = range.match(/(?:'([^']+)'|([^!]+))!\$([A-Z]+)\$(\d+)/)!;
    const value = workbook.getWorksheet((match[1] ?? match[2])!)!.getCell(`${match[3]}${match[4]}`).value;
    values[input.name] = typeof value === 'number' ? value : null;
  }
  const noi = sections.noi_model as { income: Record<string, number>; expenses: Record<string, number>; net_operating_income: number };
  const egi = layout.incomeLines.reduce((sum, line) => sum + (noi.income[line.path] ?? 0) * (line.sign ?? 1), 0);
  const opex = layout.expenseLines.reduce((sum, line) => sum + (noi.expenses[line.path] ?? 0), 0);
  expect(egi).toBe(noi.income.effective_gross_income);
  expect(opex).toBe(noi.expenses.total_operating_expenses);
  expect(egi - opex).toBe(noi.net_operating_income);
  Object.assign(values, { effective_gross_income: egi, total_operating_expenses: opex, noi: egi - opex });
  for (const line of layout.incomeLines) if (line.name) values[line.name] = noi.income[line.path] ?? null;
  const sheet = workbook.getWorksheet('Underwriting')!;
  for (const [id, value] of Object.entries(expected)) {
    const calc = layout.pack.calculations!.find((decl) => decl.id === id)!;
    const direct = evaluateCalc(calc, { parsed, prior_results: {}, locale: 'en-US' });
    expect(direct.ok, `${id}: ${direct.error?.message}`).toBe(true);
    expect(direct.value, id).toBe(value);
    let formula: string | undefined;
    sheet.eachRow((row) => {
      if (row.getCell(1).value === calc.label) formula = row.getCell(2).formula;
    });
    expect(formula, id).toBeTruthy();
    expect(runFormula(formula!, values), id).toBe(value);
  }
}

function common(noi: number) {
  return {
    valuation: { purchase_price: 10000000 },
    debt_structure: { loan_amount: 6000000, annual_debt_service: 400000 },
    sources_uses: { uses: { total: 11000000 }, equity_metrics: { equity_total: 5000000 } },
    // The supported return metric consumes stated cash; it does not assemble it.
    dcf: { annual_cash_flows: [{ year: 1, net_cash_flow_levered: noi - 400000 - 50000 }] },
  };
}

describe('connected hospitality workbook controls', () => {
  it.each([false, true])('populated F&B and comp inputs, negative NOI=%s', async (negative) => {
    const rooms = 125 * 0.8 * 36500;
    const egi = rooms + 200000 + 50000;
    const expenses = negative ? egi + 100000 : 2500000;
    const noi = egi - expenses;
    await parity('hospitality', {
      ...common(noi), property: { keys: 100 },
      rent_roll: { adr: 125, occupancy: 0.8, available_room_nights: 36500, occupied_room_nights: 29200 },
      hotel_metrics: { market_revpar: 125 },
      hotel_food_beverage: { fb_revenue: 200000, fb_cogs: 70000, fb_labor: 90000 },
      noi_model: { income: { rooms_revenue: rooms, food_beverage_revenue: 200000, miscellaneous_income: 50000, effective_gross_income: egi }, expenses: { rooms_department: expenses, total_operating_expenses: expenses }, net_operating_income: noi, gross_operating_profit: noi + 50000 },
    }, {
      total_room_revenue: rooms, room_revenue_per_key: rooms / 100, occupancy: 0.8,
      adr: 125, revpar: 100, revpar_index: 0.8, fb_gross_margin: 0.2,
      dscr: quantizeDecimal(noi / 400000, 4),
      cash_on_cash: quantizeDecimal((noi - 400000 - 50000) / 5000000, 6),
      gop_margin: quantizeDecimal((noi + 50000) / egi, 6),
    });
  });

  it('zero occupancy preserves zero revenue and negative stated equity cash', async () => {
    await parity('hospitality', {
      ...common(-100000), property: { keys: 100 },
      rent_roll: { adr: 125, occupancy: 0, available_room_nights: 36500, occupied_room_nights: 0 },
      noi_model: { income: { rooms_revenue: 0, effective_gross_income: 0 }, expenses: { rooms_department: 100000, total_operating_expenses: 100000 }, net_operating_income: -100000 },
    }, { total_room_revenue: 0, revpar: 0, occupancy: 0, dscr: -0.25, cash_on_cash: -0.11 });
  });
});

describe('connected data-center workbook controls', () => {
  it.each([null, 0, 900000])('keeps stated power-cost precedence for %s', async (stated) => {
    const rent = 150 * 1000 * 12;
    const power = stated ?? quantizeDecimal(1000 * 1.25 * 8760, 0) * 0.08;
    const egi = rent + power + 120000;
    const expenses = power + 300000;
    const noi = egi - expenses;
    await parity('data_center', {
      ...common(noi), property: { critical_it_load_kw: 2000 },
      dc_capacity: { critical_it_load_kw: 2000, planned_it_load_kw: 2500, contracted_it_load_kw: 1000, design_pue: 1.25 },
      dc_power: { stated_annual_power_cost: stated, utility_rate_per_kwh: 0.08 },
      dc_revenue: { rent_per_kw_month: 150, interconnection_revenue_annual: 100000, services_revenue_annual: 20000, market_rent_per_kw_month: 200 },
      noi_model: { income: { base_rent: rent, expense_reimbursements: power, other_income: 120000, effective_gross_income: egi }, expenses: { utilities: power, cam: 300000, total_operating_expenses: expenses }, net_operating_income: noi },
    }, {
      annual_rent_revenue: rent, annual_facility_kwh_at_contract: 10950000,
      annual_power_cost: power, power_cost_per_kw_month: quantizeDecimal(power / 12000, 2),
      blended_revenue_per_kw_month: 160, utilization: 0.5, commissioned_share: 0.8,
      facility_load_kw: 2500, price_per_kw: 5000, price_per_commissioned_kw: 5000,
      dscr: quantizeDecimal(noi / 400000, 4), cash_on_cash: quantizeDecimal((noi - 450000) / 5000000, 6),
    });
  });
});
