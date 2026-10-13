import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { verifyReserveDrawBindings } from './reserve-draw-bindings.js';
import { verifyReserveDrawBindings as browserVerify } from './browser.js';
import { parseUWFile, getSectionVariant, blockPayload } from './parser.js';
import { validateUWFile, lookupRemediation } from './validator.js';
import * as envelope from './envelope.js';
import * as quantizer from './calc/quantize.js';
import { assemblePropertyCashFlows, PropertyCashFlowAssemblyError } from './property-cash-flows.js';
import type { ReserveDrawBindingPlan, PropertyCashFlowPlan } from './protocol.js';
const path = (p: string) => new URL(`../../../${p}`, import.meta.url);
const read = (p: string) => readFileSync(path(p), 'utf8');
const cases = readdirSync(path('conformance/reserve-draw-bindings/'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);
const fixture = (name: string) => {
  const prefix = `conformance/reserve-draw-bindings/${name}/`;
  return {
    parsed: parseUWFile(read(`${prefix}deal.uwx.md`)),
    plan: existsSync(path(`${prefix}plan.json`))
      ? (JSON.parse(read(`${prefix}plan.json`)) as ReserveDrawBindingPlan)
      : undefined,
  };
};
const ajv = new Ajv2020({ strict: false });
addFormats.default(ajv);
const planSchema = JSON.parse(read('spec/schemas/reserve-draw-binding-plan.schema.json'));
ajv.addSchema(planSchema);
const resultSchema = ajv.compile(
  JSON.parse(read('spec/schemas/reserve-draw-binding-verification.schema.json')),
);
describe('RFC 0065 source-addressed reserve draw binding', () => {
  it('leaves a legacy document without accounts or a plan exactly unchanged', async () => {
    const parsed = parseUWFile(read('docs/examples/property-cash-flow-synthetic.uwx.md'));
    const plan = JSON.parse(
      read('docs/examples/property-cash-flow-plan.json'),
    ) as PropertyCashFlowPlan;
    const validation = validateUWFile(parsed);
    const assembly = await assemblePropertyCashFlows(parsed, plan);
    expect(await verifyReserveDrawBindings(parsed)).toEqual({
      state: 'not_checked',
      reason: 'not_applicable',
      source_digest: null,
      evidence: [],
      issues: [],
    });
    expect(validateUWFile(parsed)).toEqual(validation);
    expect(await assemblePropertyCashFlows(parsed, plan)).toEqual(assembly);
  });
  it.each([null, false, [], 'plan', () => {}, { callback: () => {} }].map((input) => ({ input })))(
    'refuses non-plan inputs with typed evidence (%j)',
    async ({ input }) => {
      const { parsed } = fixture('one-to-one');
      const result = await verifyReserveDrawBindings(parsed, input);
      expect(result.state).toBe('unverifiable');
      expect(result.issues[0]!.code).toBe('RDB-01');
    },
  );
  it.each(cases)(
    '%s matches independent verdict/codes and wire schemas without edits',
    async (name) => {
      const { parsed, plan } = fixture(name);
      const before = structuredClone({ parsed, plan });
      const validation = validateUWFile(parsed);
      const result = await verifyReserveDrawBindings(parsed, plan);
      expect({ state: result.state, issues: result.issues.map((i) => ({ code: i.code })) }).toEqual(
        JSON.parse(read(`conformance/reserve-draw-bindings/${name}/expected.json`)),
      );
      expect(resultSchema(result), JSON.stringify(resultSchema.errors)).toBe(true);
      if (plan !== undefined && !ajv.validate(planSchema, plan))
        expect(
          result.issues.some((i) => i.code === 'RDB-01'),
          JSON.stringify(ajv.errors),
        ).toBe(true);
      expect({ parsed, plan }).toEqual(before);
      expect(validateUWFile(parsed)).toEqual(validation);
    },
  );
  it('retains exact gross cells, draw identities, declared funded shares and provenance', async () => {
    const { parsed, plan } = fixture('many-to-many-partial');
    const result = await verifyReserveDrawBindings(parsed, plan);
    expect(result.source_digest).toBe(
      await envelope.computeEnvelopeDigest(envelope.toUWEnvelope(parsed)),
    );
    expect(result.evidence.map((e) => e.funded_amount)).toEqual([30, 30, 20, 20]);
    expect(result.evidence.map((e) => e.expenditure.gross_amount)).toEqual([-80, -70, -80, -70]);
    expect(result.evidence.every((e) => e.expenditure.stated_funded_amount === 50)).toBe(true);
    expect(result.evidence[0]!.draw.source_path).toContain('accounts[0].periods[0].movements[0]');
    expect(result.evidence[0]!.expenditure.source_path).toBe(
      'sections.cash_flow_series["gross"].series[0].amount',
    );
    expect(result.evidence[0]!.draw.meta).toEqual(
      getSectionVariant(parsed, 'reserve_accounts', 'default')!.meta,
    );
    expect(result.evidence[0]!.expenditure.source).toEqual(plan!.expenditures[0]!.source);
    expect(browserVerify).toBe(verifyReserveDrawBindings);
  });
  it.each(['cent-split-draw', 'cent-multiple-draws'])(
    '%s fails with the pre-fix integral shortcut',
    async (name) => {
      const { parsed, plan } = fixture(name);
      const correct = quantizer.quantizeDecimalAtStatedPrecision;
      const spy = vi
        .spyOn(quantizer, 'quantizeDecimalAtStatedPrecision')
        .mockImplementation((n, decimals) => {
          const [c, e] = Math.abs(n).toExponential().split('e');
          const shifted = Number(`${c}e${Number(e) + decimals}`);
          // Negative control: restore only the obsolete nonzero-integral shortcut from pre-#291.
          return shifted !== 0 && Number.isInteger(shifted) ? n : correct(n, decimals);
        });
      try {
        expect((await verifyReserveDrawBindings(parsed, plan)).state).toBe('failed');
      } finally {
        spy.mockRestore();
      }
      expect((await verifyReserveDrawBindings(parsed, plan)).state).toBe('verified');
    },
  );
  it('returns every finite edge even when aggregate allocation overflows', async () => {
    const { parsed, plan } = fixture('nonfinite-allocation');
    const result = await verifyReserveDrawBindings(parsed, plan);
    expect(result.reason).toBe('nonfinite_arithmetic');
    expect(result.evidence).toHaveLength(4);
    expect(result.evidence.every((e) => Number.isFinite(e.funded_amount))).toBe(true);
  });
  it('does not turn a lease-up period into a cash date or bind the net bundle', async () => {
    const { parsed, plan } = fixture('lease-up-component');
    const result = await verifyReserveDrawBindings(parsed, plan);
    expect(result.evidence[0]!.expenditure).toMatchObject({
      date: null,
      period: '2026-01',
      gross_amount: -100,
    });
    (plan!.expenditures[0]!.ref as unknown as { field: string }).field = 'net_cash_flow';
    expect((await verifyReserveDrawBindings(parsed, plan)).issues[0]!.code).toBe('RDB-01');
  });
  it('snapshots both caller-owned inputs before awaiting', async () => {
    const { parsed, plan } = fixture('one-to-one');
    const pending = verifyReserveDrawBindings(parsed, plan);
    plan!.bindings[0]!.funded_amount = 200;
    parsed.frontmatter.currency_code = 'EUR';
    expect((await pending).state).toBe('verified');
  });
  it('returns unverifiable when the digest is unavailable', async () => {
    const { parsed, plan } = fixture('one-to-one');
    const spy = vi
      .spyOn(envelope, 'computeEnvelopeDigest')
      .mockRejectedValueOnce(new Error('unavailable'));
    try {
      expect(await verifyReserveDrawBindings(parsed, plan)).toMatchObject({
        state: 'unverifiable',
        reason: 'digest_unavailable',
        source_digest: null,
        evidence: [],
      });
    } finally {
      spy.mockRestore();
    }
  });
  it('does not fall back to a different variant, and ignores unrelated reserve variants', async () => {
    const { parsed, plan } = fixture('one-to-one');
    const unrelated = structuredClone(getSectionVariant(parsed, 'reserve_accounts', 'default')!);
    unrelated.annotation.variant = 'unrelated';
    (blockPayload(unrelated) as any).accounts[0].periods[0].ending_balance = 999;
    (parsed.sections.reserve_accounts as Record<string, typeof unrelated>).unrelated = unrelated;
    plan!.source_digest = await envelope.computeEnvelopeDigest(envelope.toUWEnvelope(parsed));
    expect((await verifyReserveDrawBindings(parsed, plan)).state).toBe('verified');
    plan!.selected_draws[0]!.variant = 'missing';
    plan!.bindings[0]!.draw.variant = 'missing';
    expect((await verifyReserveDrawBindings(parsed, plan)).issues[0]!.code).toBe('RDB-03');
  });
  it('refuses nonfinite allocations and registers every finding', async () => {
    const { parsed, plan } = fixture('one-to-one');
    plan!.bindings[0]!.funded_amount = Number.POSITIVE_INFINITY;
    expect((await verifyReserveDrawBindings(parsed, plan)).issues[0]!.code).toBe('RDB-01');
    for (let i = 1; i <= 9; i++) expect(lookupRemediation(`RDB-0${i}`)?.code).toBe(`RDB-0${i}`);
  });
  it('a verified binding still leaves the RFC 0045 reserve-spending refusal intact', async () => {
    const base = read(
      'conformance/property-cash-flow-assembly/boundary-reserve-spending/deal.uwx.md',
    );
    const binding = read('conformance/reserve-draw-bindings/one-to-one/deal.uwx.md');
    const parsed = parseUWFile(
      `${base}\n${binding.slice(binding.indexOf('```json uw:section=reserve_accounts'))}`,
    );
    const plan = fixture('one-to-one').plan!;
    plan.source_digest = await envelope.computeEnvelopeDigest(envelope.toUWEnvelope(parsed));
    expect((await verifyReserveDrawBindings(parsed, plan)).state).toBe('verified');
    const assemblyPlan = JSON.parse(
      read('conformance/property-cash-flow-assembly/boundary-reserve-spending/plan.json'),
    ) as PropertyCashFlowPlan;
    try {
      await assemblePropertyCashFlows(parsed, assemblyPlan);
      throw new Error('Expected refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(PropertyCashFlowAssemblyError);
      expect((error as PropertyCashFlowAssemblyError).proto.pointer).toBe(
        'plan.assertions.reserve_spending_excluded',
      );
    }
  });
});
