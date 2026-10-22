// RFC 0080 standard field contracts and class verification rules.
// This checks the fixed official fields, not arbitrary third-party JSON Schema.
import { BUILTIN_CLASS_CONTENT } from './builtin-class-content.js';
import { toBuiltinAssetClass, type ParsedUWFile, type ValidationMessage } from './types.js';
import { blockPayload } from './parser.js';
import { resolveRoleBlock } from './block-roles.js';
import { evaluateCalc } from './calc/index.js';
import { ruleSetFor, type UWRuleSet } from './rule-sets.js';

interface FieldContract { type?: string | string[]; minimum?: number; maximum?: number; enum?: unknown[] }
interface SectionContract { required?: string[]; properties?: Record<string, FieldContract> }

/**
 * RFC 0080 class checks under the record's rule set (RFC 0111): `ruleSet`
 * defaults to the one its declared `uw_version` names.
 */
export function checkBuiltinClassContent(parsed: ParsedUWFile, ruleSet?: UWRuleSet): ValidationMessage[] {
  const assetClass = toBuiltinAssetClass(parsed.frontmatter.asset_class);
  if (!assetClass) return [];
  const issues: ValidationMessage[] = [];
  const content = BUILTIN_CLASS_CONTENT[assetClass];
  if (!content) return issues;
  // G3 (RFC 0081 §5): the hotel facts' rent_roll contract.
  if (assetClass === 'hospitality') {
    const roll = resolveRoleBlock(parsed.sections.rent_roll, 'rent_roll', ['default', 'base']).block;
    if (roll) {
      const facts = blockPayload(roll) as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(facts, 'keys')) issues.push({ code: 'CLS-04', severity: 'error', section: 'rent_roll', field: 'keys', message: 'Hospitality keys belong only in property.keys (RFC 0081 G3).' });
      const nights = facts['available_room_nights'];
      if (typeof nights !== 'number' || !Number.isInteger(nights) || nights < 0) issues.push({ code: 'CLS-04', severity: 'error', section: 'rent_roll', field: 'available_room_nights', message: 'Hospitality rent_roll.available_room_nights must be a stated nonnegative integer.' });
      for (const field of ['adr', 'occupancy', 'occupied_room_nights']) {
        const value = facts[field];
        if (value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (field === 'occupancy' && value > 1) || (field === 'occupied_room_nights' && !Number.isInteger(value)))) issues.push({ code: 'CLS-04', severity: 'error', section: 'rent_roll', field, message: `rent_roll.${field} violates its standard field contract.` });
      }
    }
  }
  // G3 removes these official field homes; presence is invalid even when null.
  // This is not a generic additionalProperties diagnostic for unknown fields.
  if (assetClass === 'hospitality') {
    const metrics = resolveRoleBlock(parsed.sections.hotel_metrics, 'hotel_metrics', ['default', 'base']).block;
    if (metrics) {
      const facts = blockPayload(metrics) as Record<string, unknown>;
      for (const field of ['adr', 'occupancy', 'available_room_nights', 'key_count']) {
        if (Object.prototype.hasOwnProperty.call(facts, field)) issues.push({ code: 'CLS-04', severity: 'error', section: 'hotel_metrics', field, message: `hotel_metrics.${field} is not an admitted field home (RFC 0081 G3).` });
      }
    }
  }
  for (const section of content.sections) {
    const resolved = resolveRoleBlock(parsed.sections[section.id], section.id, ['default', 'base']);
    if (!resolved.block) {
      if (resolved.state === 'unresolvable') issues.push({ code: 'CC-16', severity: 'info', section: section.id, message: `Class field/rule checks could not resolve ${section.id}; choose an eligible primary/default/base block.` });
      if (section.required && !parsed.sections[section.id]) {
        issues.push({ code: 'CLS-03', severity: 'error', section: section.id,
          message: `${assetClass} requires ${section.id}.` });
      }
      continue;
    }
    const payload = blockPayload(resolved.block) as Record<string, unknown>;
    const contract = section.schema as SectionContract;
    for (const field of contract.required ?? []) {
      if (payload[field] == null) issues.push({ code: 'CLS-04', severity: 'error', section: section.id,
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
        issues.push({ code: 'CLS-04', severity: 'error', section: section.id, field,
          message: `${section.id}.${field} violates its standard field contract.` });
      }
    }
  }
  const prior: Record<string, number | string | boolean | null> = {};
  for (const decl of (ruleSet ?? ruleSetFor(parsed)).packFor(assetClass)?.calculations ?? []) {
    const result = evaluateCalc(decl, { parsed, prior_results: {}, locale: 'en-US' });
    if (result.ok) { prior[decl.id] = result.value; continue; }
    if (!content.calculation_ids.includes(decl.id)) continue;
    issues.push({ code: 'MOD-CALC-ERROR', severity: 'error', message: `Builtin ${assetClass} calculation ${decl.id} failed: ${result.error?.message}` });
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
    if (!result.ok) issues.push({ code: 'MOD-RULE-ERROR', severity: 'error',
      message: `Builtin ${assetClass} rule ${rule.code} failed: ${result.error?.message}` });
    else if (result.value === false) issues.push({ code: rule.code, severity: rule.severity, message: rule.message });
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
