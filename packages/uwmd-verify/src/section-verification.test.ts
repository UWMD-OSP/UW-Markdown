import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { parseUWFile } from './parser.js';
import { verifyCapitalStackDocument, verifyLeaseUpDocument, verifyWaterfallDocument } from './section-verification.js';
import { verifyCapitalStack } from './capital-stack.js';
import { verifyLeaseUpSchedule } from './lease-up.js';
import { verifyWaterfall } from './waterfall.js';
import { verifyStatedMetrics } from './metric-verification.js';
import { verifyReceipt } from './receipts.js';
import { CalcError } from './calc/errors.js';

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const dirs = (p: string) => readdirSync(new URL(`../../../${p}/`, import.meta.url), { withFileTypes: true })
  .filter((e) => e.isDirectory()).map((e) => e.name).sort();
const schema = (name: string) => new Ajv2020({ strict: false }).compile(JSON.parse(read(`spec/schemas/${name}`)));
const sectionSchema = schema('section-verification-report.schema.json');
const FRONT = '---\nuw_version: "3.0"\n---\n';
const fence = (section: string, payload: unknown, variant?: string) =>
  `\n\`\`\`json uw:section=${section}${variant ? ` variant=${variant}` : ''}\n${JSON.stringify(payload)}\n\`\`\`\n`;

describe('RFC 0115 document-level section verifiers', () => {
  it('report an absent section as not_applicable and check nothing', () => {
    const parsed = parseUWFile(`${FRONT}# Nothing stated\n`);
    for (const [verify, section] of [
      [verifyCapitalStackDocument, 'capital_stack'],
      [verifyLeaseUpDocument, 'lease_up_schedule'],
      [verifyWaterfallDocument, 'distribution_waterfall'],
    ] as const) {
      const report = verify(parsed);
      expect(report).toEqual({ section, variant: null, status: 'not_applicable', verification: null });
      expect(sectionSchema(report), JSON.stringify(sectionSchema.errors)).toBe(true);
    }
  });

  it('select by §VIII.2 and refuse an ambiguous or missing variant', () => {
    const unverifiable = JSON.parse(read('conformance/lease-up/verify-missing-denominator/case.json')).schedule;
    const failed = JSON.parse(read('conformance/lease-up/verify-stated-sum-disagrees/case.json')).schedule;
    const two = parseUWFile(FRONT + fence('lease_up_schedule', unverifiable, 'upside') + fence('lease_up_schedule', failed, 'downside'));
    expect(() => verifyLeaseUpDocument(two)).toThrow(CalcError);
    expect(() => verifyLeaseUpDocument(two, { variant: 'absent' })).toThrow(CalcError);
    expect(verifyLeaseUpDocument(two, { variant: 'upside' })).toMatchObject({ variant: 'upside', status: 'unverifiable' });
    expect(verifyLeaseUpDocument(two, { variant: 'downside' })).toMatchObject({ variant: 'downside', status: 'failed' });
    const base = parseUWFile(FRONT + fence('lease_up_schedule', unverifiable, 'upside') + fence('lease_up_schedule', failed, 'base'));
    expect(verifyLeaseUpDocument(base)).toMatchObject({ variant: 'base', status: 'failed' });
  });

  it('resolve a waterfall series exactly as the WF-02 rule does', () => {
    const { waterfall, series } = JSON.parse(read('conformance/waterfall/verify-classic-outcomes/case.json'));
    const variant = waterfall.cash_flow_ref.variant;
    const resolved = parseUWFile(FRONT + fence('distribution_waterfall', waterfall) + fence('cash_flow_series', series, variant));
    expect(verifyWaterfallDocument(resolved).verification).toEqual(verifyWaterfall(waterfall, series));
    const other = parseUWFile(FRONT + fence('distribution_waterfall', waterfall) + fence('cash_flow_series', series, `${variant}-other`));
    expect(verifyWaterfallDocument(other).verification).toEqual(verifyWaterfall(waterfall, null));
  });

  // Every derived document holds exactly the payload the reference runner
  // passes to the bare verifier, so both answers must be the same object.
  it.each(dirs('conformance/runner/derived/capital-stack'))('capital-stack %s restates its bare case', (name) => {
    const bare = JSON.parse(read(`conformance/capital-stack/${name}/case.json`));
    const report = verifyCapitalStackDocument(parseUWFile(read(`conformance/runner/derived/capital-stack/${name}/deal.uwx.md`)));
    expect(report.verification).toEqual(verifyCapitalStack(bare.stack, bare.context));
    expect(sectionSchema(report), JSON.stringify(sectionSchema.errors)).toBe(true);
  });
  it.each(dirs('conformance/runner/derived/lease-up'))('lease-up %s restates its bare case', (name) => {
    const bare = JSON.parse(read(`conformance/lease-up/${name}/case.json`));
    const report = verifyLeaseUpDocument(parseUWFile(read(`conformance/runner/derived/lease-up/${name}/deal.uwx.md`)));
    expect(report.verification).toEqual(verifyLeaseUpSchedule(bare.schedule, bare.context));
    expect(sectionSchema(report), JSON.stringify(sectionSchema.errors)).toBe(true);
  });
  it.each(dirs('conformance/runner/derived/waterfall'))('waterfall %s restates its bare case', (name) => {
    const bare = JSON.parse(read(`conformance/waterfall/${name}/case.json`));
    const report = verifyWaterfallDocument(parseUWFile(read(`conformance/runner/derived/waterfall/${name}/deal.uwx.md`)));
    expect(report.verification).toEqual(verifyWaterfall(bare.waterfall, bare.series ?? null));
    expect(sectionSchema(report), JSON.stringify(sectionSchema.errors)).toBe(true);
  });
});

describe('RFC 0115 result schemas', () => {
  it('every statement-home report matches stated-metrics-report.schema.json', () => {
    const validate = schema('stated-metrics-report.schema.json');
    for (const name of dirs('conformance/runner/derived/metrics')) {
      const report = verifyStatedMetrics(parseUWFile(read(`conformance/runner/derived/metrics/${name}/deal.uwx.md`)));
      expect(validate(report), `${name}: ${JSON.stringify(validate.errors)}`).toBe(true);
    }
  });

  it('every pack-less receipt verification matches receipt-verification.schema.json', async () => {
    const validate = schema('receipt-verification.schema.json');
    for (const name of dirs('conformance/receipts/verify')) {
      const dir = `conformance/receipts/verify/${name}`;
      const expected = JSON.parse(read(`${dir}/expected-verdict.json`));
      if (expected.refused_code) continue; // refused before verification
      const deal = readdirSync(new URL(`../../../${dir}/`, import.meta.url)).find((f) => /\.uwx?\.md$/.test(f))!;
      const inputs = existsSync(new URL(`../../../${dir}/inputs.json`, import.meta.url))
        ? JSON.parse(read(`${dir}/inputs.json`)) : undefined;
      const result = await verifyReceipt(JSON.parse(read(`${dir}/receipt.json`)), read(`${dir}/${deal}`),
        { filename: deal, packs: [], ...(inputs ? { inputs } : {}) });
      expect(validate(result), `${name}: ${JSON.stringify(validate.errors)}`).toBe(true);
    }
  });
});
