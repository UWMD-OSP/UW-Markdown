import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyProForma } from './pro-forma.js';
import { parseUWFile } from './parser.js';
import type { UWBlock } from './types.js';
const base = new URL('../../../conformance/pro-forma/', import.meta.url);
const dirs = readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
it.each(dirs)('satisfies the authored %s control without changing source bytes', name => {
  const source = readFileSync(new URL(name + '/deal.uwx.md', base), 'utf8');
  const expected = JSON.parse(readFileSync(new URL(name + '/expected.json', base), 'utf8'));
  const before = source;
  const report = verifyProForma(source);
  expect(report).toMatchObject(expected);
  expect(source).toBe(before);
  expect(report.coverage.total).toBe(report.assertions.length);
  expect(report.coverage.total).toBe(Object.values(report.coverage.by_verdict).reduce((a,b) => a+b,0));
});
it('separates current-model state from stale source and leaves the model unchanged', () => {
  const source = readFileSync(new URL('verified-moic/deal.uwx.md', base), 'utf8');
  const model = parseUWFile(source);
  (model.sections.dcf as UWBlock).content.result = 9;
  const before = JSON.stringify(model);
  const report = verifyProForma(model);
  expect(report.selection.operation).toBe('model');
  expect(report.assertions[0]).toMatchObject({ stated: 9, state: 'failed', target: { block_address_kind: 'model' } });
  expect(JSON.stringify(model)).toBe(before);
  expect(verifyProForma(source).assertions[0]!.state).toBe('verified');
});
it('refuses absent claims with the bounded typed request code', () => {
  expect(() => verifyProForma('---\nuw_version: "3.0"\nasset_class: multifamily\n---\n')).toThrow(/CALC-PRO-FORMA/);
});
it('does not invoke accessors in an untrusted current model', () => {
  const source = readFileSync(new URL('empty/deal.uwx.md', base), 'utf8');
  const model = parseUWFile(source); let invoked = false;
  Object.defineProperty(model.frontmatter, 'trap', { enumerable: true, get() { invoked = true; return 1; } });
  expect(() => verifyProForma(model)).toThrow(); expect(invoked).toBe(false);
});

