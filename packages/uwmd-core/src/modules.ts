// Module loader and registry.
//
// v1 modules are declarative ModuleManifest objects. This loader validates the
// protocol-level shape, checks host compatibility, parses safe-expression
// formulas, enforces dependency presence, and returns an immutable in-process
// registry. It deliberately does not perform dynamic imports or introduce new
// asset-class identifiers; those remain v2/RFC concerns.

import { parseExpression } from './calc/parser.js';
import { MAX_ROUND_TO } from './calc/quantize.js';
import {
  FORMAT_VERSION,
  PROTOCOL_VERSION,
  type ModuleLoadResult,
  type ModuleManifest,
  type ProtocolError,
  type ViewerTier,
} from './protocol.js';
import { ASSET_CLASSES } from './types.js';
import type { DealStage, ValidationSeverity } from './types.js';

const TIERS: readonly ViewerTier[] = [
  'tier-1-reader',
  'tier-2-editor',
  'tier-3-calc-host',
  'tier-4-agent-host',
];

const DEAL_STAGES: readonly DealStage[] = [
  'scope',
  'screening',
  'term_sheet',
  'full_underwrite',
  'credit_approval',
  'closing',
  'monitoring',
];

const SEVERITIES: readonly ValidationSeverity[] = ['error', 'warning', 'info'];

const FIELD_VIEW_KINDS: readonly string[] = [
  'currency',
  'percent',
  'ratio',
  'count',
  'date',
  'string',
  'enum',
  'list',
];

// Key sets mirror `additionalProperties: false` in
// spec/schemas/module-manifest.schema.json. An unknown key is a typo far more
// often than it is a forward-compatible extension, and a typo'd `calculationz`
// silently contributes nothing — `manifest_version` is the forward-compat lever.
const MANIFEST_KEYS: readonly string[] = [
  'manifest_version', 'id', 'name', 'version', 'description', 'authors', 'license',
  'requires_protocol', 'requires_format', 'requires_tier', 'asset_classes',
  'deal_stages', 'sections', 'calculations', 'validations', 'thresholds',
  'view_models', 'ui', 'agent_layers', 'depends_on',
];
const SECTION_KEYS: readonly string[] = ['id', 'display_name', 'schema', 'required'];
const CALC_KEYS: readonly string[] = ['id', 'label', 'formula', 'unit', 'round_to', 'deterministic'];
const VALIDATION_KEYS: readonly string[] = ['code', 'severity', 'message', 'rule'];
const VIEW_MODEL_KEYS: readonly string[] = [
  'section_id', 'display_name', 'display_order', 'description',
  'primary_fields', 'detail_fields', 'multi_variant',
];
const FIELD_HINT_KEYS: readonly string[] = [
  'path', 'label', 'kind', 'primary', 'unit', 'decimals', 'enum',
];
const AGENT_LAYER_KEYS: readonly string[] = ['id', 'reads', 'writes', 'prompt_template'];
const DEPENDS_ON_KEYS: readonly string[] = ['id', 'version'];

// Length caps mirror the schema's minLength/maxLength constraints.
const ID_MIN_LENGTH = 3;
const ID_MAX_LENGTH = 128;
const NAME_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 2000;
const AGENT_LAYER_ID_PATTERN = /^L\d+(?:_[a-z_]+)?$/;

export interface ModuleRegistry {
  modules: readonly ModuleManifest[];
  byId: ReadonlyMap<string, ModuleManifest>;
  byAssetClass: ReadonlyMap<string, readonly ModuleManifest[]>;
  calculationsByAssetClass(asset_class: string): ModuleManifest[];
}

export interface LoadModuleOptions {
  hostTier?: ViewerTier;
  protocolVersion?: string;
  formatVersion?: string;
  alreadyLoaded?: readonly ModuleManifest[];
}

export interface CreateModuleRegistryOptions extends LoadModuleOptions {
  modules: readonly ModuleManifest[];
}

