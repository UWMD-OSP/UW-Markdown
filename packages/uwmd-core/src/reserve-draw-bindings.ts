// RFC 0065 / Protocol §VIII.12: explicit funding identity, never cash assembly.
import type { ParsedUWFile, UWBlock, ValidationMessage } from './types.js';
import type {
  ReserveDrawReference,
  ReserveDrawBindingPlan,
  ReserveDrawBindingEvidence,
  ReserveDrawBindingVerification,
  ReserveGrossExpenditureReference,
  ReserveAccounts,
} from './protocol.js';
import { isCurrencyCode } from './protocol.js';
import { blockPayload } from './parser.js';
import {
  sectionBlocks,
  isBindingDigest,
  validBindingSeries,
} from './replacement-funding-structure.js';
import { validReserveSource } from './reserve-accounts-structure.js';
import { verifyReserveAccounts } from './reserve-accounts.js';
import { checkLeaseUpContent } from './lease-up-structure.js';
import { quantizeAtDecimals } from './cash-flow-series.js';
import { computeEnvelopeDigest, toUWEnvelope } from './envelope.js';

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const variant = (v: unknown) => v === null || text(v);
const positive = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && quantizeAtDecimals(v, 2) > 0;
const shape = (v: unknown, keys: string[]): v is Record<string, unknown> =>
  record(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
const drawShape = (v: unknown): v is ReserveDrawReference =>
  shape(v, ['variant', 'account_id', 'period_id', 'movement_id']) &&
  variant(v.variant) &&
  ['account_id', 'period_id', 'movement_id'].every((k) => text(v[k]));
const refShape = (v: unknown): v is ReserveGrossExpenditureReference =>
  record(v) &&
  variant(v.variant) &&
  ((shape(v, ['section', 'variant', 'period', 'field']) &&
    v.section === 'lease_up_schedule' &&
    text(v.period) &&
    v.field === 'ti_lc_capex') ||
    (shape(v, ['section', 'variant', 'row_index']) &&
      v.section === 'cash_flow_series' &&
      Number.isSafeInteger(v.row_index) &&
      (v.row_index as number) >= 0));
const drawKey = (r: ReserveDrawReference) =>
  JSON.stringify([r.variant, r.account_id, r.period_id, r.movement_id]);
const spendKey = (r: ReserveGrossExpenditureReference) =>
  JSON.stringify(
    r.section === 'cash_flow_series'
      ? [r.section, r.variant, r.row_index]
      : [r.section, r.variant, r.period, r.field],
  );
const root = (section: string, v: string | null) => `sections.${section}[${JSON.stringify(v)}]`;
const exact = (p: ParsedUWFile, section: string, v: string | null): UWBlock | undefined => {
  const blocks = sectionBlocks(p.sections[section]).filter(
    (b) => !b.annotation.superseded && !b.meta.superseded && (b.annotation.variant ?? null) === v,
  );
  return blocks.length === 1 ? blocks[0] : undefined;
};

/** Absent means omitted (undefined); a stated null plan is invalid. Snapshots both inputs. */
export async function verifyReserveDrawBindings(
  parsed: ParsedUWFile,
  input?: unknown,
): Promise<ReserveDrawBindingVerification> {
  const snapshot = structuredClone(parsed);
  let value: unknown;
  try {
    value = structuredClone(input);
  } catch {
    value = { invalid_input: true };
  }
  const evidence: ReserveDrawBindingEvidence[] = [];
  const issues: ValidationMessage[] = [];
  let source_digest: string | null = null;
  const issue = (code: string, field: string, message: string, detail?: unknown) =>
    issues.push({
      code,
      severity: 'error',
      section: 'reserve_draw_bindings',
      field,
      message: `${code}: ${message}`,
      ...(detail === undefined ? {} : { value: detail }),
    });
  const result = (
    state: ReserveDrawBindingVerification['state'],
    reason?: ReserveDrawBindingVerification['reason'],
  ): ReserveDrawBindingVerification => ({
    state,
    ...(reason ? { reason } : {}),
    source_digest,
    evidence,
    issues,
    ...(record(value) && isBindingDigest(value.source_digest)
      ? { stated_digest: value.source_digest }
      : {}),
  });
  if (value === undefined) return result('not_checked', 'not_applicable');
  if (
    !shape(value, [
      'source_digest',
      'currency_code',
      'coverage',
      'selected_draws',
      'expenditures',
      'bindings',
    ]) ||
    !isBindingDigest(value.source_digest) ||
    !isCurrencyCode(value.currency_code) ||
    value.coverage !== 'declared_complete' ||
    ['selected_draws', 'expenditures', 'bindings'].some(
      (k) => !Array.isArray(value[k]) || (value[k] as unknown[]).length === 0,
    )
  ) {
    issue(
      'RDB-01',
      'plan',
      'State the closed digested plan, currency, declared_complete coverage and nonempty inventories/edges',
    );
    return result('unverifiable', 'invalid_structure');
  }
  for (const [i, d] of (value.selected_draws as unknown[]).entries())
    if (!drawShape(d))
      issue(
        'RDB-01',
        `plan.selected_draws[${i}]`,
        'State exact variant (null for unlabelled), account, period and movement identities',
      );
  for (const [i, e] of (value.expenditures as unknown[]).entries())
    if (
      !shape(e, [
        'expenditure_id',
        'ref',
        'category',
        'gross',
        'currency_code',
        'funded_amount',
        'source',
      ]) ||
      !text(e.expenditure_id) ||
      !refShape(e.ref) ||
      !['ti_lc', 'other_capex', 'operating_expenses'].includes(e.category as string) ||
      e.gross !== true ||
      !isCurrencyCode(e.currency_code) ||
      !positive(e.funded_amount) ||
      !validReserveSource(e.source)
    )
      issue(
        'RDB-01',
        `plan.expenditures[${i}]`,
        'State a source-attributable gross expenditure and explicit positive funded share',
      );
  for (const [i, b] of (value.bindings as unknown[]).entries())
    if (
      !shape(b, ['draw', 'expenditure_id', 'funded_amount']) ||
      !drawShape(b.draw) ||
      !text(b.expenditure_id) ||
      !positive(b.funded_amount)
    )
      issue(
        'RDB-01',
        `plan.bindings[${i}]`,
        'State a draw reference, expenditure identity and positive allocation',
      );
  if (issues.length) return result('unverifiable', 'invalid_structure');
  const plan = value as unknown as ReserveDrawBindingPlan;
  const unique = (keys: string[], field: string) => {
    const seen = new Set<string>();
    for (const [i, key] of keys.entries()) {
      if (seen.has(key))
        issue('RDB-05', `${field}[${i}]`, 'Duplicate identity or draw/expenditure edge');
      seen.add(key);
    }
  };
  unique(plan.selected_draws.map(drawKey), 'plan.selected_draws');
  unique(
    plan.expenditures.map((e) => e.expenditure_id),
    'plan.expenditures',
  );
  unique(
    plan.expenditures.map((e) => spendKey(e.ref)),
    'plan.expenditures',
  );
  unique(
    plan.bindings.map((b) => JSON.stringify([drawKey(b.draw), b.expenditure_id])),
    'plan.bindings',
  );
  if (issues.length) return result('unverifiable', 'invalid_structure');
  try {
    source_digest = await computeEnvelopeDigest(toUWEnvelope(snapshot));
  } catch {
    return result('unverifiable', 'digest_unavailable');
  }
  if (source_digest !== plan.source_digest) {
    issue('RDB-02', 'plan.source_digest', 'The whole Envelope source snapshot has changed');
    return result('failed', 'stale_binding');
  }
  if (
    snapshot.frontmatter.currency_code != null &&
    snapshot.frontmatter.currency_code !== plan.currency_code
  )
    issue('RDB-06', 'plan.currency_code', 'Document and binding currency must agree; no FX');
  const draws = new Map<string, ReserveDrawBindingEvidence['draw']>();
  const spends = new Map<string, ReserveDrawBindingEvidence['expenditure']>();
  const reserveStates = new Map<string | null, boolean>();
  for (const [i, ref] of plan.selected_draws.entries()) {
    const field = `plan.selected_draws[${i}]`;
    const path = root('reserve_accounts', ref.variant);
    const block = exact(snapshot, 'reserve_accounts', ref.variant);
    if (!block) {
      issue('RDB-03', field, 'Exact current reserve variant is missing', ref);
      continue;
    }
    if (!reserveStates.has(ref.variant)) {
      const selected = structuredClone(snapshot);
      selected.sections.reserve_accounts = block;
      const verification = await verifyReserveAccounts(selected);
      reserveStates.set(ref.variant, verification.state === 'verified');
      if (verification.state !== 'verified')
        issue(
          'RDB-04',
          path,
          'Selected reserve variant must verify under RFC 0064',
          verification.issues,
        );
    }
    if (!reserveStates.get(ref.variant)) continue;
    const accounts = (blockPayload(block) as unknown as ReserveAccounts).accounts;
    const ai = accounts.findIndex((a) => a.account_id === ref.account_id);
    const account = accounts[ai];
    const pi = account?.periods.findIndex((p) => p.period_id === ref.period_id) ?? -1;
    const period = account?.periods[pi];
    const mi = period?.movements.findIndex((m) => m.movement_id === ref.movement_id) ?? -1;
    const movement = period?.movements[mi];
    if (!account || !period || !movement) {
      issue('RDB-03', field, 'Exact account, period or movement is missing', ref);
      continue;
    }
    const source_path = `${path}.accounts[${ai}].periods[${pi}].movements[${mi}]`;
    if (
      account.currency_code !== plan.currency_code ||
      movement.kind !== 'internal_draw' ||
      !positive(movement.amount)
    ) {
      issue('RDB-06', source_path, 'Select a positive internal_draw in the declared currency');
      continue;
    }
    draws.set(drawKey(ref), {
      ref,
      source_path,
      amount: movement.amount,
      date: movement.date,
      source: movement.source,
      meta: structuredClone(block.meta),
    });
  }
  for (const [i, e] of plan.expenditures.entries()) {
    const field = `plan.expenditures[${i}]`;
    const path = root(e.ref.section, e.ref.variant);
    const block = exact(snapshot, e.ref.section, e.ref.variant);
    if (!block) {
      issue('RDB-03', field, 'Exact current expenditure variant is missing', e.ref);
      continue;
    }
    const payload = blockPayload(block);
    let gross: unknown;
    let date: string | null = null;
    let period: string | null = null;
    let source_path = path;
    if (e.ref.section === 'cash_flow_series') {
      if (!record(payload) || !validBindingSeries(payload.series)) {
        issue('RDB-04', path, 'Selected dated series must have finite, ordered source rows');
        continue;
      }
      const row = payload.series[e.ref.row_index];
      if (!row) {
        issue('RDB-03', field, 'Exact gross expenditure row is missing');
        continue;
      }
      gross = row.amount;
      date = row.date;
      source_path += `.series[${e.ref.row_index}].amount`;
      if (e.category === 'ti_lc') {
        issue('RDB-06', field, 'TI/LC binds its lease-up component, never a bundled cash row');
        continue;
      }
    } else {
      if (!record(payload)) {
        issue('RDB-04', path, 'Selected lease-up source must be an object');
        continue;
      }
      const structural: ValidationMessage[] = [];
      checkLeaseUpContent(payload, e.ref.variant ?? 'default', structural);
      if (
        structural.length ||
        !['natural_turnover', 'absorption_curve'].includes(payload.model_type as string)
      ) {
        issue('RDB-04', path, 'Selected lease-up structure is invalid', structural);
        continue;
      }
      const rows = payload.schedule as Array<Record<string, unknown>>;
      const matches = rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => row.period === (e.ref as { period: string }).period);
      if (matches.length !== 1) {
        issue('RDB-03', field, 'Exactly one authored source period must exist');
        continue;
      }
      const { row, index } = matches[0]!;
      gross = row.ti_lc_capex;
      period = e.ref.period;
      source_path += `.schedule[${index}].ti_lc_capex`;
      if (e.category !== 'ti_lc') {
        issue('RDB-06', field, 'The selected lease-up cell is the gross ti_lc category');
        continue;
      }
    }
    if (
      e.currency_code !== plan.currency_code ||
      typeof gross !== 'number' ||
      !Number.isFinite(gross) ||
      gross >= 0 ||
      quantizeAtDecimals(gross, 2) >= 0
    ) {
      issue(
        'RDB-06',
        source_path,
        'State an existing finite negative gross expenditure in the declared currency',
      );
      continue;
    }
    spends.set(e.expenditure_id, {
      expenditure_id: e.expenditure_id,
      ref: e.ref,
      category: e.category,
      source_path,
      gross_amount: gross,
      stated_funded_amount: e.funded_amount,
      date,
      period,
      source: e.source,
      meta: structuredClone(block.meta),
    });
  }
  const drawTotals = new Map<string, number>();
  const spendTotals = new Map<string, number>();
  for (const [i, edge] of plan.bindings.entries()) {
    const key = drawKey(edge.draw);
    const draw = draws.get(key);
    const expenditure = spends.get(edge.expenditure_id);
    if (!draw || !expenditure) {
      if (
        !plan.selected_draws.some((r) => drawKey(r) === key) ||
        !plan.expenditures.some((e) => e.expenditure_id === edge.expenditure_id)
      )
        issue(
          'RDB-03',
          `plan.bindings[${i}]`,
          'Edge must name a selected draw and declared expenditure',
        );
      continue;
    }
    evidence.push({
      binding_index: i,
      currency_code: plan.currency_code,
      funded_amount: edge.funded_amount,
      draw: structuredClone(draw),
      expenditure: structuredClone(expenditure),
    });
    drawTotals.set(key, (drawTotals.get(key) ?? 0) + edge.funded_amount);
    spendTotals.set(
      edge.expenditure_id,
      (spendTotals.get(edge.expenditure_id) ?? 0) + edge.funded_amount,
    );
  }
  // No arithmetic verdict on incomplete source resolution; finite resolved edges remain auditable.
  if (issues.length) return result('unverifiable', 'invalid_source');
  let nonfinite = false;
  for (const [i, ref] of plan.selected_draws.entries()) {
    const key = drawKey(ref);
    const sum = drawTotals.get(key) ?? 0;
    const draw = draws.get(key)!;
    if (!Number.isFinite(sum)) {
      nonfinite = true;
      issue('RDB-09', `plan.selected_draws[${i}]`, 'Draw allocation sum is nonfinite');
    } else if (quantizeAtDecimals(sum, 2) !== quantizeAtDecimals(draw.amount, 2))
      issue(
        'RDB-07',
        `plan.selected_draws[${i}]`,
        'Every selected draw must be fully allocated at the currency quantum',
      );
  }
  for (const [i, e] of plan.expenditures.entries()) {
    const sum = spendTotals.get(e.expenditure_id) ?? 0;
    const expenditure = spends.get(e.expenditure_id)!;
    if (!Number.isFinite(sum)) {
      nonfinite = true;
      issue('RDB-09', `plan.expenditures[${i}]`, 'Expenditure allocation sum is nonfinite');
    } else if (
      quantizeAtDecimals(sum, 2) !== quantizeAtDecimals(e.funded_amount, 2) ||
      quantizeAtDecimals(sum, 2) > quantizeAtDecimals(-expenditure.gross_amount, 2)
    )
      issue(
        'RDB-08',
        `plan.expenditures[${i}].funded_amount`,
        'Allocation must equal the explicitly stated funded share and not exceed gross expenditure',
      );
  }
  return result(
    nonfinite ? 'unverifiable' : issues.length ? 'failed' : 'verified',
    nonfinite ? 'nonfinite_arithmetic' : undefined,
  );
}
