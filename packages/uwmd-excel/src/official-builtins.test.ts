import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { parseUWFile, blockPayload, evaluateCalc, emitCalcExcelFormula, quantizeDecimal } from '@uwmd/core';
import { toWorkbook } from './toWorkbook.js';
import { getLayoutForAssetClass } from './layouts.js';
import { buildNamedRangeMap } from './layout.js';
const root = resolve(__dirname, '../../..');
function named(wb: ExcelJS.Workbook, name: string): number | null {
  const range = wb.definedNames.getRanges(name).ranges[0]!;
  const match = range.match(/(?:'([^']+)'|([^!]+))!\$([A-Z]+)\$(\d+)/)!;
  const value = wb.getWorksheet((match[1] ?? match[2])!)!.getCell(match[3]! + match[4]!).value;
  return typeof value === 'number' ? value : null;
}
function runFormula(formula: string, values: Record<string, number | null>): number | null {
  let text = formula.replace(/<>""/g, '!==null').replace(/=""/g, '===null').replace(/""/g, 'null');
  for (const [name, value] of Object.entries(values).sort((a,b) => b[0].length-a[0].length)) text = text.replace(new RegExp(`\\b${name}\\b`,'g'), String(value));
  expect(/^[0-9.eE +*/(),!<>=\-nullIFROUND]+$/.test(text), text).toBe(true);
  return new Function('IF','ROUND', `return (${text});`)((test: boolean, yes: unknown, no: unknown)=>test?yes:no,quantizeDecimal) as number | null;
}
for (const [cls,file] of [['data_center','Mesa-Gateway-Data-Center-Mesa-AZ.uwx.md'],['manufactured_housing','Desert-Palms-MHC-Apache-Junction-AZ.uwx.md']] as const) {
  describe(`${cls} complete workbook starter`,()=> {
    it('persists every formula input and matches every metric exactly',async()=> {
      const parsed = parseUWFile(readFileSync(resolve(root,'examples',file),'utf8'));
      const layout = getLayoutForAssetClass(cls)!;
      const workbook = await toWorkbook(parsed);
      const bytes = await workbook.xlsx.writeBuffer(); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(bytes);
      const map=buildNamedRangeMap(layout);
      const values: Record<string, number | null> = {};
      const noi=blockPayload(parsed.sections.noi_model as import('@uwmd/core').UWBlock) as Record<string, any>;
      for(const input of layout.namedInputs) values[input.name]=named(wb,input.name);
      values.noi=noi.net_operating_income; values.effective_gross_income=noi.income.effective_gross_income; values.total_operating_expenses=noi.expenses.total_operating_expenses;
      for(const calc of layout.pack.calculations ?? []) {
        const direct=evaluateCalc(calc,{parsed,prior_results:{},locale:'en-US'});
        expect(direct.ok,`${calc.id}:${direct.error?.message}`).toBe(true); expect(typeof direct.value,calc.id).toBe('number');
        const formula=emitCalcExcelFormula(calc,{namedRanges:map});
        expect(runFormula(formula,values),calc.id).toBe(direct.value);
      }
      const income=layout.incomeLines.reduce((sum,line)=>sum+(noi.income[line.path]??0)*(line.sign??1),0);
      const expenses=layout.expenseLines.reduce((sum,line)=>sum+(noi.expenses[line.path]??0),0);
      expect(income).toBe(noi.income.effective_gross_income); expect(expenses).toBe(noi.expenses.total_operating_expenses);
      expect(income-expenses).toBe(noi.net_operating_income);
    });
  });
}
