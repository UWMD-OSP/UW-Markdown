import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { verifyReserveAccounts } from './reserve-accounts.js';
import { verifyReserveAccounts as browserVerify } from './browser.js';
import { parseUWFile, blockPayload, getSection, getSectionVariant } from './parser.js';
import * as envelope from './envelope.js';
import { validateUWFile } from './validator.js';
import { assemblePropertyCashFlows, PropertyCashFlowAssemblyError } from './property-cash-flows.js';
import type { PropertyCashFlowPlan, ReserveAccounts } from './protocol.js';

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const fixture = (name: string) => read(`conformance/reserve-accounts/${name}/deal.uwx.md`);
const fresh = () => parseUWFile(fixture('verified-source-classes'));
const content = (p: ReturnType<typeof fresh>) =>
  blockPayload(getSectionVariant(p, 'reserve_accounts', 'default')!) as unknown as ReserveAccounts;
const ajv = new Ajv2020({ strict: false });
addFormats.default(ajv);
ajv.addSchema(JSON.parse(read('spec/schemas/section-reserve-accounts.schema.json')));
const resultSchema = ajv.compile(
  JSON.parse(read('spec/schemas/reserve-accounts-verification.schema.json')),
);

describe('RFC 0064 stated custody balances', () => {
  it.each(
    readdirSync(new URL('../../../conformance/reserve-accounts/', import.meta.url), {
      withFileTypes: true,
    })
      .filter((e) => e.isDirectory())
      .map((e) => e.name),
  )('%s has the authored verdict, exact codes and result schema', async (name) => {
    const parsed = parseUWFile(fixture(name));
    const before = structuredClone(parsed);
    const expected = JSON.parse(read(`conformance/reserve-accounts/${name}/expected.json`));
    const result = await verifyReserveAccounts(parsed);
    expect({ state: result.state, issues: result.issues.map((i) => ({ code: i.code })) }).toEqual(
      expected,
    );
    expect(resultSchema(result), JSON.stringify(resultSchema.errors)).toBe(true);
    expect(parsed).toEqual(before);
    const structural = validateUWFile(parsed).errors.filter((i) => i.code.startsWith('RSV-'));
    expect(structural.map((i) => i.code)).toEqual(
      result.issues
        .filter((i) => !['RSV-06', 'RSV-07', 'RSV-08'].includes(i.code))
        .map((i) => i.code),
    );
  });
  it('retains later finite evidence and balance findings after nonfinite arithmetic', async () => {
    const result = await verifyReserveAccounts(parseUWFile(fixture('overflow-then-finite-periods')));
    expect(result.state).toBe('unverifiable');
    expect(result.reason).toBe('nonfinite_arithmetic');
    expect(result.issues.map((i) => i.code)).toEqual(['RSV-08', 'RSV-06']);
    expect(result.evidence.map((e) => e.period_id)).toEqual(['feb', 'mar']);
    expect(result.evidence.every((e) => Number.isFinite(e.computed_ending_balance))).toBe(true);
    expect(result.source_digest).toBeTypeOf('string');
  });
  it('preserves gross expenditure, source pointers, raw balances and the full semantic digest', async () => {
    const p = fresh();
    const result = await verifyReserveAccounts(p);
    expect(result.source_digest).toBe(
      await envelope.computeEnvelopeDigest(envelope.toUWEnvelope(p)),
    );
    expect(result.evidence.map((e) => e.computed_ending_balance)).toEqual([150, 100]);
    expect(result.evidence[0]!.movements).toEqual(content(p).accounts[0]!.periods[0]!.movements);
    expect(
      (blockPayload(getSection(p, 'sources_uses')!) as any).uses.capex_projects[0].amount,
    ).toBe(30);
    expect(browserVerify).toBe(verifyReserveAccounts);
  });
  it('retains same-day custody movements as separate source rows', async () => {
    const p = fresh();
    const period = content(p).accounts[0]!.periods[0]!;
    period.movements[1]!.date = period.movements[0]!.date;
    const result = await verifyReserveAccounts(p);
    expect(result.state).toBe('verified');
    expect(result.evidence[0]!.movements.map((m) => m.movement_id)).toEqual([
      'owner-deposit',
      'contractor-payment',
    ]);
    expect(result.evidence[0]!.movements.map((m) => m.amount)).toEqual([80, 30]);
  });
  it('accepts very large finite balances using the existing shared quantizer', async () => {
    const p = fresh();
    const account = content(p).accounts[0]!;
    account.periods = [
      { ...account.periods[0]!, opening_balance: 1e307, ending_balance: 1e307, movements: [] },
    ];
    expect((await verifyReserveAccounts(p)).state).toBe('verified');
  });
  it('snapshots before await and does not observe later caller mutations', async () => {
    const p = fresh();
    const before = structuredClone(p);
    const pending = verifyReserveAccounts(p);
    content(p).accounts[0]!.periods[0]!.movements[0]!.amount = 999;
    p.frontmatter.currency_code = 'EUR';
    const result = await pending;
    expect(result.state).toBe('verified');
    expect(result.source_digest).toBe(
      await envelope.computeEnvelopeDigest(envelope.toUWEnvelope(before)),
    );
    expect(result.evidence[0]!.movements[0]!.amount).toBe(80);
  });
  it('refuses unavailable digest computation without claiming verification', async () => {
    const spy = vi
      .spyOn(envelope, 'computeEnvelopeDigest')
      .mockRejectedValueOnce(new Error('unavailable'));
    try {
      expect(await verifyReserveAccounts(fresh())).toMatchObject({
        state: 'unverifiable',
        reason: 'digest_unavailable',
        source_digest: null,
        evidence: [],
      });
    } finally {
      spy.mockRestore();
    }
  });
  it('does not check unstated continuity or fill a gap', async () => {
    const p = fresh();
    const periods = content(p).accounts[0]!.periods;
    delete periods[1]!.previous_period_id;
    periods[1]!.start_date = '2026-02-05';
    periods[1]!.opening_balance = 151;
    periods[1]!.ending_balance = 101;
    const result = await verifyReserveAccounts(p);
    expect(result.state).toBe('verified');
    expect(result.evidence).toHaveLength(2);
  });
  it('checks every current variant independently and omits superseded balances', async () => {
    const text = fixture('verified-source-classes');
    const block = text.slice(
      text.indexOf('```json uw:section=reserve_accounts'),
      text.indexOf('\n```', text.indexOf('```json uw:section=reserve_accounts')) + 4,
    );
    const p = parseUWFile(
      `${text.replace('section=reserve_accounts', 'section=reserve_accounts variant=base')}\n${block.replace('section=reserve_accounts', 'section=reserve_accounts variant=other')}`,
    );
    const result = await verifyReserveAccounts(p);
    expect(result.state).toBe('verified');
    expect(result.evidence.map((e) => e.variant)).toEqual(['base', 'base', 'other', 'other']);
    const history = parseUWFile(
      `${text}\n${block.replace('section=reserve_accounts', 'section=reserve_accounts superseded=true')}`,
    );
    expect((await verifyReserveAccounts(history)).evidence).toHaveLength(2);
  });
  it('keeps the RFC 0045 reserve-dependent plan refused even beside verified account data', async () => {
    const base = read(
      'conformance/property-cash-flow-assembly/boundary-reserve-spending/deal.uwx.md',
    );
    const plan = JSON.parse(
      read('conformance/property-cash-flow-assembly/boundary-reserve-spending/plan.json'),
    ) as PropertyCashFlowPlan;
    const reserve = fixture('verified-source-classes');
    const extra = reserve.slice(reserve.indexOf('```json uw:section=reserve_accounts'));
    const p = parseUWFile(`${base}\n${extra}`);
    expect((await verifyReserveAccounts(p)).state).toBe('verified');
    try {
      await assemblePropertyCashFlows(p, plan);
      throw new Error('Expected reserve refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(PropertyCashFlowAssemblyError);
      expect((error as PropertyCashFlowAssemblyError).proto).toMatchObject({
        reason: 'coverage',
        pointer: 'plan.assertions.reserve_spending_excluded',
      });
    }
  });
  it('retains absent-data validation and economic assembly exactly', async () => {
    const base = parseUWFile(read('docs/examples/property-cash-flow-synthetic.uwx.md'));
    const plan = JSON.parse(
      read('docs/examples/property-cash-flow-plan.json'),
    ) as PropertyCashFlowPlan;
    const before = validateUWFile(base);
    const assembly = await assemblePropertyCashFlows(base, plan);
    expect(await verifyReserveAccounts(base)).toEqual({
      state: 'not_checked',
      reason: 'not_applicable',
      source_digest: null,
      evidence: [],
      issues: [],
    });
    expect(validateUWFile(base)).toEqual(before);
    expect(await assemblePropertyCashFlows(base, plan)).toEqual(assembly);
  });
});