export class ModuleRegistryError extends Error {
  readonly errors: readonly ProtocolError[];

  constructor(errors: readonly ProtocolError[]) {
    super(errors.map((e) => `${e.code}: ${e.message}`).join('; '));
    this.name = 'ModuleRegistryError';
    this.errors = errors;
  }
}

export function loadModuleManifest(
  candidate: unknown,
  opts: LoadModuleOptions = {},
): ModuleLoadResult {
  const manifest = candidate as ModuleManifest;
  const errors = validateModuleManifest(manifest, opts);
  return errors.length
    ? { ok: false, errors }
    : { ok: true, manifest: freezeManifest(manifest), errors: [] };
}

export function createModuleRegistry(opts: CreateModuleRegistryOptions): ModuleRegistry {
  const loaded: ModuleManifest[] = [];
  const errors: ProtocolError[] = [];

  const seenIds = new Set<string>();
  for (const candidate of opts.modules) {
    const result = loadModuleManifest(candidate, { ...opts, alreadyLoaded: loaded });
    if (result.ok && result.manifest) {
      // Two manifests sharing an id used to both load, with `byId` silently
      // resolving to whichever came last — a registry lookup returning the
      // wrong module. Refuse rather than pick.
      if (seenIds.has(result.manifest.id)) {
        errors.push(moduleError(
          'PROTO-MOD-066',
          `Duplicate module id in registry: ${result.manifest.id}`,
          'id',
        ));
        continue;
      }
      seenIds.add(result.manifest.id);
      loaded.push(result.manifest);
    } else {
      errors.push(...result.errors);
    }
  }

  if (errors.length > 0) throw new ModuleRegistryError(errors);

  const byId = new Map<string, ModuleManifest>();
  const byAssetClassMutable = new Map<string, ModuleManifest[]>();
  for (const manifest of loaded) {
    byId.set(manifest.id, manifest);
    for (const assetClass of manifest.asset_classes ?? []) {
      const bucket = byAssetClassMutable.get(assetClass) ?? [];
      bucket.push(manifest);
      byAssetClassMutable.set(assetClass, bucket);
    }
  }
  const byAssetClass = new Map<string, readonly ModuleManifest[]>(
    [...byAssetClassMutable.entries()].map(([k, v]) => [k, Object.freeze([...v])]),
  );

  return Object.freeze({
    modules: Object.freeze([...loaded]),
    byId,
    byAssetClass,
    calculationsByAssetClass(asset_class: string): ModuleManifest[] {
      return [...(byAssetClass.get(asset_class) ?? [])].filter(
        (m) => (m.calculations ?? []).length > 0,
      );
    },
  });
}

export function getModuleCalculationsForAssetClass(
  registry: ModuleRegistry,
  asset_class: string,
) {
  return registry
    .calculationsByAssetClass(asset_class)
    .flatMap((m) => m.calculations ?? []);
}

