import { describe, expect, it } from 'vitest';
import { evaluateCalc as browserEvaluateCalc, evaluateModuleCalculations as browserEvaluateModuleCalculations } from './browser.js';
import {
  evaluateCalc as standardEvaluateCalc,
  evaluateModuleCalculations as standardEvaluateModuleCalculations,
  createModuleRegistry,
  parseUWFile,
  type CalcEvaluationContext,
  type ModuleCalcDecl,
  type ModuleManifest,
} from '@uwmd/verify';
import { evaluateCalc, evaluateModuleCalculations } from './calc-display.js';
import { evaluateCalc as indexEvaluateCalc, evaluateModuleCalculations as indexEvaluateModuleCalculations } from './index.js';

const DOC = [
  '---',
  'uw_version: "3.0"',
  'asset_class: hospitality',
  'quick_metrics:',
  '  purchase_price: 5000000',
  '  noi_underwritten: 425000',
  '  annual_debt_service: 251728.93',
  '---',
  '',
].join('\n');

function ctx(currencyCode?: string): CalcEvaluationContext {
  const parsed = parseUWFile(DOC);
  if (currencyCode) parsed.frontmatter.currency_code = currencyCode;
  return { parsed, prior_results: {}, locale: 'en-US' };
}

function decl(id: string, formula: string, unit?: string): ModuleCalcDecl {
  return { id, label: id, formula, deterministic: true, ...(unit ? { unit } : {}) };
}

const DECLS: ModuleCalcDecl[] = [
  decl('price', 'quick_metrics.purchase_price', '$'),
  decl('dscr', 'quick_metrics.noi_underwritten / quick_metrics.annual_debt_service', 'x'),
  decl('cap', 'quick_metrics.noi_underwritten / quick_metrics.purchase_price', '%'),
  decl('plain', 'quick_metrics.noi_underwritten / 7'),
  decl('flag', 'quick_metrics.purchase_price > 1'),
  decl('missing', 'quick_metrics.no_such_field'),
  decl('parse_error', '1 + + 2'),
  decl('div_zero', '1 / 0', '$'),
];

describe('evaluateCalc (starter wrapper)', () => {
  it('formats $ results', () => {
    const r = evaluateCalc(decl('purchase_price', 'quick_metrics.purchase_price', '$'), ctx());
    expect(r.ok).toBe(true);
    expect(r.value).toBe(5000000);
    expect(r.display).toContain('5,000,000');
  });

  it('threads document currency identity into monetary display only', () => {
    const r = evaluateCalc(decl('purchase_price', 'quick_metrics.purchase_price', '$'), ctx('MXN'));
    expect(r.value).toBe(5000000);
    expect(r.display).toBe('MXN 5,000,000');
  });

  it('formats ratios with an x suffix', () => {
    const r = evaluateCalc(DECLS[1]!, ctx());
    expect(r.display).toMatch(/x$/);
  });

  it('is the standard result plus `display` as its last member, byte for byte', () => {
    for (const d of DECLS) {
      const standard = standardEvaluateCalc(d, ctx('MXN'));
      const wrapped = evaluateCalc(d, ctx('MXN'));
      expect(standard).not.toHaveProperty('display');
      if (standard.ok) {
        expect(Object.keys(wrapped).at(-1), d.id).toBe('display');
        expect(JSON.stringify(wrapped), d.id).toBe(JSON.stringify({ ...standard, display: wrapped.display }));
      } else {
        expect(JSON.stringify(wrapped), d.id).toBe(JSON.stringify(standard));
      }
    }
  });

  it('is the evaluateCalc both public entry points export', () => {
    expect(indexEvaluateCalc).toBe(evaluateCalc);
    expect(browserEvaluateCalc).toBe(evaluateCalc);
  });
});

describe('evaluateModuleCalculations (starter wrapper)', () => {
  const manifest: ModuleManifest = {
    manifest_version: '1',
    id: 'org.example.toy',
    name: 'Toy Module',
    version: '1.0.0',
    description: 'A module that exists to exercise the display wrapper.',
    authors: ['test'],
    license: 'MIT',
    requires_protocol: '^4.0.0',
    requires_format: '^3.0',
    requires_conformance: 'verifier',
    asset_classes: ['hospitality'],
    calculations: [
      { id: 'price', label: 'Price', formula: 'quick_metrics.purchase_price', unit: '$', deterministic: true },
      { id: 'half', label: 'Half', formula: 'price / 2', unit: '$', deterministic: true },
      { id: 'bad', label: 'Bad', formula: 'no_such_builtin(1)', deterministic: true },
    ],
  };
  const registry = createModuleRegistry({ modules: [manifest], hostConformance: 'verifier' });

  it('adds display to each successful outcome and leaves the rest standard', () => {
    const parsed = ctx('MXN').parsed;
    const standard = standardEvaluateModuleCalculations(parsed, registry);
    const wrapped = evaluateModuleCalculations(parsed, registry);
    expect(wrapped.map((o) => o.module_id)).toEqual(standard.map((o) => o.module_id));
    expect(wrapped.map((o) => o.result.display)).toEqual(['MXN 5,000,000', 'MXN 2,500,000', undefined]);
    for (const [i, outcome] of wrapped.entries()) {
      const { display: _display, ...rest } = outcome.result;
      expect(JSON.stringify(rest)).toBe(JSON.stringify(standard[i]!.result));
    }
  });

  it('matches evaluateCalc for each declaration', () => {
    const parsed = ctx().parsed;
    const [price] = evaluateModuleCalculations(parsed, registry);
    expect(price!.result).toEqual(evaluateCalc(manifest.calculations![0]!, { parsed, prior_results: {}, locale: 'en-US' }));
  });

  it('is the evaluateModuleCalculations both public entry points export', () => {
    expect(indexEvaluateModuleCalculations).toBe(evaluateModuleCalculations);
    expect(browserEvaluateModuleCalculations).toBe(evaluateModuleCalculations);
  });
});
