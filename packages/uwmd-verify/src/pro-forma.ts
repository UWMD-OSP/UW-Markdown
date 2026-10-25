// RFC0092: inventory first, then relationships, then assertion accounting.
// Browser-safe, synchronous and read-only; no new digest or receipt subject.
import { parseUWFile, blockPayload } from './parser.js';
import { resolveSectionBlock } from './section-resolution.js';
import { validateUWFile } from './validator.js';
import { canonicalize } from './integrity-canonical.js';
import { assertDataDescriptors, assertJSONValue } from './json-admission.js';
import { BUILTIN_METRIC_DICTIONARY } from './metric-dictionary.js';
import { CalcError } from './calc/errors.js';
import { evaluateProFormaIdentity, unavailableIdentity, type ProFormaIdentityOutcome } from './calc/pro-forma-identities.js';
import { proFormaAddressResolver, record, finite, pointerOf, addressShape, compareProFormaTargets, type ResolvedProFormaAddress } from './pro-forma-address.js';
import { PRO_FORMA_REGISTRY, PRO_FORMA_FAMILIES } from './pro-forma-types.js';
import type { ProFormaAddress, ProFormaAssertion, ProFormaClaim, ProFormaFamily, ProFormaFinding, ProFormaLedger, ProFormaRelationship, ProFormaReport, ProFormaTarget } from './pro-forma-types.js';
import type { ParsedUWFile } from './types.js';
export * from './pro-forma-types.js';

