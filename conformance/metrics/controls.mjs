import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseUWFile } from '../../packages/uwmd-core/dist/parser.js';
import { verifyStatedMetric } from './verifier.mjs';

export function controls(root) {
  const d = JSON.parse(readFileSync(join(root, 'spec/metrics/builtin.json'), 'utf8'));
  const metric = (id, cls = 'multifamily') => d.calculations.find(m => m.id === id && m.asset_classes.includes(cls));
  const block = (section, content) => ({ annotation: { section }, meta: {}, content });
  const deal = (sections) => ({ ...parseUWFile(''), sections });
  const simple = () => deal({
    property: block('property', { total_units: 1 }),
    valuation: block('valuation', { purchase_price: 100000.21 }),
    noi_model: block('noi_model', { net_operating_income: 50000 }),
    debt_structure: block('debt_structure', { annual_debt_service: 25000, loan_amount: 75000 }),
  });
  return [
    ['stated-value-tampering', () => {
      assert.equal(verifyStatedMetric(metric('dscr'), simple(), 2).state, 'verified');
      assert.equal(verifyStatedMetric(metric('dscr'), simple(), 2.0001).state, 'failed');
    }],
    ['missing-input-is-not-a-default', () => {
      const p = simple(); delete p.sections.debt_structure.content.annual_debt_service;
      assert.deepEqual(verifyStatedMetric(metric('dscr'), p, 2), { state: 'unverifiable', reason: 'missing_or_null_input', computed: null });
    }],
    ['explicit-null-does-not-become-zero', () => {
      const p = simple(); p.sections.noi_model.content.net_operating_income = null;
      assert.equal(verifyStatedMetric(metric('dscr'), p, 0).state, 'unverifiable');
    }],
    ['zero-divisor-refuses', () => {
      const p = simple(); p.sections.debt_structure.content.annual_debt_service = 0;
      assert.equal(verifyStatedMetric(metric('dscr'), p, 2).reason, 'CALC-DIV-ZERO');
    }],
    ['invalid-input-refuses', () => {
      const p = simple(); p.sections.noi_model.content.net_operating_income = 'not a number';
      assert.equal(verifyStatedMetric(metric('dscr'), p, 2).reason, 'CALC-TYPE-001');
    }],
    ['dictionary-formula-controls-comparison', () => {
      const m = { ...metric('dscr'), formula: 'noi_model.net_operating_income / debt_structure.loan_amount' };
      assert.equal(verifyStatedMetric(m, simple(), 2).state, 'failed');
    }],
    ['currency-quantum-and-one-cent-negative', () => {
      const p = simple();
      p.sections.valuation.content.purchase_price = 537196.21 - 188848.11 + 107395.80;
      assert.notEqual(p.sections.valuation.content.purchase_price, 455743.90);
      assert.equal(verifyStatedMetric(metric('price_per_unit'), p, 455743.90).state, 'verified');
      assert.equal(verifyStatedMetric(metric('price_per_unit'), p, 455743.91).state, 'failed');
    }],
    ['half-away-from-zero-at-output-only', () => {
      const p = simple(); p.sections.valuation.content.purchase_price = -1.005;
      assert.equal(verifyStatedMetric(metric('price_per_unit'), p, -1.01).state, 'verified');
      assert.equal(verifyStatedMetric(metric('price_per_unit'), p, -1).state, 'failed');
    }],
    ['class-scoped-cash-on-cash-does-not-reconcile', () => {
      const p = simple(); p.sections.sources_uses = block('sources_uses', { sources: { sponsor_equity: 100000 } });
      assert.equal(verifyStatedMetric(metric('cash_on_cash', 'office'), p, 0.25).state, 'verified');
      assert.equal(verifyStatedMetric(metric('cash_on_cash'), p, 0.25).state, 'unverifiable');
      assert.equal(verifyStatedMetric(metric('cash_on_cash', 'mixed_use'), p, 0.25).state, 'unverifiable');
    }],
    ['multifamily-stated-Y1-and-lazy-fallback', () => {
      const p = simple(); p.sections.sources_uses = block('sources_uses', { equity_metrics: { equity_total: 100000 } });
      assert.equal(verifyStatedMetric(metric('cash_on_cash'), p, 0.25).state, 'verified');
      p.sections.dcf = block('dcf', { annual_cash_flows: [{ year: 2, net_cash_flow_levered: 90000 }, { year: 1, net_cash_flow_levered: 0 }] });
      delete p.sections.noi_model;
      assert.equal(verifyStatedMetric(metric('cash_on_cash'), p, 0).state, 'verified');
    }],
    ['declared-senior-selection-and-unresolved-equity', () => {
      const p = simple();
      p.sections.debt_structure = {
        lender: block('debt_structure', { _role: 'senior', loan_amount: 75000, annual_debt_service: 25000 }),
        mezz: block('debt_structure', { _role: 'junior', loan_amount: 5000, annual_debt_service: 10000 }),
      };
      p.sections.sources_uses = block('sources_uses', { equity_metrics: { equity_total: 100000 } });
      assert.equal(verifyStatedMetric(metric('dscr'), p, 2).state, 'verified');
      assert.equal(verifyStatedMetric(metric('cash_on_cash'), p, 0.25).reason, 'CALC-RESOLVE-002');
    }],
    ['mixed-use-allocation-is-stated', () => {
      const p = simple(); p.sections.components = block('components', { multifamily: { total_units: 10 } });
      const m = metric('multifamily_price_per_unit', 'mixed_use');
      assert.equal(verifyStatedMetric(m, p, 10000.02).state, 'unverifiable');
      p.sections.components.content.multifamily.allocation_pct = 0.5;
      assert.equal(verifyStatedMetric(m, p, 5000.01).state, 'verified');
    }],
    ['primary-size-is-unrounded-and-uninferred', () => {
      const m = d.size_intensives.find(s => s.asset_classes.includes('land'));
      const p = simple(); p.sections.property.content = { gross_acres: 123.123456789, usable_acres: 100 };
      assert.equal(verifyStatedMetric(m, p, 123.123456789).state, 'verified');
      assert.equal(verifyStatedMetric(m, p, 123.123457).state, 'failed');
      delete p.sections.property.content.gross_acres;
      assert.equal(verifyStatedMetric(m, p, 100).state, 'unverifiable');
      p.sections.property.content.gross_acres = '100';
      assert.equal(verifyStatedMetric(m, p, 100).state, 'unverifiable');
      p.sections.property.content.gross_acres = Infinity;
      assert.equal(verifyStatedMetric(m, p, 100).state, 'unverifiable');
    }],
    ['inputs-and-definition-remain-unchanged', () => {
      const m = metric('dscr'), p = simple(), before = JSON.stringify({ m, p });
      verifyStatedMetric(m, p, 2);
      assert.equal(JSON.stringify({ m, p }), before);
    }],
  ];
}