// Authored boundary controls exercise composed assessment rather than only helpers.
const at = (section: string, pointer = '', variant: string | null = null) => ({ section, variant, pointer });
function specimen(dcf: Record<string, unknown>, sections: Record<string, unknown> = {}) {
  return '---\nuw_version: "3.0"\nasset_class: office\ncurrency_code: USD\ndeal_id: SYNTHETIC\ndeal_name: Synthetic controls\ndeal_stage: screening\n---\n' +
    Object.entries({ dcf, ...sections }).map(([section, value]) => `\n\`\`\`json uw:section=${section} source=manual\n${JSON.stringify(value)}\n\`\`\`\n`).join('');
}
const claimOf = (relationships: unknown[], extra: Record<string, unknown> = {}) => ({ profile: 'pro-forma', level: 'L1', convention_registry: 'uwmd.pro-forma.l1.1', rows: [], relationships, ...extra });
const moicRel = () => ({ identity: 'moic', procedure_version: '1', target: at('dcf', '/result'), inputs: [{ role: 'stream', address: at('cash_flow_series') }], unit: 'x', conventions: { cash_flow_timing: 'dated' } });
const flows = { day_count: 'actual/365f', series: [{ date: '2025-01-01', amount: -100 }, { date: '2026-01-01', amount: 120 }] };
const ltvRel = (target = at('dcf', '/result'), denominator = at('valuation', '/underwritten_value'), loan = at('debt_structure')) => ({ identity: 'ltv', procedure_version: '1', target, inputs: [{ role: 'loan', address: loan }, { role: 'denominator', address: denominator }], unit: '%' });
it.each([
  { unit: '%' }, { currency: 'EUR' }, { procedure_version: '2' },
  { conventions: { cash_flow_timing: 'end' } }, { selectors: { period: 'Y1' } },
  { applicability: { applicable: false, reason: 'explicit exclusion' } },
  { unexpected: true },
])('retains conflicting complete semantics under one physical assertion: %j', change => {
  const a = { ...moicRel(), id: 'same' }, b = { ...a, ...change };
  const r = verifyProForma(specimen({ result: 1.2, pro_forma: claimOf([a,b]) }, { cash_flow_series: flows }));
  expect(r.assertions).toHaveLength(1);
  expect(r.assertions[0]!.state).toBe('unverifiable');
  expect(r.assertions[0]!.reasons).toContain('relationship_collision');
});
it('retains identifier collisions across distinct targets and invalid duplicates', () => {
  const a = { ...moicRel(), id: 'same' };
  const r = verifyProForma(specimen({ result: 1.2, second: 1.2, pro_forma: claimOf([a, { ...a, target: at('dcf', '/second') }]) }, { cash_flow_series: flows }));
  expect(r.coverage.by_verdict.unverifiable).toBe(2);
  const invalid = { ...a, unexpected: true };
  const duplicates = verifyProForma(specimen({ result: 1.2, pro_forma: claimOf([invalid, invalid]) }, { cash_flow_series: flows }));
  expect(duplicates.relationships).toHaveLength(2);
  expect(duplicates.relationships.every(r => r.state === 'unverifiable')).toBe(true);
});
it('keeps an independently established failure when a conflicting method is unavailable', () => {
  const a = moicRel();
  const r = verifyProForma(specimen({ result: 9, pro_forma: claimOf([a, { ...a, conventions: { cash_flow_timing: 'end' } }]) }, { cash_flow_series: flows }));
  expect(r.assertions[0]!.state).toBe('failed');
  expect(r.relationships.map(r => r.local_state)).toEqual(['failed','unverifiable']);
});
it('blocks self-copy and cycles whose local arithmetic agrees', () => {
  const value = at('valuation', '/underwritten_value'), cost = at('sources_uses', '/total_project_cost');
  const a = ltvRel(value, cost, at('debt_structure', '', 'cost'));
  const b = ltvRel(cost, value, at('debt_structure', '', 'value'));
  const source = specimen({ pro_forma: claimOf([a,b]) }, { valuation: { underwritten_value: 1 }, sources_uses: { total_project_cost: 1 } }) +
    '\n```json uw:section=debt_structure variant=cost source=manual\n{"_role":"senior","loan_amount":1,"ltv_basis":"total-project-cost"}\n```\n' +
    '\n```json uw:section=debt_structure variant=value source=manual\n{"_role":"junior","loan_amount":1,"ltv_basis":"underwritten-value"}\n```\n';
  const r = verifyProForma(source);
  expect(r.relationships.map(r => r.local_state)).toEqual(['verified','verified']);
  expect(r.coverage.by_verdict).toEqual({ verified: 0, failed: 0, unverifiable: 2 });
  expect(r.relationships.every(r => r.reason === 'blocked_dependency')).toBe(true);
  const self = verifyProForma(specimen({ pro_forma: claimOf([ltvRel(value, value)]) }, { valuation: { underwritten_value: 1 }, debt_structure: { loan_amount: 1, ltv_basis: 'underwritten-value' } }));
  expect(self.relationships[0]).toMatchObject({ local_state: 'verified', state: 'unverifiable', reason: 'blocked_dependency' });
});
it('does not let two selected loans create two assertions for one target', () => {
  const a = ltvRel(at('dcf', '/result'), at('valuation', '/underwritten_value'), at('debt_structure', '', 'a'));
  const b = ltvRel(at('dcf', '/result'), at('valuation', '/underwritten_value'), at('debt_structure', '', 'b'));
  const source = specimen({ result: 0.5, pro_forma: claimOf([a,b]) }, { valuation: { underwritten_value: 100 } }) +
    ['a','b'].map(variant => `\n\`\`\`json uw:section=debt_structure variant=${variant} source=manual\n{"_role":"component","loan_amount":50,"ltv_basis":"underwritten-value"}\n\`\`\`\n`).join('');
  const r = verifyProForma(source);
  expect(r.assertions.find(a => a.address.section === 'dcf')!.reasons).toContain('ambiguous_context');
  expect(r.assertions.filter(a => a.address.section === 'dcf')).toHaveLength(1);
});
it('uses exact model precision evidence and never stale source tokens', () => {
  const source = specimen({ result: 0.63, pro_forma: claimOf([ltvRel()], { rows: [{ address: at('valuation', '/underwritten_value'), kind: 'input' }] }) }, { valuation: { underwritten_value: 120 }, debt_structure: { loan_amount: 75, ltv_basis: 'underwritten-value' } });
  const model = parseUWFile(source);
  const r = verifyProForma(model), key = r.assertions.find(a => a.address.section === 'dcf')!.key;
  expect(r.relationships[0]!.reason).toBe('missing_stated_precision');
  const before = JSON.stringify(model);
  expect(verifyProForma(model, { numericTokens: new Map([[key, '0.63']]) }).relationships[0]!.state).toBe('verified');
  expect(verifyProForma(model, { numericTokens: new Map([[key, '0.630000']]) }).relationships[0]!.state).toBe('failed');
  for (const token of ['+0.63',' 0.63','0.64','NaN','.63']) expect(verifyProForma(model, { numericTokens: new Map([[key, token]]) }).relationships[0]!.reason).toBe('missing_stated_precision');
  expect(JSON.stringify(model)).toBe(before);
});
it.each(['0.63','6.3e-1','0.630000'])('retains original fractional LTV token precision: %s', token => {
  const source = specimen({ result: 0.63, pro_forma: claimOf([ltvRel()], { rows: [{ address: at('valuation', '/underwritten_value'), kind: 'input' }] }) }, { valuation: { underwritten_value: 120 }, debt_structure: { loan_amount: 75, ltv_basis: 'underwritten-value' } }).replace('"result":0.63', '"result":' + token);
  expect(verifyProForma(source).relationships[0]!.state).toBe(token === '0.630000' ? 'failed' : 'verified');
});
it('does not recursively turn a helper stream into numeric assertions', () => {
  const r = verifyProForma(specimen({ result: 1.2, pro_forma: claimOf([moicRel()]) }, { cash_flow_series: flows }));
  expect(r.assertions).toHaveLength(1);
});
it('keeps unknown input families visible without an assertion or exit effect', () => {
  const r = verifyProForma(specimen({ assumption: 0.1, pro_forma: claimOf([], { rows: [{ address: at('dcf','/assumption'), family: 'alien', kind: 'assumption' }] }) }));
  expect(r.input_count).toBe(1); expect(r.coverage.total).toBe(0);
  expect(r.profile_claim_findings).toContainEqual(expect.objectContaining({ code: 'unrecognized_family' }));
});
it('accounts for distinct equal ledger events and conflicting target allocations', () => {
  const event = at('cash_flow_series','/series/0'), other = at('cash_flow_series','/series/1');
  const ledger = { universe: [event,other].map(event => ({ event, role: 'acquisition', required: true })), bindings: [event,other].map(event => ({ event, role: 'acquisition' })), exclusions: [] };
  const assess = (value: unknown) => verifyProForma(specimen({ pro_forma: claimOf([], { ledger: value }) }, { cash_flow_series: { ...flows, series: [flows.series[0], flows.series[0]] } }));
  expect(assess(ledger).gaps).toHaveLength(0); expect(assess(ledger).coverage.total).toBe(0);
  const conflict = { ...ledger, bindings: [{ event, role: 'acquisition', target: at('cash_flow_series','/series/0/amount') }, { event, role: 'acquisition', target: at('cash_flow_series','/series/1/amount') }] };
  expect(assess(conflict).gaps).toContainEqual(expect.objectContaining({ required: true, reason: 'conflicting_membership' }));
  expect(assess(conflict).exit_code).toBe(1);
  expect(assess({ ...ledger, bindings: [{ event, role: 'acquisition', target: at('cash_flow_series','/missing') }] }).gaps).toContainEqual(expect.objectContaining({ reason: 'invalid_binding' }));
});