export interface VerifyProFormaOptions {
  /** Select only the claim block; every relationship still selects its own exact peers. */
  claimVariant?: string;
  /** Original fractional numeric tokens keyed by the report's canonical assertion key.
   * Model operations never consult stale raw/rawJson text for precision. */
  numericTokens?: ReadonlyMap<string, string>;
}
interface Item {
  resolved?: ResolvedProFormaAddress;
  address: ProFormaAddress;
  origins: string[];
  families: string[];
  kinds: string[];
  bound: boolean;
  reasons: string[];
  relationshipIndexes: number[];
}
const allowedKeys = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).every(k => keys.includes(k));
const familyOf = (families: string[]): ProFormaFamily => {
  const set = new Set(families);
  return set.size === 1 && (PRO_FORMA_FAMILIES as readonly string[]).includes(families[0]!) ? families[0] as ProFormaFamily : 'unclassified';
};
function protectedHome(r: ResolvedProFormaAddress, assetClass: string): boolean {
  const section = r.address.section;
  const p = r.address.pointer;
  if (section === 'dcf' && ['/returns/levered_irr', '/returns/unlevered_irr', '/returns/equity_multiple', '/returns/npv'].includes(p)) return true;
  if (section === 'capital_stack' && /^\/sizing\/\d+\/value$/.test(p)) return true;
  if (section === 'cash_flow_series' && ['/stated_metrics/total_net', '/stated_metrics/moic', '/stated_metrics/xnpv/value', '/stated_metrics/xirr'].includes(p)) return true;
  if (section === 'lease_up_schedule' && (/^\/schedule\/\d+\/net_cash_flow$/.test(p) || ['/stabilized_summary/occupied_sf', '/stabilized_summary/occupancy_rate'].includes(p))) return true;
  for (const c of BUILTIN_METRIC_DICTIONARY.calculations.filter(c => (c.asset_classes as readonly string[]).includes(assetClass))) {
    if (section === 'frontmatter' && p === pointerOf(['quick_metrics', c.id])) return true;
    if (BUILTIN_METRIC_DICTIONARY.statement_bindings.output_sections.includes(section) && p === pointerOf([c.id])) return true;
    for (const alias of BUILTIN_METRIC_DICTIONARY.statement_bindings.aliases?.[c.id] ?? []) {
      const [s, ...parts] = alias.split('.');
      if (section === s && p === pointerOf(parts)) return true;
    }
  }
  return false;
}
const relationKeys = ['id', 'identity', 'procedure_version', 'target', 'inputs', 'unit', 'currency', 'conventions', 'selectors', 'applicability'];
const selectorKeys = ['over', 'through', 'period', 'loan'];
const conventions: Readonly<Record<string, readonly unknown[]>> = {
  period_basis: ['monthly', 'annual'], first_period: ['full', 'stub'], cash_flow_timing: ['end', 'dated', 'mid', 'beginning'],
  growth_application: ['anniversary-step', 'calendar-step', 'monthly-compound'], growth_start: ['period-1', 'year-2'],
  vacancy_base: ['gross-potential-rent', 'gross-potential-revenue'], credit_loss_base: ['gross-potential-rent', 'gross-potential-revenue'],
  occupancy_method: ['percent-of-base', 'stated-occupancy-path'], line_class: ['fixed', 'per-unit', 'per-occupied-unit', 'per-sf', 'percent-of-egi'],
  management_fee_base: ['egi', 'egi-excluding-reimbursements'], reserves_placement: ['below-noi', 'above-noi'],
  payment_frequency: ['monthly', 'annual'], interest_accrual: ['30/360us', 'actual/360', 'actual/365f'],
  amortization_after_io: ['full-term', 'remaining-term'], dscr_basis: ['noi', 'ncf'], dscr_debt_service: ['actual', 'amortizing-constant'],
  ltv_basis: ['purchase-price', 'underwritten-value', 'total-project-cost'], exit_noi_basis: ['forward-12', 'trailing-12'],
  exit_noi_measure: ['noi', 'ncf'], disposition_cost_base: ['gross-sale-price'], irr_frequency: ['annual-periodic', 'monthly-compounded', 'xirr'],
  cash_on_cash_numerator: ['before-capex', 'after-capex'],
};
function validConventions(value: unknown): boolean {
  return record(value) && Object.entries(value).every(([k, v]) => k === 'debt_yield_basis'
    ? record(v) && allowedKeys(v, ['income', 'balance']) && ['noi', 'ncf'].includes(String(v.income)) && ['loan-at-close', 'balance-at-period'].includes(String(v.balance))
    : Object.hasOwn(conventions, k) && conventions[k]!.includes(v));
}
function errorEvidence(error: unknown): ProFormaFinding['error'] {
  if (record(error) && record(error.proto)) return error.proto as unknown as NonNullable<ProFormaFinding['error']>;
  if (error instanceof CalcError) return error.proto;
  const e = error as { code?: string; message?: string };
  return e?.code ? { category: 'calc', code: e.code, message: e.message ?? e.code } : undefined;
}
export function verifyProForma(input: string | ParsedUWFile, options: VerifyProFormaOptions = {}): ProFormaReport {
  const source = typeof input === 'string';
  const parsed = source ? parseUWFile(input) : input;
  assertDataDescriptors(parsed);
  const block = resolveSectionBlock(parsed, 'dcf', options.claimVariant === undefined ? {} : { sectionVariants: { dcf: options.claimVariant } });
  const payload = block ? blockPayload(block) : undefined;
  const raw = record(payload) ? payload.pro_forma : undefined;
  try { assertJSONValue(raw); } catch { throw new CalcError('CALC-PRO-FORMA', 'An explicit JSON pro-forma claim is required.'); }
  if (!record(raw) || raw.profile !== 'pro-forma' || raw.level !== 'L1' || typeof raw.convention_registry !== 'string' ||
    !Array.isArray(raw.rows) || !Array.isArray(raw.relationships)) throw new CalcError('CALC-PRO-FORMA', 'Malformed or absent explicit pro-forma claim.');
  const claim = raw as unknown as ProFormaClaim;
  const resolver = proFormaAddressResolver(parsed, source);
  const claimAddress = { section: 'dcf', variant: block!.annotation.variant ?? null, pointer: '/pro_forma' };
  const claimResolved = resolver.resolve(claimAddress);
  const items = new Map<string, Item>();
  const findings: ProFormaFinding[] = [];
  const exclusions: ProFormaReport['exclusions'] = [];
  const gaps: ProFormaReport['gaps'] = [];
  const addFinding = (code: string, reason: string, origins: string[], severity: 'error' | 'indeterminate' = 'error') =>
    findings.push({ code, severity, reason, origins });
  if (!allowedKeys(raw, ['profile', 'level', 'convention_registry', 'rows', 'relationships', 'conventions', 'timeline', 'ledger'])) addFinding('invalid_claim_member', 'unknown_semantic_member', ['/pro_forma']);
  if (claim.convention_registry !== PRO_FORMA_REGISTRY) addFinding('unsupported_registry', 'unsupported_registry', ['/pro_forma/convention_registry']);
  if (claim.conventions !== undefined && !validConventions(claim.conventions)) addFinding('invalid_convention', 'unsupported_convention', ['/pro_forma/conventions']);
  if (claim.timeline !== undefined && !record(claim.timeline)) addFinding('invalid_timeline', 'invalid_timeline', ['/pro_forma/timeline']);
  const inventory = (address: unknown, origin: string, bound = false, authored?: Record<string, unknown>): Item => {
    let resolved: ResolvedProFormaAddress | undefined; let refusal: string | undefined;
    try { resolved = resolver.resolve(address); } catch (error) { refusal = errorEvidence(error)?.code ?? 'unresolved_target'; }
    const fallback = { ...claimAddress, pointer: origin };
    const key = resolved?.physical_key ?? JSON.stringify(['declaration', origin]);
    let item = items.get(key);
    if (!item) {
      item = { ...(resolved ? { resolved } : {}), address: resolved?.address ?? (addressShape(address) ? address : fallback),
        origins: [], families: [], kinds: [], bound: false, reasons: [], relationshipIndexes: [] };
      items.set(key, item);
    }
    if (!item.origins.includes(origin)) item.origins.push(origin);
    item.bound ||= bound;
    if (refusal && !item.reasons.includes(refusal)) item.reasons.push(refusal);
    if (authored) {
      item.families.push(typeof authored.family === 'string' ? authored.family : 'unclassified');
      if (typeof authored.kind === 'string') item.kinds.push(authored.kind);
      if (!allowedKeys(authored, ['address', 'family', 'kind']) ||
        (authored.kind !== undefined && !['computed', 'input', 'assumption'].includes(String(authored.kind)))) item.reasons.push('invalid_row_declaration');
    }
    return item;
  };
  const walk = (value: unknown, parts: Array<string | number>) => {
    if (finite(value)) { inventory({ ...claimAddress, pointer: pointerOf(parts) }, pointerOf(parts)); return; }
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, [...parts, i]));
    else if (record(value)) for (const [k, v] of Object.entries(value)) {
      if (k === '_meta' || (parts.length === 0 && k === 'pro_forma')) continue;
      walk(v, [...parts, k]);
    }
  };
  walk(blockPayload(block!), []);
  claim.rows.forEach((row, i) => {
    const origin = '/pro_forma/rows/' + i;
    if (!record(row)) { inventory(undefined, origin, false); addFinding('invalid_row', 'invalid_row', [origin]); return; }
    inventory(row.address, origin, false, row);
  });
  const pending: Array<{ item: Item; raw: unknown; rel?: ProFormaRelationship; inputs: Map<string, ResolvedProFormaAddress>; outcome?: ProFormaIdentityOutcome; valid: boolean; origins: string[] }> = [];
  claim.relationships.forEach((declaration, i) => {
    const origin = '/pro_forma/relationships/' + i;
    if (!record(declaration)) { inventory(undefined, origin, true); addFinding('invalid_relationship', 'invalid_relationship', [origin]); return; }
    const applicability = declaration.applicability;
    const item = inventory(declaration.target, origin, true);
    const inputs = new Map<string, ResolvedProFormaAddress>();
    let valid = allowedKeys(declaration, relationKeys) && declaration.procedure_version === '1' &&
      typeof declaration.identity === 'string' && typeof declaration.unit === 'string' && Array.isArray(declaration.inputs) &&
      (declaration.id === undefined || typeof declaration.id === 'string') &&
      (declaration.currency === undefined || typeof declaration.currency === 'string') &&
      (declaration.selectors === undefined || (record(declaration.selectors) && allowedKeys(declaration.selectors, selectorKeys))) &&
      (declaration.conventions === undefined || validConventions(declaration.conventions)) &&
      (applicability === undefined || (record(applicability) && allowedKeys(applicability, ['applicable', 'reason']) && typeof applicability.applicable === 'boolean' && (applicability.applicable || (typeof applicability.reason === 'string' && applicability.reason.length > 0))));
    for (const [j, binding] of (Array.isArray(declaration.inputs) ? declaration.inputs : []).entries()) {
      if (!record(binding) || typeof binding.role !== 'string' || !allowedKeys(binding, ['role', 'address']) || inputs.has(binding.role)) { valid = false; continue; }
      try {
        const r = resolver.resolve(binding.address); inputs.set(binding.role, r);
        if (finite(r.value)) inventory(binding.address, origin + '/inputs/' + j);
      } catch (error) { valid = false; item.reasons.push(errorEvidence(error)?.code ?? 'unresolved_input'); }
    }
    // The native fallback occupancy source is a required computed prerequisite.
    if (declaration.identity === 'final_occupancy_rate') {
      const schedule = inputs.get('schedule');
      if (schedule && record(schedule.value) && record(schedule.value.stabilized_summary) && finite(schedule.value.stabilized_summary.occupied_sf)) {
        const address = { ...schedule.address, pointer: '/stabilized_summary/occupied_sf' };
        const r = resolver.resolve(address); inputs.set('native_occupied_summary', r); inventory(address, origin + '/native_prerequisite');
      }
    }
    if (valid && record(applicability) && applicability.applicable === false) {
      exclusions.push({ origin, reason: String(applicability.reason) });
      item.bound = pending.some(p => p.item === item);
      // An excluded absent statement is a declaration finding, not a numeric claim.
      if (!item.resolved && item.origins.length === 1) items.delete(JSON.stringify(['declaration', origin]));
      return;
    }
    const rel = valid ? declaration as unknown as ProFormaRelationship : undefined;
    pending.push({ item, raw: declaration, ...(rel ? { rel } : {}), inputs, valid, origins: [origin] });
  });
  // Physical grouping precedes context identity and all duplicate elimination.
  for (const p of pending) {
    const target = p.item.resolved;
    if (!target || !p.rel) continue;
    const selector = p.rel.selectors ?? {};
    const loan = p.rel.identity === 'ltv' ? p.inputs.get('loan') : undefined;
    if (loan) {
      const ref = JSON.stringify([loan.target.block_address_kind, loan.target.block_address, loan.address.section, loan.address.variant]);
      if (target.target.loan_ref !== null && target.target.loan_ref !== ref) p.item.reasons.push('ambiguous_context');
      else target.target.loan_ref = ref;
    }
    if (p.rel.identity === 'net_cash_flow' && typeof selector.period === 'string') {
      const selected = p.inputs.get('schedule');
      const rows = selected && record(selected.value) && Array.isArray(selected.value.schedule) ? selected.value.schedule : [];
      if (rows.filter(row => record(row) && row.period === selector.period).length === 1 && target.target.period_key === null) target.target.period_key = selector.period;
    }
    if (selector.period !== undefined && selector.period !== target.target.period_key) p.item.reasons.push('period_context_mismatch');
    if (selector.loan !== undefined && selector.loan !== target.target.loan_ref) p.item.reasons.push('loan_context_mismatch');
    target.key = JSON.stringify([target.target.block_address_kind, target.target.block_address, target.address.section, target.address.variant,
      target.parts, target.target.period_key, target.target.loan_ref]);
  }
  const report: ProFormaReport = { status: 'completed', profile: 'pro-forma', level: 'L1',
    selection: { operation: source ? 'source' : 'model', claim: claimResolved.target },
    assertions: [], relationships: [], inputs: [], input_count: 0,
    coverage: { total: 0, by_verdict: { verified: 0, failed: 0, unverifiable: 0 }, by_row_family: {} },
    gaps, exclusions, profile_claim_findings: findings, validation: validateUWFile(input).issues, exit_code: 0 };
  const assertionsByPhysical = new Map<string, ProFormaAssertion>();
  const orderedItems = [...items.values()].sort((a, b) => a.resolved && b.resolved ? compareProFormaTargets(a.resolved.target, b.resolved.target, a.resolved.parts, b.resolved.parts) : a.resolved ? -1 : b.resolved ? 1 : 0);
  for (const item of orderedItems) {
    const computed = item.bound || (item.resolved ? protectedHome(item.resolved, parsed.frontmatter.asset_class) : false);
    const inputKind = item.kinds.find(k => k === 'input' || k === 'assumption');
    const family = familyOf(item.families);
    if (!computed && inputKind && item.reasons.length === 0 && new Set(item.kinds).size === 1 && new Set(item.families).size <= 1) {
      report.inputs.push({ address: item.address, target: item.resolved?.target ?? null, origins: item.origins,
        row_family: family, reason: inputKind as 'input' | 'assumption' });
      continue;
    }
    if (new Set(item.families).size > 1) item.reasons.push('ambiguous_family');
    if (item.families.some(f => !(PRO_FORMA_FAMILIES as readonly string[]).includes(f))) addFinding('unrecognized_family', 'unrecognized_family', item.origins, 'indeterminate');
    const assertion: ProFormaAssertion = { key: item.resolved?.key ?? JSON.stringify(['declaration', item.origins[0]]),
      target: item.resolved?.target ?? null, address: item.address, origins: item.origins,
      row_family: family, stated: finite(item.resolved?.value) ? item.resolved.value : null,
      state: 'unverifiable', reasons: [...new Set(item.reasons)], relationships: [] };
    report.assertions.push(assertion);
    if (item.resolved) assertionsByPhysical.set(item.resolved.physical_key, assertion);
  }
  // Full canonical semantic content includes every unknown field; only valid
  // identical relationships coalesce. Invalid declarations stay visible.
  const seen = new Map<string, number>();
  const coarse = new Map<string, Array<{ semantic: string; assertion: ProFormaAssertion }>>();
  const ids = new Map<string, Array<{ semantic: string; assertion: ProFormaAssertion }>>();
  for (const p of pending) {
    const assertion = p.item.resolved ? assertionsByPhysical.get(p.item.resolved.physical_key) : report.assertions.find(a => a.origins === p.item.origins);
    if (!assertion) continue;
    const sem = canonicalize({ declaration: p.raw, target: p.item.resolved?.target ?? null,
      effective_conventions: { ...claim.conventions, ...p.rel?.conventions },
      bindings: [...p.inputs].map(([role, r]) => [role, r.target]),
      precision: p.item.resolved ? resolver.precision(p.item.resolved, options.numericTokens) ?? null : null });
    const duplicateKey = assertion.key + sem;
    if (p.valid && seen.has(duplicateKey)) {
      report.relationships[seen.get(duplicateKey)!]!.origins.push(...p.origins); continue;
    }
    if (p.rel?.id !== undefined) {
      const entries = ids.get(p.rel.id) ?? [];
      if (entries.some(x => x.semantic !== sem)) { assertion.reasons.push('relationship_collision'); for (const e of entries) e.assertion.reasons.push('relationship_collision'); }
      entries.push({ semantic: sem, assertion }); ids.set(p.rel.id, entries);
    }
    const coarseKey = assertion.key + ':' + String(record(p.raw) ? p.raw.identity : '') + ':' + String(record(p.raw) ? p.raw.procedure_version : '');
    const variants = coarse.get(coarseKey) ?? [];
    if (variants.some(v => v.semantic !== sem)) {
      assertion.reasons.push('relationship_collision');
      for (const variant of variants) variant.assertion.reasons.push('relationship_collision');
    }
    variants.push({ semantic: sem, assertion }); coarse.set(coarseKey, variants);
    let outcome = !p.valid || !p.rel ? unavailableIdentity('invalid_relationship')
      : claim.convention_registry !== PRO_FORMA_REGISTRY ? unavailableIdentity('unsupported_registry')
      : claim.conventions !== undefined && !validConventions(claim.conventions) ? unavailableIdentity('unsupported_convention')
      : !p.item.resolved ? unavailableIdentity('unresolved_target')
      : undefined;
    if (!outcome && p.rel && p.item.resolved) {
      try { outcome = evaluateProFormaIdentity(p.rel, p.item.resolved, p.inputs,
        { ...claim.conventions, ...p.rel.conventions }, parsed, resolver.precision(p.item.resolved, options.numericTokens)); }
      catch (error) {
        const evidence = errorEvidence(error); if (!evidence) throw error;
        outcome = unavailableIdentity(evidence.code, [evidence]);
      }
    }
    const dependencies = [...new Set([...p.inputs.values()].map(r => assertionsByPhysical.get(r.physical_key)?.key).filter((k): k is string => !!k))];
    const index = report.relationships.length;
    report.relationships.push({ assertion_key: assertion.key, identity: record(p.raw) ? String(p.raw.identity) : '',
      origins: p.origins, declaration: p.raw, state: outcome!.state, local_state: outcome!.state,
      ...(outcome!.reason ? { reason: outcome!.reason } : {}), computed: outcome!.computed,
      findings: outcome!.findings, dependencies });
    assertion.relationships.push(index);
    if (p.valid) seen.set(duplicateKey, index);
  }
  const terminal = (a: ProFormaAssertion) => {
    const relationships = a.relationships.map(i => report.relationships[i]!);
    if (relationships.some(r => r.state === 'failed')) return 'failed' as const;
    if (a.reasons.length || !relationships.length || relationships.some(r => r.state === 'unverifiable')) return 'unverifiable' as const;
    return 'verified' as const;
  };
  for (const a of report.assertions) a.state = terminal(a);
  // Start dependency closure from established local states; a cycle with no
  // independently available prerequisite can never manufacture verification.
  const byKey = new Map(report.assertions.map(a => [a.key, a]));
  for (const r of report.relationships) if (r.dependencies.length && r.state === 'verified') r.state = 'unverifiable';
  for (const a of report.assertions) a.state = terminal(a);
  for (let pass = 0; pass <= report.assertions.length; pass++) {
    let changed = false;
    for (const a of report.assertions) {
      for (const i of a.relationships) {
        const r = report.relationships[i]!;
        const ready = r.dependencies.every(k => byKey.get(k)?.state === 'verified');
        const state = r.local_state === 'verified' && !ready ? 'unverifiable' : r.local_state;
        if (state !== r.state) { r.state = state; changed = true; }
        if (r.local_state === 'verified') { if (state === 'unverifiable') r.reason = 'blocked_dependency'; else delete r.reason; }
      }
      const next = terminal(a); if (a.state !== next) { a.state = next; changed = true; }
    }
    if (!changed) break;
  }
  for (const a of report.assertions) {
    if (!a.relationships.length) a.reasons.push('relationship_not_claimed');
    a.reasons = [...new Set(a.reasons)];
    report.coverage.total++; report.coverage.by_verdict[a.state]++;
    const counts = report.coverage.by_row_family[a.row_family] ??= { total: 0, verified: 0, failed: 0, unverifiable: 0 };
    counts.total++; counts[a.state]++;
  }
  if (claim.ledger !== undefined) assessLedger(claim.ledger, resolver.resolve, report);
  report.input_count = report.inputs.length;
  report.exit_code = report.validation.some(v => v.severity === 'error') || findings.some(f => f.severity === 'error') ||
    report.coverage.by_verdict.failed > 0 || report.coverage.by_verdict.unverifiable > 0 || gaps.some(g => g.required) ? 1 : 0;
  return report;
}
function assessLedger(ledger: ProFormaLedger, resolve: (address: unknown) => ResolvedProFormaAddress, report: ProFormaReport): void {
  if (!record(ledger) || !allowedKeys(ledger, ['universe', 'bindings', 'exclusions']) || !Array.isArray(ledger.universe) ||
    !Array.isArray(ledger.bindings) || !Array.isArray(ledger.exclusions)) {
    report.profile_claim_findings.push({ code: 'invalid_ledger', severity: 'error', reason: 'invalid_ledger', origins: ['/pro_forma/ledger'] }); return;
  }
  const keyOf = (address: unknown): string | null => { try { return resolve(address).physical_key; } catch { return null; } };
  const members = ledger.universe.map((u, i) => ({ raw: u, key: record(u) ? keyOf(u.event) : null, origin: '/pro_forma/ledger/universe/' + i }));
  const bindings = ledger.bindings.map((b, i) => ({ raw: b, key: record(b) ? keyOf(b.event) : null, origin: '/pro_forma/ledger/bindings/' + i }));
  for (const binding of bindings) {
    if (!record(binding.raw) || !allowedKeys(binding.raw, ['event', 'role', 'target']) || typeof binding.raw.role !== 'string' ||
      binding.key === null || !members.some(m => m.key === binding.key && record(m.raw) && m.raw.role === binding.raw.role)) {
      report.profile_claim_findings.push({ code: 'out_of_universe_binding', severity: 'error', reason: 'out_of_universe_binding', origins: [binding.origin] });
    }
  }
  const emitted = new Set<string>();
  for (const member of members) {
    const u = member.raw;
    const valid = record(u) && allowedKeys(u, ['event', 'role', 'required']) && addressShape(u.event) && typeof u.role === 'string' && typeof u.required === 'boolean';
    if (!valid) { report.profile_claim_findings.push({ code: 'invalid_ledger_member', severity: 'error', reason: 'invalid_ledger_member', origins: [member.origin] }); continue; }
    const key = JSON.stringify([member.key, u.role]);
    if (emitted.has(key)) continue; emitted.add(key);
    const matching = bindings.filter(b => b.key !== null && b.key === member.key);
    const semantics = new Set(matching.map(b => canonicalize({ event: b.key, role: b.raw.role,
      target: b.raw.target === undefined ? null : keyOf(b.raw.target), unknown: Object.entries(b.raw).filter(([k]) => !['event', 'role', 'target'].includes(k)) })));
    const excluded = ledger.exclusions.filter(e => record(e) && keyOf(e.event) === member.key && e.role === u.role);
    const conflictingUniverse = members.some(m => m !== member && m.key === member.key &&
      (!record(m.raw) || m.raw.role !== u.role || m.raw.required !== u.required));
    const admitted = matching.length > 0 && matching.every(b => b.raw.role === u.role && allowedKeys(b.raw as unknown as Record<string, unknown>, ['event', 'role', 'target']) &&
      (b.raw.target === undefined || keyOf(b.raw.target) !== null)) && semantics.size === 1 && !conflictingUniverse;
    if (!admitted || (u.required && excluded.length > 0)) {
      report.gaps.push({ event: u.event, role: u.role, required: u.required,
        reason: member.key === null ? 'unresolved_member' : conflictingUniverse || semantics.size > 1 ? 'conflicting_membership'
          : excluded.length > 0 && u.required ? 'required_member_excluded' : matching.length ? 'invalid_binding' : 'unbound_member',
        origins: members.filter(m => m.key === member.key && record(m.raw) && m.raw.role === u.role).map(m => m.origin).concat(matching.map(b => b.origin)) });
    }
  }
  ledger.exclusions.forEach((e, i) => {
    const origin = '/pro_forma/ledger/exclusions/' + i;
    if (!record(e) || !allowedKeys(e, ['event', 'role', 'reason']) || !addressShape(e.event) || typeof e.role !== 'string' ||
      typeof e.reason !== 'string' || !e.reason.length) {
      report.profile_claim_findings.push({ code: 'invalid_exclusion', severity: 'error', reason: 'invalid_exclusion', origins: [origin] }); return;
    }
    report.exclusions.push({ origin, reason: e.reason });
  });
}

