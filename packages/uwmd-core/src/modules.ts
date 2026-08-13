// Module loader and registry.
//
// v1 modules are declarative ModuleManifest objects. This loader validates the
// protocol-level shape, checks host compatibility, parses safe-expression
// formulas, enforces dependency presence, and returns an immutable in-process
// registry. It deliberately does not perform dynamic imports or introduce new
// asset-class identifiers; those remain v2/RFC concerns.

import { parseExpression } from './calc/parser.js';
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

  for (const candidate of opts.modules) {
    const result = loadModuleManifest(candidate, { ...opts, alreadyLoaded: loaded });
    if (result.ok && result.manifest) {
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

  validateCalculations(errors, manifest);
  validateValidations(errors, manifest);
  validateDependencies(errors, manifest, opts.alreadyLoaded ?? []);
  validateCompatibility(errors, manifest, opts);
  return errors;
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
  const loaded = new Map(alreadyLoaded.map((m) => [m.id, m]));
  for (const dep of manifest.depends_on ?? []) {
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

function normalizeFormatVersion(version: string): string {
  return /^\d+\.\d+$/.test(version) ? `${version}.0` : version;
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