function validateModuleManifest(
  manifest: ModuleManifest,
  opts: LoadModuleOptions,
): ProtocolError[] {
  const errors: ProtocolError[] = [];
  if (!isRecord(manifest)) {
    return [moduleError('PROTO-MOD-001', 'Module manifest must be an object.')];
  }

  requireString(errors, manifest, 'manifest_version');
  requireString(errors, manifest, 'id');
  requireString(errors, manifest, 'name');
  requireString(errors, manifest, 'version');
  requireString(errors, manifest, 'description');
  requireString(errors, manifest, 'license');
  requireString(errors, manifest, 'requires_protocol');
  requireString(errors, manifest, 'requires_format');
  requireString(errors, manifest, 'requires_tier');

  if (manifest.manifest_version !== '1') {
    errors.push(moduleError('PROTO-MOD-002', 'Unsupported module manifest_version.', 'manifest_version'));
  }
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(String(manifest.id ?? ''))) {
    errors.push(moduleError('PROTO-MOD-003', 'Module id must match the v1 identifier pattern.', 'id'));
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(String(manifest.version ?? ''))) {
    errors.push(moduleError('PROTO-MOD-004', 'Module version must be semver.', 'version'));
  }
  if (!Array.isArray(manifest.authors) || manifest.authors.length === 0 || !manifest.authors.every((a) => typeof a === 'string' && a.length > 0)) {
    errors.push(moduleError('PROTO-MOD-005', 'Module authors must be a non-empty string array.', 'authors'));
  }
  if (!TIERS.includes(manifest.requires_tier)) {
    errors.push(moduleError('PROTO-MOD-006', 'Module requires_tier is not a valid viewer tier.', 'requires_tier'));
  }

  rejectUnknownKeys(errors, manifest, MANIFEST_KEYS, '');
  boundLength(errors, manifest.id, 'id', ID_MIN_LENGTH, ID_MAX_LENGTH);
  boundLength(errors, manifest.name, 'name', 1, NAME_MAX_LENGTH);
  boundLength(errors, manifest.description, 'description', 1, DESCRIPTION_MAX_LENGTH);

  if (manifest.asset_classes !== undefined) {
    if (!Array.isArray(manifest.asset_classes)) {
      errors.push(moduleError('PROTO-MOD-007', 'asset_classes must be an array.', 'asset_classes'));
    } else {
      for (const assetClass of manifest.asset_classes) {
        if (!ASSET_CLASSES.includes(assetClass)) {
          errors.push(moduleError('PROTO-MOD-008', `Unknown v1 asset class: ${assetClass}`, 'asset_classes'));
        }
      }
      if (new Set(manifest.asset_classes).size !== manifest.asset_classes.length) {
        errors.push(moduleError('PROTO-MOD-009', 'asset_classes must be unique.', 'asset_classes'));
      }
    }
  }

  if (manifest.deal_stages !== undefined) {
    if (!Array.isArray(manifest.deal_stages)) {
      errors.push(moduleError('PROTO-MOD-010', 'deal_stages must be an array.', 'deal_stages'));
    } else {
      for (const stage of manifest.deal_stages) {
        if (!DEAL_STAGES.includes(stage)) {
          errors.push(moduleError('PROTO-MOD-011', `Unknown deal stage: ${stage}`, 'deal_stages'));
        }
      }
    }
  }

  validateSections(errors, manifest);
  validateCalculations(errors, manifest);
  validateValidations(errors, manifest);
  validateThresholds(errors, manifest);
  validateViewModels(errors, manifest);
  validateAgentLayers(errors, manifest);
  validateDependsOnShape(errors, manifest);
  validateDependencies(errors, manifest, opts.alreadyLoaded ?? []);
  validateCompatibility(errors, manifest, opts);
  return errors;
}

function validateSections(errors: ProtocolError[], manifest: ModuleManifest): void {
  if (manifest.sections === undefined) return;
  if (!Array.isArray(manifest.sections)) {
    errors.push(moduleError('PROTO-MOD-033', 'sections must be an array.', 'sections'));
    return;
  }
  const ids = new Set<string>();
  for (const [idx, section] of manifest.sections.entries()) {
    const pointer = `sections[${idx}]`;
    if (!isRecord(section)) {
      errors.push(moduleError('PROTO-MOD-034', 'Section declaration must be an object.', pointer));
      continue;
    }
    rejectUnknownKeys(errors, section, SECTION_KEYS, pointer);
    if (typeof section.id !== 'string' || section.id.length === 0) {
      errors.push(moduleError('PROTO-MOD-035', 'Section id is required.', `${pointer}.id`));
    } else if (ids.has(section.id)) {
      errors.push(moduleError('PROTO-MOD-036', `Duplicate section id: ${section.id}`, `${pointer}.id`));
    } else {
      ids.add(section.id);
    }
    if (typeof section.display_name !== 'string' || section.display_name.length === 0) {
      errors.push(moduleError('PROTO-MOD-037', 'Section display_name is required.', `${pointer}.display_name`));
    }
    // The schema fragment is not itself compiled here — core carries no JSON
    // Schema validator by design (the layering invariant permits only the
    // Anthropic SDK as a runtime dependency). Shape is checked; semantics are
    // the host's to enforce with whatever validator it already has.
    if (!isRecord(section.schema)) {
      errors.push(moduleError('PROTO-MOD-038', 'Section schema must be a JSON Schema object.', `${pointer}.schema`));
    }
    if (section.required !== undefined && typeof section.required !== 'boolean') {
      errors.push(moduleError('PROTO-MOD-039', 'Section required must be a boolean.', `${pointer}.required`));
    }
  }
}

