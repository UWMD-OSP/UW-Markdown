// RFC 0080 standard field contracts and class verification rules.
// This checks the fixed official fields, not arbitrary third-party JSON Schema.
import { BUILTIN_CLASS_CONTENT } from './builtin-class-content.js';
import { toBuiltinAssetClass, type ParsedUWFile, type UWBlock, type ValidationMessage } from './types.js';
import { blockPayload } from './parser.js';
import { resolveRoleBlock } from './block-roles.js';
import { declaredModuleDependencies } from './asset-class.js';
import { evaluateCalc } from './calc/index.js';
import { getPackForAssetClass } from './packs/index.js';
import { formatVersionAtLeast } from './modules.js';

/** The legacy official module each builtin's migrated content came from. */
const LEGACY_MODULE: Partial<Record<string, string>> = {
  hospitality: 'org.uwmd.hospitality',
  data_center: 'org.uwmd.datacenters',
};

/**
 * Calculations the builtin pack carried before RFC 0080. They keep failing the
 * way every builtin pack calculation fails — uncomputed, never a validation
 * error — exactly as multifamily's do.
 */
const PRE_RFC_BUILTIN_CALCS: Partial<Record<string, ReadonlySet<string>>> = {
  hospitality: new Set(['revpar']),
};

interface FieldContract { type?: string | string[]; minimum?: number; maximum?: number; enum?: unknown[] }
interface SectionContract { required?: string[]; properties?: Record<string, FieldContract> }

