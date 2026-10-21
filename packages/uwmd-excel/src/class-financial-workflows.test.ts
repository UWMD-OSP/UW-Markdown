import ExcelJS from 'exceljs';
import { evaluateCalc, parseUWFile, quantizeDecimal } from '@uwmd/core';
import { describe, expect, it } from 'vitest';
import { getLayoutForAssetClass } from './layouts.js';
import { toWorkbook } from './toWorkbook.js';

// Synthetic connected statements, not independent industry metric definitions.
// The small evaluator executes persisted workbook formulas; it is not Excel.
function runFormula(formula: string, values: Record<string, number | string | null>): number | null {
  let expression = formula.replaceAll('<>""', '!==null').replaceAll('=""', '===null').replaceAll('""', 'null')
    .replaceAll('<>', '!==').replace(/(?<![<>!=])=(?!=)/g, '===');
  for (const name of Object.keys(values).sort((a, b) => b.length - a.length)) {
    const value = values[name];
    expression = expression.replace(new RegExp(`\\b${name}\\b`, 'g'), typeof value === 'string' ? JSON.stringify(value) : String(value));
  }
  // Text cells (an enum such as dc_power.billing) compare as quoted strings.
  expect(/^[0-9.eE +*/(),!<>=\-nullIFROUNDORA]+$/.test(expression.replace(/"[a-z_]*"/g, '')), expression).toBe(true);
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
  const values: Record<string, number | string | null> = {};
  for (const input of layout.namedInputs) {
    const range = workbook.definedNames.getRanges(input.name).ranges[0]!;
    const match = range.match(/(?:'([^']+)'|([^!]+))!\$([A-Z]+)\$(\d+)/)!;
    const value = workbook.getWorksheet((match[1] ?? match[2])!)!.getCell(`${match[3]}${match[4]}`).value;
    values[input.name] = typeof value === 'number' || typeof value === 'string' ? value : null;
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
      // RFC 0103: USALI gross margin, (revenue - cost of sales) / revenue, no labor.
      adr: 125, revpar: 100, revpar_index: 0.8, fb_gross_margin: 0.65,
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
  it('no draw factor and no meter is null, never full draw', () => {
    const parsed = parseUWFile(`---\nuw_version: "3.0"\nasset_class: data_center\n---\n\n\`\`\`json uw:section=dc_capacity source=manual\n${JSON.stringify({ critical_it_load_kw: 2000, planned_it_load_kw: 2500, contracted_it_load_kw: 1000, design_pue: 1.25 })}\n\`\`\`\n\n\`\`\`json uw:section=dc_power source=manual\n${JSON.stringify({ utility_rate_per_kwh: 0.08, billing: 'all_in' })}\n\`\`\`\n`);
    const pack = getLayoutForAssetClass('data_center')!.pack;
    for (const id of ['annual_facility_kwh', 'annual_power_cost', 'power_cost_per_kw_month']) {
      const result = evaluateCalc(pack.calculations!.find((decl) => decl.id === id)!, { parsed, prior_results: {}, locale: 'en-US' });
      expect(result.ok, id).toBe(true);
      expect(result.value, id).toBeNull();
    }
  });
  // RFC 0103: power never assumes full draw. Energy is metered kWh when stated,
  // else contracted kW x an explicit draw factor x PUE (measured before design)
  // x 8,760; no draw factor gives null. Metered pass-through is zero landlord cost.
  const DRAWN = 1000 * 0.6 * 1.25 * 8760; // 6,570,000 kWh
  it.each([
    { name: 'stated null, drawn at 60%', power: { stated_annual_power_cost: null, draw_factor: 0.6, billing: 'all_in' }, kwh: DRAWN, cost: quantizeDecimal(DRAWN * 0.08, 2) },
    { name: 'stated 0 wins', power: { stated_annual_power_cost: 0, draw_factor: 0.6, billing: 'all_in' }, kwh: DRAWN, cost: 0 },
    { name: 'stated 900000 wins', power: { stated_annual_power_cost: 900000, draw_factor: 0.6, billing: 'breakered' }, kwh: DRAWN, cost: 900000 },
    { name: 'metered kWh before a draw factor', power: { metered_annual_kwh: 5000000, draw_factor: 0.6, billing: 'all_in' }, kwh: 5000000, cost: 400000 },
    { name: 'measured PUE before design PUE', power: { draw_factor: 0.6, billing: 'all_in' }, measured: 1.4, kwh: quantizeDecimal(1000 * 0.6 * 1.4 * 8760, 0), cost: quantizeDecimal(quantizeDecimal(1000 * 0.6 * 1.4 * 8760, 0) * 0.08, 2) },
    { name: 'metered pass-through is net to the landlord', power: { stated_annual_power_cost: 900000, draw_factor: 0.6, billing: 'metered_pass_through' }, kwh: DRAWN, cost: 0 },
  ])('power: $name', async ({ power: stated, measured, kwh, cost }) => {
    const rent = 150 * 1000 * 12;
    const power = cost ?? 0;
    const egi = rent + power + 120000;
    const expenses = power + 300000;
    const noi = egi - expenses;
    await parity('data_center', {
      ...common(noi), property: { critical_it_load_kw: 2000 },
      dc_capacity: { critical_it_load_kw: 2000, planned_it_load_kw: 2500, contracted_it_load_kw: 1000, design_pue: 1.25, ...(measured ? { measured_pue: measured } : {}) },
      dc_power: { utility_rate_per_kwh: 0.08, ...stated },
      dc_revenue: { rent_per_kw_month: 150, interconnection_revenue_annual: 100000, services_revenue_annual: 20000, market_rent_per_kw_month: 200 },
      noi_model: { income: { base_rent: rent, expense_reimbursements: power, other_income: 120000, effective_gross_income: egi }, expenses: { utilities: power, cam: 300000, total_operating_expenses: expenses }, net_operating_income: noi },
    }, {
      annual_rent_revenue: rent, annual_facility_kwh: kwh,
      annual_power_cost: cost, power_cost_per_kw_month: quantizeDecimal(cost / 12000, 2),
      mark_to_market: 0.3333,
      blended_revenue_per_kw_month: 160, utilization: 0.5, commissioned_share: 0.8,
      facility_load_kw: 2500, price_per_kw: 5000, price_per_commissioned_kw: 5000,
      dscr: quantizeDecimal(noi / 400000, 4), cash_on_cash: quantizeDecimal((noi - 450000) / 5000000, 6),
    });
  });
});