function validateThresholds(errors: ProtocolError[], manifest: ModuleManifest): void {
  if (manifest.thresholds === undefined) return;
  if (!isRecord(manifest.thresholds)) {
    errors.push(moduleError('PROTO-MOD-040', 'thresholds must be an object.', 'thresholds'));
    return;
  }
  for (const [key, value] of Object.entries(manifest.thresholds)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(moduleError(
        'PROTO-MOD-041',
        `Threshold override ${key} must be a finite number.`,
        `thresholds.${key}`,
      ));
    }
  }
}

function validateViewModels(errors: ProtocolError[], manifest: ModuleManifest): void {
  if (manifest.view_models === undefined) return;
  if (!Array.isArray(manifest.view_models)) {
    errors.push(moduleError('PROTO-MOD-042', 'view_models must be an array.', 'view_models'));
    return;
  }
  for (const [idx, vm] of manifest.view_models.entries()) {
    const pointer = `view_models[${idx}]`;
    if (!isRecord(vm)) {
      errors.push(moduleError('PROTO-MOD-043', 'View model declaration must be an object.', pointer));
      continue;
    }
    rejectUnknownKeys(errors, vm, VIEW_MODEL_KEYS, pointer);
    for (const key of ['section_id', 'display_name', 'description'] as const) {
      if (typeof vm[key] !== 'string' || (vm[key] as string).length === 0) {
        errors.push(moduleError('PROTO-MOD-044', `View model ${key} is required.`, `${pointer}.${key}`));
      }
    }
    if (typeof vm.display_order !== 'number' || !Number.isInteger(vm.display_order) || vm.display_order < 0) {
      errors.push(moduleError(
        'PROTO-MOD-045',
        'View model display_order must be a non-negative integer.',
        `${pointer}.display_order`,
      ));
    }
    validateFieldHints(errors, vm.primary_fields, `${pointer}.primary_fields`, true);
    validateFieldHints(errors, vm.detail_fields, `${pointer}.detail_fields`, false);
    if (vm.multi_variant !== undefined && typeof vm.multi_variant !== 'boolean') {
      errors.push(moduleError('PROTO-MOD-046', 'View model multi_variant must be a boolean.', `${pointer}.multi_variant`));
    }
  }
}

