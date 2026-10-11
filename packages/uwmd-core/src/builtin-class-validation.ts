// RFC 0080 standard field contracts and class verification rules.
// This checks the fixed official fields, not arbitrary third-party JSON Schema.
import { BUILTIN_CLASS_CONTENT } from './builtin-class-content.js';
import { toBuiltinAssetClass, type ParsedUWFile, type ValidationMessage } from './types.js';
import { blockPayload } from './parser.js';
import { resolveRoleBlock } from './block-roles.js';
import { declaredModuleDependencies } from './asset-class.js';
import { evaluateCalc } from './calc/index.js';
import { getPackForAssetClass } from './packs/index.js';

interface FieldContract { type?: string | string[]; minimum?: number; maximum?: number; enum?: unknown[] }
interface SectionContract { required?: string[]; properties?: Record<string, FieldContract> }

export function checkBuiltinClassContent(parsed: ParsedUWFile): ValidationMessage[] {
  const assetClass = toBuiltinAssetClass(parsed.frontmatter.asset_class);
  if (!assetClass) return [];
  const content = BUILTIN_CLASS_CONTENT[assetClass];
  if (!content) return [];
  const issues: ValidationMessage[] = [];
  if (['data_center', 'manufactured_housing'].includes(parsed.frontmatter.asset_class) && parsed.frontmatter.uw_version !== '2.1') issues.push({ code: 'CLS-05', severity: 'error', field: 'uw_version', message: 'The new official builtin ids require Format 2.1; the exact legacy org.uwmd.data_center alias remains readable at its original version.' });
  for (const section of content.sections) {
    const resolved = resolveRoleBlock(parsed.sections[section.id], section.id, ['default', 'base']);
    if (!resolved.block) {
      if (resolved.state === 'unresolvable') issues.push({ code: 'CC-16', severity: 'info', section: section.id, message: `Class field/rule checks could not resolve ${section.id}; choose an eligible primary/default/base block.` });
      // Existing hospitality records use the standard rent-roll/NOI inputs.
      if (section.required && (assetClass !== 'hospitality' || declaredModuleDependencies(parsed.frontmatter as Record<string, unknown>).some(d => d.id === 'org.uwmd.hospitality')) && !parsed.sections[section.id]) {
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
  for (const decl of getPackForAssetClass(assetClass)?.calculations ?? []) {
    const result = evaluateCalc(decl, { parsed, prior_results: {}, locale: 'en-US' });
    if (result.ok) prior[decl.id] = result.value;
    else if (content.calculation_ids.includes(decl.id)) issues.push({ code: 'MOD-CALC-ERROR', severity: 'error', message: `Builtin ${assetClass} calculation ${decl.id} failed: ${result.error?.message}` });
  }
  for (const rule of content.validations) {
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