export function checkBuiltinClassContent(parsed: ParsedUWFile): ValidationMessage[] {
  const assetClass = toBuiltinAssetClass(parsed.frontmatter.asset_class);
  if (!assetClass) return [];
  const issues: ValidationMessage[] = [];
  const entry = parsed.sections.components;
  const blocks = !entry ? [] : Object.hasOwn(entry, 'annotation') ? [entry as UWBlock] : Object.values(entry as Record<string, UWBlock>);
  const newSlots = blocks.some(block => {
    const payload = blockPayload(block) as Record<string, unknown>;
    return Object.hasOwn(payload, 'data_center') || Object.hasOwn(payload, 'manufactured_housing');
  });
  const content = BUILTIN_CLASS_CONTENT[assetClass];
  const atLeast21 = formatVersionAtLeast(parsed.frontmatter.uw_version, '2.1');
  if ((newSlots || ['data_center', 'manufactured_housing'].includes(parsed.frontmatter.asset_class)) && !atLeast21) issues.push({ code: 'CLS-05', severity: 'error', field: 'uw_version', message: 'The new official builtin ids and component slots require Format 2.1 or later; the exact legacy org.uwmd.data_center alias remains readable at its original version.' });
  if (!content) return issues;
  const legacyModule = LEGACY_MODULE[assetClass];
  const namesLegacyModule = legacyModule !== undefined &&
    declaredModuleDependencies(parsed.frontmatter as Record<string, unknown>).some(d => d.id === legacyModule);
  // RFC 0080 §5: documents that predate the builtin (a legacy alias or a
  // pre-2.1 format) keep validating as they did. Field contracts the old module
  // runtime never enforced are reported as warnings there; only canonical
  // Format 2.1+ documents get them as errors.
  const legacyAlias = parsed.frontmatter.asset_class !== assetClass;
  const contractSeverity = atLeast21 && !legacyAlias ? 'error' : 'warning';
  // Calculation/rule failures stay errors where the old module runtime already
  // reported them (the document names the legacy module) or the document is a
  // canonical 2.1+ record; elsewhere they could not have fired before.
  const strict = atLeast21 || namesLegacyModule;
  const ruleSeverity = (severity: ValidationMessage['severity']): ValidationMessage['severity'] =>
    severity === 'error' && !strict ? 'warning' : severity;
  if (assetClass === 'hospitality' && parsed.frontmatter.uw_version === '3.0') {
    const roll = resolveRoleBlock(parsed.sections.rent_roll, 'rent_roll', ['default', 'base']).block;
    if (roll) {
      const facts = blockPayload(roll) as Record<string, unknown>;
      const nights = facts['available_room_nights'];
      if (typeof nights !== 'number' || !Number.isInteger(nights) || nights < 0) issues.push({ code: 'CLS-04', severity: 'error', section: 'rent_roll', field: 'available_room_nights', message: 'Hospitality rent_roll.available_room_nights must be a stated nonnegative integer.' });
      for (const field of ['adr', 'occupancy', 'occupied_room_nights']) {
        const value = facts[field];
        if (value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (field === 'occupancy' && value > 1) || (field === 'occupied_room_nights' && !Number.isInteger(value)))) issues.push({ code: 'CLS-04', severity: 'error', section: 'rent_roll', field, message: `rent_roll.${field} violates its standard field contract.` });
      }
    }
  }
  for (const section of content.sections) {
    const resolved = resolveRoleBlock(parsed.sections[section.id], section.id, ['default', 'base']);
    if (!resolved.block) {
      if (resolved.state === 'unresolvable') issues.push({ code: 'CC-16', severity: 'info', section: section.id, message: `Class field/rule checks could not resolve ${section.id}; choose an eligible primary/default/base block.` });
      // Existing hospitality records use the standard rent-roll/NOI inputs.
      if (section.required && (assetClass !== 'hospitality' || namesLegacyModule) && !parsed.sections[section.id]) {
        issues.push({ code: 'CLS-03', severity: 'error', section: section.id,
          message: `${assetClass} requires ${section.id}.` });
      }
      continue;
    }
    const payload = blockPayload(resolved.block) as Record<string, unknown>;
    const contract = section.schema as SectionContract;
    for (const field of contract.required ?? []) {
      if (payload[field] == null) issues.push({ code: 'CLS-04', severity: contractSeverity, section: section.id,
        field, message: `${section.id}.${field} must be stated.` });
    }
    for (const [field, rule] of Object.entries(contract.properties ?? {})) {
      const value = payload[field];
      if (value === undefined) continue;
      const types = typeof rule.type === 'string' ? [rule.type] : rule.type;
      const matches = !types || types.some(type => type === 'null' ? value === null
        : type === 'integer' ? typeof value === 'number' && Number.isInteger(value)
        : type === 'number' ? typeof value === 'number' && Number.isFinite(value)
        : type === 'string' ? typeof value === 'string'
        : type === 'boolean' ? typeof value === 'boolean'
        : type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
        : false);
      const bounds = typeof value !== 'number' ||
        ((rule.minimum === undefined || value >= rule.minimum) && (rule.maximum === undefined || value <= rule.maximum));
      if (!matches || !bounds || (rule.enum && !rule.enum.includes(value))) {
        issues.push({ code: 'CLS-04', severity: contractSeverity, section: section.id, field,
          message: `${section.id}.${field} violates its standard field contract.` });
      }
    }
  }
  const prior: Record<string, number | string | boolean | null> = {};
  const preRfc = PRE_RFC_BUILTIN_CALCS[assetClass];
  for (const decl of getPackForAssetClass(assetClass)?.calculations ?? []) {
    const result = evaluateCalc(decl, { parsed, prior_results: {}, locale: 'en-US' });
    if (result.ok) { prior[decl.id] = result.value; continue; }
    if (!content.calculation_ids.includes(decl.id) || preRfc?.has(decl.id)) continue;
    // Hospitality's migrated calculations only ever ran for documents naming
    // the legacy module; for every other hotel record they stay uncomputed,
    // as they were before RFC 0080 (no new error, no new warning).
    // RFC 0081 Phase 4: delete the old hospitality module-gating branch.
    if (parsed.frontmatter.uw_version !== '3.0' && assetClass === 'hospitality' && !namesLegacyModule) continue;
    issues.push({ code: 'MOD-CALC-ERROR', severity: ruleSeverity('error'), message: `Builtin ${assetClass} calculation ${decl.id} failed: ${result.error?.message}` });
  }
  // CC-HOSP-01 compares the canonical RevPAR (rooms revenue / available room
  // nights) with the comp set. When the comp set is stated but RevPAR is not
  // computable, say so rather than going silent; no ADR × occupancy fallback
  // is inferred (RFC 0080 decision: one RevPAR definition).
  const revparUncomputable = assetClass === 'hospitality' &&
    hotelMarketRevparStated(parsed) && typeof prior.revpar !== 'number';
  if (revparUncomputable) {
    issues.push({ code: 'CC-HOSP-04', severity: 'warning', section: 'hotel_metrics', field: 'market_revpar',
      message: 'hotel_metrics.market_revpar is stated but RevPAR is uncomputable, so the CC-HOSP-01 comp-set check did not run; state noi_model.income.rooms_revenue and rent_roll.available_room_nights (nonzero). RevPAR is not inferred from ADR × occupancy.' });
  }
  for (const rule of content.validations) {
    if (rule.code === 'CC-HOSP-01' && revparUncomputable) continue;
    const result = evaluateCalc({ id: rule.code, label: rule.code, formula: rule.rule, deterministic: true },
      { parsed, prior_results: prior, locale: 'en-US' });
    if (!result.ok) issues.push({ code: 'MOD-RULE-ERROR', severity: ruleSeverity('error'),
      message: `Builtin ${assetClass} rule ${rule.code} failed: ${result.error?.message}` });
    else if (result.value === false) issues.push({ code: rule.code, severity: ruleSeverity(rule.severity), message: rule.message });
  }
  const size = assetClass === 'data_center' ? 'critical_it_load_kw' : assetClass === 'manufactured_housing' ? 'total_sites' : null;
  if (size) {
    const property = resolveRoleBlock(parsed.sections.property, 'property', ['default', 'base']).block;
    const detail = resolveRoleBlock(parsed.sections[assetClass === 'data_center' ? 'dc_capacity' : 'mhc_sites'], assetClass === 'data_center' ? 'dc_capacity' : 'mhc_sites', ['default', 'base']).block;
    const a = property ? (blockPayload(property) as Record<string, unknown>)[size] : undefined;
    const b = detail ? (blockPayload(detail) as Record<string, unknown>)[size] : undefined;
    if (typeof a === 'number' && Number.isFinite(a) && typeof b === 'number' && Number.isFinite(b) && a !== b) {
      issues.push({ code: assetClass === 'data_center' ? 'CC-DC-08' : 'CC-MH-08', severity: 'error',
        message: `property.${size} must equal the stated class-section ${size}; these identify one physical quantity.` });
    }
  }
  return issues;
}

function hotelMarketRevparStated(parsed: ParsedUWFile): boolean {
  const block = resolveRoleBlock(parsed.sections.hotel_metrics, 'hotel_metrics', ['default', 'base']).block;
  if (!block) return false;
  const value = (blockPayload(block) as Record<string, unknown>).market_revpar;
  return typeof value === 'number' && Number.isFinite(value);
}