function validateFieldHints(
  errors: ProtocolError[],
  hints: unknown,
  pointer: string,
  required: boolean,
): void {
  if (hints === undefined) {
    if (required) errors.push(moduleError('PROTO-MOD-047', 'primary_fields is required.', pointer));
    return;
  }
  if (!Array.isArray(hints)) {
    errors.push(moduleError('PROTO-MOD-048', 'Field hint list must be an array.', pointer));
    return;
  }
  for (const [idx, hint] of hints.entries()) {
    const hintPointer = `${pointer}[${idx}]`;
    if (!isRecord(hint)) {
      errors.push(moduleError('PROTO-MOD-049', 'Field view hint must be an object.', hintPointer));
      continue;
    }
    rejectUnknownKeys(errors, hint, FIELD_HINT_KEYS, hintPointer);
    for (const key of ['path', 'label'] as const) {
      if (typeof hint[key] !== 'string' || (hint[key] as string).length === 0) {
        errors.push(moduleError('PROTO-MOD-050', `Field view hint ${key} is required.`, `${hintPointer}.${key}`));
      }
    }
    if (typeof hint.kind !== 'string' || !FIELD_VIEW_KINDS.includes(hint.kind)) {
      errors.push(moduleError(
        'PROTO-MOD-051',
        `Field view hint kind must be one of: ${FIELD_VIEW_KINDS.join(', ')}.`,
        `${hintPointer}.kind`,
      ));
    }
    if (hint.decimals !== undefined) {
      if (typeof hint.decimals !== 'number' || !Number.isInteger(hint.decimals) || hint.decimals < 0 || hint.decimals > 10) {
        errors.push(moduleError(
          'PROTO-MOD-052',
          'Field view hint decimals must be an integer between 0 and 10.',
          `${hintPointer}.decimals`,
        ));
      }
    }
    if (hint.primary !== undefined && typeof hint.primary !== 'boolean') {
      errors.push(moduleError('PROTO-MOD-053', 'Field view hint primary must be a boolean.', `${hintPointer}.primary`));
    }
    if (hint.enum !== undefined && (!Array.isArray(hint.enum) || !hint.enum.every((v) => typeof v === 'string'))) {
      errors.push(moduleError('PROTO-MOD-054', 'Field view hint enum must be a string array.', `${hintPointer}.enum`));
    }
  }
}

// Agent layers carry `prompt_template`, so a malformed one is a Tier-4 prompt
// surface defect, not just a shape error. This is the construct with the widest
// blast radius and it previously had no validation at all.
function validateAgentLayers(errors: ProtocolError[], manifest: ModuleManifest): void {
  if (manifest.agent_layers === undefined) return;
  if (!Array.isArray(manifest.agent_layers)) {
    errors.push(moduleError('PROTO-MOD-055', 'agent_layers must be an array.', 'agent_layers'));
    return;
  }
  const ids = new Set<string>();
  for (const [idx, layer] of manifest.agent_layers.entries()) {
    const pointer = `agent_layers[${idx}]`;
    if (!isRecord(layer)) {
      errors.push(moduleError('PROTO-MOD-056', 'Agent layer declaration must be an object.', pointer));
      continue;
    }
    rejectUnknownKeys(errors, layer, AGENT_LAYER_KEYS, pointer);
    if (typeof layer.id !== 'string' || !AGENT_LAYER_ID_PATTERN.test(layer.id)) {
      errors.push(moduleError(
        'PROTO-MOD-057',
        'Agent layer id must match ^L\\d+(?:_[a-z_]+)?$.',
        `${pointer}.id`,
      ));
    } else if (ids.has(layer.id)) {
      errors.push(moduleError('PROTO-MOD-058', `Duplicate agent layer id: ${layer.id}`, `${pointer}.id`));
    } else {
      ids.add(layer.id);
    }
    for (const key of ['reads', 'writes'] as const) {
      const value = layer[key];
      if (!Array.isArray(value) || !value.every((v) => typeof v === 'string' && v.length > 0)) {
        errors.push(moduleError(
          'PROTO-MOD-059',
          `Agent layer ${key} must be an array of non-empty strings.`,
          `${pointer}.${key}`,
        ));
      }
    }
    if (typeof layer.prompt_template !== 'string' || layer.prompt_template.length === 0) {
      errors.push(moduleError(
        'PROTO-MOD-060',
        'Agent layer prompt_template must be a non-empty string.',
        `${pointer}.prompt_template`,
      ));
    }
  }
}

