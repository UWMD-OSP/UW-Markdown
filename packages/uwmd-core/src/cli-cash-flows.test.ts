import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CalcError } from './calc/errors.js';
import { parseCashFlowVerificationArgs, verifyCashFlowDocument } from './cli-cash-flows.js';

const specimen = JSON.parse(readFileSync(new URL('../../../conformance/cash-flow/verify-all-metrics/case.json', import.meta.url), 'utf8')).series;
const block = (content: unknown, variant = 'base', suffix = '') =>
  `\n\`\`\`json uw:section=cash_flow_series variant=${variant} source=manual v=1${suffix}\n${JSON.stringify(content)}\n\`\`\`\n`;
const doc = (content: unknown = specimen) => `---\nuw_version: "2.0"\n---\n${block(content)}`;

describe('cash-flow verification CLI boundary', () => {
  it('preserves the existing all-metric verification and source text', () => {
    const source = doc(); const before = source;
    expect(verifyCashFlowDocument(source)).toMatchObject({ exitCode: 0, report: {
      variant: 'base', status: 'verified', checked_metrics: ['total_net', 'moic', 'xnpv', 'xirr'],
      verification: { verdict: 'verified', issues: [] },
    } });
    expect(source).toBe(before);
  });
  it('distinguishes no claims from a successful metric comparison', () => {
    for (const stated_metrics of [undefined, null, {}, { xirr: null }])
      expect(verifyCashFlowDocument(doc({ ...specimen, stated_metrics }))).toMatchObject({
        exitCode: 3, report: { status: 'no_stated_metrics', checked_metrics: [], verification: null },
      });
  });
  it('preserves zero claims and the default day-count convention', () => {
    const payload = { series: [{ date: '2026-01-01', amount: -100 }, { date: '2027-01-01', amount: 100 }],
      stated_metrics: { total_net: 0, xirr: 0 } };
    expect(verifyCashFlowDocument(doc(payload)).report.checked_metrics).toEqual(['total_net', 'xirr']);
    expect(verifyCashFlowDocument(doc(payload)).exitCode).toBe(0);
  });
  it('preserves failed and unverifiable verdicts', () => {
    expect(verifyCashFlowDocument(doc({ ...specimen, stated_metrics: { total_net: 1 } })))
      .toMatchObject({ exitCode: 1, report: { status: 'failed', verification: { issues: [{ code: 'CF-METRIC-DISAGREES' }] } } });
    expect(verifyCashFlowDocument(doc({ ...specimen, stated_metrics: { xnpv: { rate: 0.06 } } })))
      .toMatchObject({ exitCode: 3, report: { status: 'unverifiable' } });
    expect(verifyCashFlowDocument(doc({ series: [{ date: '2026-01-01', amount: 100 }], stated_metrics: { moic: 1 } })))
      .toMatchObject({ exitCode: 3, report: { status: 'unverifiable' } });
  });
  it('selects exact variants and refuses unresolved variants', () => {
    const source = block(specimen, 'a') + block({ ...specimen, stated_metrics: { total_net: 1 } }, 'b');
    expect(() => verifyCashFlowDocument(source)).toThrow(CalcError);
    expect(verifyCashFlowDocument(source, 'a').exitCode).toBe(0);
    expect(verifyCashFlowDocument(source, 'b').exitCode).toBe(1);
    expect(() => verifyCashFlowDocument(source, 'absent')).toThrow(CalcError);
  });
  it('uses existing primary/component selection rules', () => {
    const source = block({ ...specimen, _role: 'primary' }, 'main') +
      block({ ...specimen, _role: 'component' }, 'part');
    expect(verifyCashFlowDocument(source).report.variant).toBe('main');
    expect(verifyCashFlowDocument(source, 'part').report.variant).toBe('part');
  });
  it('refuses malformed structure even with no stated metrics', () => {
    for (const content of [null, [], { series: [] }, { series: [null] },
      { series: [{ date: '2026-02-30', amount: 0 }] },
      { series: [{ date: '2026-01-01', amount: null }] },
      { series: [{ date: '2026-01-01', amount: '100' }] },
      { series: [{ date: '2026-01-01', amount: 0, kind: 'mystery' }] },
      { series: [{ date: '2026-01-01', amount: 0, label: 3 }] },
      { ...specimen, day_count: 'unknown' },
      { ...specimen, series: [...specimen.series].reverse() }])
      expect(() => verifyCashFlowDocument(doc(content))).toThrow();
  });
  it('refuses nonnumeric claims rather than letting the numeric verifier skip them', () => {
    for (const stated_metrics of ['bad', [], { total_net: '6043000' }, { xirr: false },
      { xnpv: 0 }, { xnpv: { rate: '0.06', value: 0 } }])
      expect(() => verifyCashFlowDocument(doc({ ...specimen, stated_metrics }))).toThrow(CalcError);
    expect(() => verifyCashFlowDocument(doc().replace('6043000', '1e309'))).toThrow(CalcError);
  });
  it('does not select superseded claims and supports nested content', () => {
    const source = block({ ...specimen, stated_metrics: { total_net: 1 } }, 'base', ' superseded=true') +
      block({ content: specimen }, 'base');
    expect(verifyCashFlowDocument(source, 'base').exitCode).toBe(0);
    expect(() => verifyCashFlowDocument(block(specimen, 'base', ' superseded=true'), 'base')).toThrow(CalcError);
  });
  it.each(['verify-all-metrics', 'verify-procedure-refuses', 'verify-moic-no-outflows',
    'verify-same-day-flows', 'verify-stated-xirr-disagrees'])('preserves the existing %s conformance outcome', name => {
    const folder = new URL(`../../../conformance/cash-flow/${name}/`, import.meta.url);
    const input = JSON.parse(readFileSync(new URL('case.json', folder), 'utf8'));
    const expected = JSON.parse(readFileSync(new URL('expected.json', folder), 'utf8'));
    const result = verifyCashFlowDocument(doc(input.series));
    expect(result.report.verification?.verdict).toBe(expected.verdict);
    if (expected.expected_code) expect(result.report.verification?.issues.map(i => i.code)).toContain(expected.expected_code);
  });
  it('refuses malformed JSON and missing sections', () => {
    expect(() => verifyCashFlowDocument('\n```json uw:section=cash_flow_series\n{broken\n```')).toThrow(CalcError);
    expect(() => verifyCashFlowDocument('# No cash flows')).toThrow(CalcError);
  });
});

describe('cash-flow verification arguments', () => {
  it('accepts flags before the file and both variant forms', () => {
    expect(parseCashFlowVerificationArgs(['--json', '--variant', 'base', 'deal.uwx.md']))
      .toEqual({ file: 'deal.uwx.md', variant: 'base', json: true });
    expect(parseCashFlowVerificationArgs(['deal.uwx.md', '--variant=base']))
      .toEqual({ file: 'deal.uwx.md', variant: 'base', json: false });
  });
  it.each([[], ['a', 'b'], ['a', '--output=b'], ['a', '--json=false'], ['a', '--variant'],
    ['a', '--variant='], ['a', '--variant', '--json'], ['a', '--json', '--json'],
    ['a', '--variant=a', '--variant=b'], ['a', '--calc-context=x']])('refuses %j', (...args) => {
    expect(() => parseCashFlowVerificationArgs(args as string[])).toThrow(CalcError);
  });
});