it('validates every completed fixture report and accepted claim against the synchronized schemas', async () => {
  const { Ajv2020 } = await import('ajv/dist/2020.js');
  const { default: addFormats } = await import('ajv-formats');
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats.default(ajv);
  const schemaDir = new URL('../../../spec/schemas/', import.meta.url);
  for (const name of readdirSync(schemaDir).filter(n => n.endsWith('.schema.json'))) ajv.addSchema(JSON.parse(readFileSync(new URL(name, schemaDir), 'utf8')));
  const reportSchema = ajv.getSchema('https://uwmd.org/schemas/pro-forma-report.schema.json')!;
  const claimSchema = ajv.getSchema('https://uwmd.org/schemas/pro-forma-claim.schema.json')!;
  for (const name of dirs) {
    const source = readFileSync(new URL(name + '/deal.uwx.md', base), 'utf8');
    const report = verifyProForma(source);
    expect(reportSchema(report), name + ': ' + JSON.stringify(reportSchema.errors)).toBe(true);
    if (name === 'verified-moic' || name === 'empty') {
      const claim = (parseUWFile(source).sections.dcf as UWBlock).content.pro_forma;
      expect(claimSchema(claim), JSON.stringify(claimSchema.errors)).toBe(true);
    }
  }
  expect(claimSchema({ profile: 'pro-forma', level: 'L2' })).toBe(false);
});