function validateDependsOnShape(errors: ProtocolError[], manifest: ModuleManifest): void {
  if (manifest.depends_on === undefined) return;
  if (!Array.isArray(manifest.depends_on)) {
    errors.push(moduleError('PROTO-MOD-061', 'depends_on must be an array.', 'depends_on'));
    return;
  }
  for (const [idx, dep] of manifest.depends_on.entries()) {
    const pointer = `depends_on[${idx}]`;
    if (!isRecord(dep)) {
      errors.push(moduleError('PROTO-MOD-062', 'Dependency declaration must be an object.', pointer));
      continue;
    }
    rejectUnknownKeys(errors, dep, DEPENDS_ON_KEYS, pointer);
    for (const key of ['id', 'version'] as const) {
      if (typeof dep[key] !== 'string' || (dep[key] as string).length === 0) {
        errors.push(moduleError('PROTO-MOD-063', `Dependency ${key} is required.`, `${pointer}.${key}`));
      }
    }
  }
}

function validateCalculations(errors: ProtocolError[], manifest: ModuleManifest): void {
  if (manifest.calculations === undefined) return;
  if (!Array.isArray(manifest.calculations)) {
    errors.push(moduleError('PROTO-MOD-012', 'calculations must be an array.', 'calculations'));
    return;
  }
  const ids = new Set<string>();
  for (const [idx, calc] of manifest.calculations.entries()) {
    const pointer = `calculations[${idx}]`;
    if (!isRecord(calc)) {
      errors.push(moduleError('PROTO-MOD-013', 'Calculation declaration must be an object.', pointer));
      continue;
    }
    rejectUnknownKeys(errors, calc, CALC_KEYS, pointer);
    if (typeof calc.id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(calc.id)) {
      errors.push(moduleError('PROTO-MOD-014', 'Calculation id must match ^[a-z][a-z0-9_]*$.', `${pointer}.id`));
    }
    if (ids.has(String(calc.id))) {
      errors.push(moduleError('PROTO-MOD-015', `Duplicate calculation id: ${String(calc.id)}`, `${pointer}.id`));
    }
    ids.add(String(calc.id));
    if (typeof calc.label !== 'string' || calc.label.length === 0) {
      errors.push(moduleError('PROTO-MOD-016', 'Calculation label is required.', `${pointer}.label`));
    }
    if (typeof calc.formula !== 'string' || calc.formula.length === 0) {
      errors.push(moduleError('PROTO-MOD-017', 'Calculation formula is required.', `${pointer}.formula`));
    } else {
      try {
        parseExpression(calc.formula);
      } catch (e) {
        errors.push(moduleError(
          'PROTO-MOD-018',
          `Calculation formula does not parse: ${e instanceof Error ? e.message : String(e)}`,
          `${pointer}.formula`,
        ));
      }
    }
    if (calc.deterministic !== true) {
      errors.push(moduleError('PROTO-MOD-019', 'v1 calculations must declare deterministic: true.', `${pointer}.deterministic`));
    }
    // §VIII.5: round_to is the precision contract a receipt digest depends on, so
    // a malformed one is refused rather than silently replaced by the unit default.
    if (calc.round_to !== undefined) {
      if (
        typeof calc.round_to !== 'number'
        || !Number.isInteger(calc.round_to)
        || calc.round_to < 0
        || calc.round_to > MAX_ROUND_TO
      ) {
        errors.push(moduleError(
          'PROTO-MOD-067',
          `Calculation round_to must be an integer in [0, ${MAX_ROUND_TO}].`,
          `${pointer}.round_to`,
        ));
      }
    }
  }
}

