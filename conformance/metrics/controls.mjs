import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { getStatedDecimals, parseUWFile } from '../../packages/uwmd-verify/dist/index.js';
import { readLiteSections, verifyExample, verifyStatedMetric as verifyWithPrecision, verifyStatementHome } from './verifier.mjs';
import { jsonNumericTokens, jsonStatedDecimals, quickMetricDecimals } from './numeric-tokens.mjs';

// Synthetic controls explicitly declare the full dictionary output precision.
const verifyStatedMetric = (metric, parsed, stated, variants) => verifyWithPrecision(metric, parsed, stated, variants, metric.round_to ?? 0);

export function controls(root) {
  const d = JSON.parse(readFileSync(join(root, 'spec/metrics/builtin.json'), 'utf8'));
  const metric = (id, cls = 'multifamily') => d.calculations.find(m => m.id === id && m.asset_classes.includes(cls));
  const block = (section, content) => ({ annotation: { section }, meta: {}, content });
  const deal = (sections) => ({ ...parseUWFile('---\nuw_version: "3.0"\n---\n'), sections });
  const simple = () => deal({
    property: block('property', { total_units: 1 }),
    valuation: block('valuation', { purchase_price: 100000.21 }),
    noi_model: block('noi_model', { net_operating_income: 50000 }),
    debt_structure: block('debt_structure', { annual_debt_service: 25000, loan_amount: 75000 }),
  });
  return [
    ['verifier-import-graph-excludes-starter-engine', () => {
      // RFC 0083: the verifier's whole import graph is `@uwmd/verify`'s build and
      // this fixture; it reaches no `@uwmd/core` module at all.
      const visited = new Set();
      const core = resolve(root, 'packages/uwmd-core') + sep;
      function inspect(file) {
        if (visited.has(file)) return;
        visited.add(file);
        assert.ok(!file.startsWith(core), `the verifier reaches a core module: ${file}`);
        const portable = file.replaceAll('\\', '/');
        assert.doesNotMatch(portable, /\/(?:packs\/|defaults\.js$|cascade\.js$)/);
        const source = readFileSync(file, 'utf8');
        for (const match of source.matchAll(/\b(?:import|export)[\s\S]*?\bfrom\s*['"](\.[^'"]+)['"]/g)) {
          inspect(resolve(dirname(file), match[1]));
        }
      }
      inspect(resolve(root, 'conformance/metrics/verifier.mjs'));
      // The walk is real: it reached the package entry and the evaluator through it.
      assert.ok(visited.has(resolve(root, 'packages/uwmd-verify/dist/index.js')));
      assert.ok(visited.has(resolve(root, 'packages/uwmd-verify/dist/calc/evaluator.js')));
    }],
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
    ['all-income-classes-require-total-equity', () => {
      const p = simple(); p.sections.sources_uses = block('sources_uses', { sources: { sponsor_equity: 100000 } });
      for (const m of d.calculations.filter(m => m.id === 'cash_on_cash')) {
        assert.equal(verifyStatedMetric(m, p, 0.25).state, 'unverifiable');
      }
      assert.equal(verifyStatedMetric(metric('cash_on_cash'), p, 0.25).state, 'unverifiable');
      assert.equal(verifyStatedMetric(metric('cash_on_cash', 'mixed_use'), p, 0.25).state, 'unverifiable');
    }],
    ['all-income-classes-stated-Y1-and-lazy-fallback', () => {
      const p = simple(); p.sections.sources_uses = block('sources_uses', { equity_metrics: { equity_total: 100000 } });
      for (const m of d.calculations.filter(m => m.id === 'cash_on_cash')) assert.equal(verifyStatedMetric(m, p, 0.25).state, 'verified');
      p.sections.dcf = block('dcf', { annual_cash_flows: [{ year: 2, net_cash_flow_levered: 90000 }, { year: 1, net_cash_flow_levered: 0 }] });
      delete p.sections.noi_model;
      for (const m of d.calculations.filter(m => m.id === 'cash_on_cash')) assert.equal(verifyStatedMetric(m, p, 0).state, 'verified');
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
      p.sections.property.content.gross_acres = Number.POSITIVE_INFINITY;
      assert.equal(verifyStatedMetric(m, p, 100).state, 'unverifiable');
    }],
    ['source-tokens-preserve-zeroes-exponents-and-addresses', () => {
      const rawJson = '{"dscr":1.20,"other":{"dscr":1.2},"rows":[1.200e-2],"text":"1.2000","escaped\\u005fkey":2.00}';
      const tokens = jsonNumericTokens(rawJson);
      assert.equal(tokens.get('["dscr"]'), '1.20');
      assert.equal(tokens.get('["other","dscr"]'), '1.2');
      assert.equal(tokens.get('["rows","0"]'), '1.200e-2');
      assert.equal(tokens.get('["escaped_key"]'), '2.00');
      assert.equal(jsonStatedDecimals({ rawJson }, 'dscr', 1.2), 2);
      assert.equal(jsonStatedDecimals({ rawJson }, 'dscr', 1.25), undefined);
      // A member named content is payload like any other (RFC 0081 §3).
      assert.equal(jsonStatedDecimals({ rawJson: '{"_meta":{},"content":{"dscr":1.20}}' }, 'content.dscr', 1.2), 2);
      assert.equal(jsonStatedDecimals({ rawJson: '{"_meta":{},"content":{"dscr":1.20}}' }, 'dscr', 1.2), undefined);
      const yaml = '---\nquick_metrics:\n  dscr: 1.20 # comment\n  other: "1.2000"\n---\n';
      assert.equal(quickMetricDecimals(yaml, 'dscr', 1.2), 2);
      assert.equal(quickMetricDecimals(yaml, 'other', 1.2), undefined);
    }],
    ['stated-precision-minimum-and-no-double-rounding', () => {
      const p = simple(); p.sections.noi_model.content.net_operating_income = 1.24495;
      p.sections.debt_structure.content.annual_debt_service = 1;
      const verify = token => verifyWithPrecision(metric('dscr'), p, Number(token), undefined, getStatedDecimals(token));
      assert.equal(verify('1.24').state, 'verified');
      assert.equal(verify('1.25').state, 'failed');
      assert.equal(verify('1.2').state, 'failed');
      assert.equal(verify('1.245000000').state, 'verified');
      assert.equal(verifyWithPrecision(metric('dscr'), p, 1.2449).reason, 'CALC-TYPE-001');
    }],
    ['coarse-statements-verify-or-fail-at-the-minimum', () => {
      const p = simple(); p.sections.debt_structure.content.annual_debt_service = 1;
      p.sections.noi_model.content.net_operating_income = 1.7;
      assert.equal(verifyWithPrecision(metric('dscr'), p, 1.5, undefined, 1).state, 'failed');
      p.sections.valuation.content.purchase_price = 1;
      for (const [raw, state] of [[0.07, 'verified'], [0.070499999, 'verified'], [0.0705, 'failed'], [0.08, 'failed']]) {
        p.sections.noi_model.content.net_operating_income = raw;
        assert.equal(verifyWithPrecision(metric('cap_rate'), p, 0.07, undefined, 2).state, state);
      }
      p.sections.sources_uses = block('sources_uses', { uses: { total: 124615.3846153846 } });
      assert.equal(verifyWithPrecision(metric('ltc', 'office'), p, 0.6, undefined, 1).state, 'verified');
    }],
    ['negative-size-denominator-is-unverifiable', () => {
      // RFC 0100 D5: price per unit over total_units -1 is not confirmed; zero
      // already refuses as a division; a positive size verifies as before.
      const m = metric('price_per_unit');
      assert.equal(m.null_semantics, 'positive_size_denominator');
      const p = simple();
      assert.equal(verifyStatedMetric(m, p, 100000.21).state, 'verified');
      p.sections.property.content.total_units = -1;
      assert.deepEqual(verifyStatedMetric(m, p, -100000.21), { state: 'unverifiable', reason: 'negative_size_denominator', computed: null });
      p.sections.property.content.total_units = 0;
      assert.equal(verifyStatedMetric(m, p, 0).reason, 'CALC-DIV-ZERO');
      assert.equal(metric('dscr').null_semantics, 'expression');
    }],
    ['all-class-LTV-uses-underwritten-value-with-lazy-price-fallback', () => {
      for (const cls of d.calculations.filter(m => m.id === 'ltv').flatMap(m => m.asset_classes)) {
        const p = simple(); p.sections.valuation.content.underwritten_value = 120000;
        assert.equal(verifyStatedMetric(metric('ltv', cls), p, 0.625).state, 'verified');
        assert.equal(verifyStatedMetric(metric('ltv', cls), p, 0.749998).state, 'failed');
        delete p.sections.valuation.content.purchase_price;
        assert.equal(verifyStatedMetric(metric('ltv', cls), p, 0.625).state, 'verified');
        p.sections.valuation.content.underwritten_value = 0;
        assert.equal(verifyStatedMetric(metric('ltv', cls), p, 0.625).reason, 'CALC-DIV-ZERO');
        p.sections.valuation.content.underwritten_value = null;
        p.sections.valuation.content.purchase_price = 100000.21;
        assert.equal(verifyStatedMetric(metric('ltv', cls), p, 0.749998).state, 'verified');
      }
    }],
    ['Lite-ratio-token-retains-stated-precision', () => {
      const liteSections = readLiteSections(root);
      const source = '---\nuw_lite_version: 1.0\nasset_class: multifamily\n---\n- NOI: $120 <!-- uw:noi.net_operating_income -->\n- Debt service: $100 <!-- uw:debt.annual_debt_service -->\n- DSCR: 1.20x <!-- uw:debt.dscr -->\n';
      const result = verifyExample(source, d, liteSections);
      assert.deepEqual(result.counts, { verified: 1, failed: 0, unverifiable: 0 });
      assert.equal(result.evidence[0].stated_decimals, 2);
    }],
    ['inputs-and-definition-remain-unchanged' , () => {
      const m = metric('dscr');
      const p = simple();
      const before = JSON.stringify({ m, p });
      verifyStatedMetric(m, p, 2);
      assert.equal(JSON.stringify({ m, p }), before);
    }],
    ...statementHomes(root),
  ];
}

// RFC 0099: every bound home of a metric is checked, each address on its own.
function statementHomes(root) {
  const { cases } = JSON.parse(readFileSync(join(root, 'conformance/metrics/statement-homes/cases.json'), 'utf8'));
  return cases.map(testCase => [`statement-home-${testCase.name}`, () => {
    const report = verifyStatementHome(root, testCase);
    for (const { path, state } of testCase.expect) {
      const found = report.evidence.filter(e => e.path === path);
      assert.equal(found.length, 1, `${path} is stated once`);
      assert.equal(found[0].state, state, `${path}: ${JSON.stringify(found[0])}`);
    }
    for (const path of testCase.absent ?? []) {
      assert.ok(!report.evidence.some(e => e.path === path), `${path} is not a statement`);
    }
    if (testCase.failed !== undefined) assert.equal(report.counts.failed, testCase.failed);
  }]);
}