function validateValidations(errors: ProtocolError[], manifest: ModuleManifest): void {
  if (manifest.validations === undefined) return;
  if (!Array.isArray(manifest.validations)) {
    errors.push(moduleError('PROTO-MOD-020', 'validations must be an array.', 'validations'));
    return;
  }
  for (const [idx, rule] of manifest.validations.entries()) {
    const pointer = `validations[${idx}]`;
    if (!isRecord(rule)) {
      errors.push(moduleError('PROTO-MOD-021', 'Validation declaration must be an object.', pointer));
      continue;
    }
    rejectUnknownKeys(errors, rule, VALIDATION_KEYS, pointer);
    if (typeof rule.code !== 'string' || !/^[A-Z]{2,8}-[A-Z0-9-]+$/.test(rule.code)) {
      errors.push(moduleError('PROTO-MOD-022', 'Validation code must match the module-code pattern.', `${pointer}.code`));
    }
    if (!SEVERITIES.includes(rule.severity)) {
      errors.push(moduleError('PROTO-MOD-023', 'Validation severity is invalid.', `${pointer}.severity`));
    }
    if (typeof rule.message !== 'string' || rule.message.length === 0) {
      errors.push(moduleError('PROTO-MOD-024', 'Validation message is required.', `${pointer}.message`));
    }
    if (typeof rule.rule !== 'string' || rule.rule.length === 0) {
      errors.push(moduleError('PROTO-MOD-025', 'Validation rule is required.', `${pointer}.rule`));
    } else {
      try {
        parseExpression(rule.rule);
      } catch (e) {
        errors.push(moduleError(
          'PROTO-MOD-026',
          `Validation rule does not parse: ${e instanceof Error ? e.message : String(e)}`,
          `${pointer}.rule`,
        ));
      }
    }
  }
}

function validateDependencies(
  errors: ProtocolError[],
  manifest: ModuleManifest,
  alreadyLoaded: readonly ModuleManifest[],
): void {
  // Shape is validated separately; skip resolution entirely if it is malformed
  // so a `depends_on: "other"` string is not iterated character by character.
  if (manifest.depends_on !== undefined && !Array.isArray(manifest.depends_on)) return;
  const loaded = new Map(alreadyLoaded.map((m) => [m.id, m]));
  for (const dep of manifest.depends_on ?? []) {
    if (!isRecord(dep) || typeof dep.id !== 'string' || typeof dep.version !== 'string') continue;
    const dependency = loaded.get(dep.id);
    if (!dependency) {
      errors.push(moduleError('PROTO-MOD-027', `Missing module dependency: ${dep.id}`, 'depends_on'));
      continue;
    }
    if (!versionSatisfies(dependency.version, dep.version)) {
      errors.push(moduleError(
        'PROTO-MOD-028',
        `Module dependency ${dep.id}@${dependency.version} does not satisfy ${dep.version}.`,
        'depends_on',
      ));
    }
  }
}

function validateCompatibility(
  errors: ProtocolError[],
  manifest: ModuleManifest,
  opts: LoadModuleOptions,
): void {
  const hostTier = opts.hostTier ?? 'tier-3-calc-host';
  if (TIERS.indexOf(hostTier) < TIERS.indexOf(manifest.requires_tier)) {
    errors.push(moduleError(
      'PROTO-MOD-029',
      `Host tier ${hostTier} does not satisfy required tier ${manifest.requires_tier}.`,
      'requires_tier',
    ));
  }
  const protocolVersion = opts.protocolVersion ?? PROTOCOL_VERSION;
  if (!versionSatisfies(protocolVersion, manifest.requires_protocol)) {
    errors.push(moduleError(
      'PROTO-MOD-030',
      `Host protocol ${protocolVersion} does not satisfy ${manifest.requires_protocol}.`,
      'requires_protocol',
    ));
  }
  const formatVersion = normalizeFormatVersion(opts.formatVersion ?? FORMAT_VERSION);
  if (!versionSatisfies(formatVersion, manifest.requires_format)) {
    errors.push(moduleError(
      'PROTO-MOD-031',
      `Host format ${formatVersion} does not satisfy ${manifest.requires_format}.`,
      'requires_format',
    ));
  }
}

function versionSatisfies(version: string, range: string): boolean {
  const normalizedVersion = normalizeFormatVersion(version);
  const v = parseSemver(normalizedVersion);
  if (!v) return false;
  const trimmed = range.trim();
  if (trimmed === '*' || trimmed === '') return true;
  if (trimmed.startsWith('^')) {
    const base = parseSemver(normalizeFormatVersion(trimmed.slice(1)));
    return !!base && v.major === base.major && compareSemver(v, base) >= 0;
  }
  const comparators = trimmed.split(/\s+/).filter(Boolean);
  return comparators.every((part) => {
    const m = /^(>=|>|<=|<|=)?(.+)$/.exec(part);
    if (!m) return false;
    const op = m[1] ?? '=';
    const target = parseSemver(normalizeFormatVersion(m[2] ?? ''));
    if (!target) return false;
    const cmp = compareSemver(v, target);
    switch (op) {
      case '>': return cmp > 0;
      case '>=': return cmp >= 0;
      case '<': return cmp < 0;
      case '<=': return cmp <= 0;
      default: return cmp === 0;
    }
  });
}

// Partial versions are padded to full semver before comparison. The schema
// documents `^1` as a valid requires_protocol spelling, but only `X.Y` was
// padded, so a bare major failed to parse and every range containing one was
// silently unsatisfiable.
function normalizeFormatVersion(version: string): string {
  const trimmed = version.trim();
  if (/^\d+$/.test(trimmed)) return `${trimmed}.0.0`;
  if (/^\d+\.\d+$/.test(trimmed)) return `${trimmed}.0`;
  return trimmed;
}

function parseSemver(version: string): { major: number; minor: number; patch: number } | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  return m ? { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) } : null;
}

function compareSemver(
  a: { major: number; minor: number; patch: number },
  b: { major: number; minor: number; patch: number },
): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

function requireString(
  errors: ProtocolError[],
  manifest: Record<string, unknown>,
  key: string,
): void {
  if (typeof manifest[key] !== 'string' || (manifest[key] as string).length === 0) {
    errors.push(moduleError('PROTO-MOD-032', `Required string field missing: ${key}`, key));
  }
}

function rejectUnknownKeys(
  errors: ProtocolError[],
  value: Record<string, unknown>,
  allowed: readonly string[],
  pointer: string,
): void {
  for (const key of Object.keys(value)) {
    if (allowed.includes(key)) continue;
    errors.push(moduleError(
      'PROTO-MOD-064',
      `Unknown key: ${key}`,
      pointer ? `${pointer}.${key}` : key,
    ));
  }
}

function boundLength(
  errors: ProtocolError[],
  value: unknown,
  key: string,
  min: number,
  max: number,
): void {
  if (typeof value !== 'string') return; // requireString already reported it
  if (value.length < min || value.length > max) {
    errors.push(moduleError(
      'PROTO-MOD-065',
      `${key} must be between ${min} and ${max} characters (got ${value.length}).`,
      key,
    ));
  }
}

function freezeManifest(manifest: ModuleManifest): ModuleManifest {
  return Object.freeze({
    ...manifest,
    authors: Object.freeze([...(manifest.authors ?? [])]),
    asset_classes: manifest.asset_classes ? Object.freeze([...manifest.asset_classes]) : undefined,
    deal_stages: manifest.deal_stages ? Object.freeze([...manifest.deal_stages]) : undefined,
    sections: manifest.sections ? Object.freeze([...manifest.sections]) : undefined,
    calculations: manifest.calculations ? Object.freeze([...manifest.calculations]) : undefined,
    validations: manifest.validations ? Object.freeze([...manifest.validations]) : undefined,
    view_models: manifest.view_models ? Object.freeze([...manifest.view_models]) : undefined,
    agent_layers: manifest.agent_layers ? Object.freeze([...manifest.agent_layers]) : undefined,
    depends_on: manifest.depends_on ? Object.freeze([...manifest.depends_on]) : undefined,
  }) as unknown as ModuleManifest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function moduleError(code: string, message: string, pointer?: string): ProtocolError {
  return { category: 'module', code, message, ...(pointer ? { pointer } : {}) };
}
