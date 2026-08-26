import type {
  UWDocumentEnvelope,
  UWEnvelopeBlock,
  UWEnvelopeSectionEntry,
} from './envelope.js';
import { EXTERNAL_ANNOTATION_KEY } from './composition.js';
import type { ParsedUWLite, UWLiteFieldNode, UWLiteScalar } from './lite.js';
import { isBlockedSegment } from './parser.js';
import { FORMAT_VERSION } from './protocol.js';
import { UW_LITE_REPRESENTATION_VERSION } from './source-representation.js';
import type { UWFrontmatter, UWMeta } from './types.js';

export const UW_LITE_BRIDGE_PROFILE = 'deal-summary-v1' as const;
export const UW_LITE_SOURCE_EXTENSION = 'x_uw_lite_source' as const;

export interface UWLiteFieldMapping {
  lite_path: string;
  target_path: string;
  expected_unit?: string;
  label: string;
}

export interface UWLiteCompilationIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
  field_path?: string;
}

export interface UWLiteCompilationReport {
  profile: typeof UW_LITE_BRIDGE_PROFILE;
  mappings: Array<{
    lite_path: string;
    target_path: string;
  }>;
  defaults: Array<{
    path: string;
    value: unknown;
    reason: string;
  }>;
  issues: UWLiteCompilationIssue[];
  source_preserved_in: typeof UW_LITE_SOURCE_EXTENSION;
}

export type UWLiteCompilationResult =
  | {
      ok: true;
      envelope: UWDocumentEnvelope;
      report: UWLiteCompilationReport;
    }
  | {
      ok: false;
      report: UWLiteCompilationReport;
    };

export interface UWLiteProjectionReport {
  profile: typeof UW_LITE_BRIDGE_PROFILE;
  projected_paths: string[];
  omitted_paths: string[];
  /**
   * Sections the source record externalized into `.uwpart.md` fragments
   * (RFC 0021 §3), in envelope order. Projection is UWX→Lite only and never
   * resolves fragments, so the content of these sections is absent from the
   * projection *and* absent from `omitted_paths` — nothing in the envelope
   * enumerates rows the record does not carry. Naming the section is the only
   * complete account available, and §3 requires it.
   */
  externalized_sections: string[];
  warnings: string[];
  lossy: boolean;
}

export interface UWLiteProjectionResult {
  content: string;
  report: UWLiteProjectionReport;
}

export class UWLiteBridgeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'UWLiteBridgeError';
    this.code = code;
  }
}

export const UW_LITE_FIELD_MAPPINGS: readonly UWLiteFieldMapping[] = [
  {
    lite_path: 'acquisition.purchase_price',
    target_path: 'valuation.purchase_price',
    expected_unit: 'USD',
    label: 'Purchase price',
  },
  {
    lite_path: 'valuation.going_in_cap_rate',
    target_path: 'valuation.going_in_cap_rate',
    expected_unit: 'fraction',
    label: 'Going-in cap rate',
  },
  {
    lite_path: 'noi.net_operating_income',
    target_path: 'noi_model.net_operating_income',
    expected_unit: 'USD',
    label: 'Net operating income',
  },
  {
    lite_path: 'debt.loan_amount',
    target_path: 'debt_structure.loan_amount',
    expected_unit: 'USD',
    label: 'Loan amount',
  },
  {
    lite_path: 'debt.interest_rate',
    target_path: 'debt_structure.interest_rate',
    expected_unit: 'fraction',
    label: 'Interest rate',
  },
  {
    lite_path: 'debt.annual_debt_service',
    target_path: 'debt_structure.annual_debt_service',
    expected_unit: 'USD',
    label: 'Annual debt service',
  },
  {
    lite_path: 'property.total_units',
    target_path: 'property.total_units',
    label: 'Total units',
  },
  {
    lite_path: 'property.total_nra_sqft',
    target_path: 'property.total_nra_sqft',
    label: 'Total NRA',
  },
  // RFC 0027: one anchor per size intensive (Protocol §XIII), so a Lite
  // summary can state any asset class's size, not only multifamily's.
  {
    lite_path: 'property.rentable_square_feet',
    target_path: 'property.rentable_square_feet',
    label: 'Rentable square feet',
  },
  {
    lite_path: 'property.gross_leasable_area',
    target_path: 'property.gross_leasable_area',
    label: 'Gross leasable area',
  },
  {
    lite_path: 'property.net_rentable_square_feet',
    target_path: 'property.net_rentable_square_feet',
    label: 'Net rentable square feet',
  },
  {
    lite_path: 'property.rentable_units',
    target_path: 'property.rentable_units',
    label: 'Rentable units',
  },
  {
    lite_path: 'property.keys',
    target_path: 'property.keys',
    label: 'Keys',
  },
  {
    lite_path: 'property.total_beds',
    target_path: 'property.total_beds',
    label: 'Total beds',
  },
  {
    lite_path: 'property.gross_acres',
    target_path: 'property.gross_acres',
    label: 'Gross acres',
  },
  {
    lite_path: 'property.usable_acres',
    target_path: 'property.usable_acres',
    label: 'Usable acres',
  },
  {
    lite_path: 'property.entitled_units',
    target_path: 'property.entitled_units',
    label: 'Entitled units',
  },
] as const;

const MAPPING_BY_LITE_PATH = new Map(
  UW_LITE_FIELD_MAPPINGS.map((mapping) => [mapping.lite_path, mapping]),
);
const _MAPPING_BY_TARGET_PATH = new Map(
  UW_LITE_FIELD_MAPPINGS.map((mapping) => [mapping.target_path, mapping]),
);
const KNOWN_SECTIONS = new Set([
  'deal_context',
  'property',
  'ownership',
  'rent_roll',
  'operating_statement',
  'noi_model',
  'valuation',
  'debt_structure',
  'sources_uses',
  'dcf',
  'stress_tests',
  'market_analysis',
  'borrower_sponsor',
  'due_diligence',
  'risk_assessment',
  'compliance',
  'assumptions',
  'validation',
  'gaps',
]);

export function compileUWLite(document: ParsedUWLite): UWLiteCompilationResult {
  const report: UWLiteCompilationReport = {
    profile: UW_LITE_BRIDGE_PROFILE,
    mappings: [],
    defaults: [],
    issues: document.issues.map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      message: issue.message,
      ...(issue.field_path ? { field_path: issue.field_path } : {}),
    })),
    source_preserved_in: UW_LITE_SOURCE_EXTENSION,
  };

  const frontmatter = compileFrontmatter(document, report);
  const timestamp = readRequiredString(document.frontmatter, 'created', report);
  if (report.issues.some((issue) => issue.severity === 'error') || !frontmatter || !timestamp) {
    return { ok: false, report };
  }

  const actor =
    typeof document.frontmatter['created_by'] === 'string'
      ? document.frontmatter['created_by']
      : 'unknown';
  if (actor === 'unknown') {
    report.defaults.push({
      path: 'frontmatter.created_by',
      value: actor,
      reason: 'Lite bridge provenance default for an unspecified author.',
    });
  }

  const sectionValues = new Map<string, Record<string, unknown>>();
  for (const field of document.fields) {
    const mapping = resolveFieldMapping(field, report);
    if (!mapping) continue;
    if (field.period) {
      report.issues.push({
        code: 'LITE_COMPILE_PERIOD_UNSUPPORTED',
        severity: 'error',
        message: 'Period-qualified fields require a versioned period profile.',
        field_path: field.path,
      });
      continue;
    }
    if (field.scenario && field.scenario !== 'base') {
      report.issues.push({
        code: 'LITE_COMPILE_SCENARIO_UNSUPPORTED',
        severity: 'error',
        message: 'Only the base scenario maps to a current UWX section in this profile.',
        field_path: field.path,
      });
      continue;
    }
    if (mapping.expected_unit && field.unit !== mapping.expected_unit) {
      report.issues.push({
        code: 'LITE_COMPILE_UNIT_MISMATCH',
        severity: 'error',
        message: `Expected unit ${mapping.expected_unit}, received ${field.unit ?? 'none'}.`,
        field_path: field.path,
      });
      continue;
    }

    const [section, ...path] = mapping.target_path.split('.');
    if (!section || path.length === 0 || [section, ...path].some(isBlockedSegment)) {
      throw new UWLiteBridgeError(
        'LITE_MAPPING_INVALID',
        `Invalid target mapping ${mapping.target_path}.`,
      );
    }
    const content = sectionValues.get(section) ?? {};
    if (!setPath(content, path, field.value)) {
      report.issues.push({
        code: 'LITE_COMPILE_TARGET_CONFLICT',
        severity: 'error',
        message: `Multiple Lite fields map to ${mapping.target_path}.`,
        field_path: field.path,
      });
      continue;
    }
    sectionValues.set(section, content);
    report.mappings.push({
      lite_path: field.path,
      target_path: mapping.target_path,
    });
  }

  if (report.issues.some((issue) => issue.severity === 'error')) {
    return { ok: false, report };
  }

  const sections: Record<string, UWEnvelopeSectionEntry> = {};
  for (const [section, values] of [...sectionValues.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    sections[section] = createEnvelopeBlock(section, values, timestamp, actor);
  }

  const sourceExtension = createEnvelopeBlock(
    UW_LITE_SOURCE_EXTENSION,
    {
      representation: 'uw-lite-markdown',
      representation_version: document.representation_version,
      profile: UW_LITE_BRIDGE_PROFILE,
      markdown: document.raw,
    },
    timestamp,
    actor,
  );

  return {
    ok: true,
    envelope: {
      envelope_version: '1.0',
      format_version: FORMAT_VERSION,
      frontmatter,
      sections,
      pipeline_log: [],
      custom_calculations: [],
      custom_scenarios: [],
      extensions: { [UW_LITE_SOURCE_EXTENSION]: sourceExtension },
      superseded: {},
    },
    report,
  };
}

export function projectUWEnvelopeToLite(
  envelope: UWDocumentEnvelope,
): UWLiteProjectionResult {
  const lines = [
    '---',
    `uw_lite_version: ${UW_LITE_REPRESENTATION_VERSION}`,
    ...projectFrontmatter(envelope.frontmatter),
    '---',
    '',
  ];
  const projectedPaths: string[] = [];

  const groups = new Map<string, string[]>();
  for (const mapping of UW_LITE_FIELD_MAPPINGS) {
    const value = getEnvelopePath(envelope, mapping.target_path);
    if (value === undefined) continue;
    const section = mapping.target_path.split('.')[0] ?? 'deal';
    const group = groups.get(section) ?? [];
    group.push(
      `- ${mapping.label}: ${formatProjectedValue(value, mapping.expected_unit)} <!-- uw:${mapping.lite_path} -->`,
    );
    groups.set(section, group);
    projectedPaths.push(mapping.target_path);
  }

  for (const [section, fields] of groups) {
    lines.push(`# ${headingLabel(section)}`, '', ...fields, '');
  }

  const externalizedSections = collectExternalizedSections(envelope);

  const allPaths = collectEnvelopeLeafPaths(envelope);
  const ignored = new Set([
    ...projectedPaths,
    ...Object.keys(envelope.frontmatter).map((key) => `frontmatter.${key}`),
  ]);
  const omittedPaths = allPaths.filter(
    (path) =>
      !ignored.has(path) &&
      !path.includes('._meta.') &&
      !path.startsWith(`extensions.${UW_LITE_SOURCE_EXTENSION}.`) &&
      // The directive's own keys — `parts`, `part_count`, `collection_key` —
      // are packaging, not underwriting data. Listing them here would report
      // the wrapper in place of the contents it stands for, which is worse
      // than silence: an externalized record would appear to omit *fewer*
      // paths than its inline twin. The section is named instead.
      !externalizedSections.some((section) =>
        path.startsWith(`${section}.${EXTERNAL_ANNOTATION_KEY}.`),
      ),
  );

  const warnings: string[] = [];
  if (omittedPaths.length > 0) {
    warnings.push('Projection omits data that is not represented by the selected Lite profile.');
  }
  if (externalizedSections.length > 0) {
    warnings.push(
      `Projection omits ${externalizedSections.length} externalized section(s) whose contents live in fragments this projection does not resolve: ${externalizedSections.join(', ')}.`,
    );
  }

  return {
    content: lines.join('\n').replace(/\n+$/g, '\n'),
    report: {
      profile: UW_LITE_BRIDGE_PROFILE,
      projected_paths: projectedPaths.sort(),
      omitted_paths: omittedPaths.sort(),
      externalized_sections: externalizedSections,
      warnings,
      lossy: omittedPaths.length > 0 || externalizedSections.length > 0,
    },
  };
}

/**
 * Sections carrying an RFC 0021 externalization directive, named by the same
 * path prefix `collectEnvelopeLeafPaths` uses so the two agree on what to drop.
 *
 * Presence of the key is the whole test — whether the directive is *well-formed*
 * is composition's business (`readExternalDirective` throws on a bad one). A
 * projection must not throw over a malformed directive, and a section pointing
 * at fragments is externalized either way.
 */
function collectExternalizedSections(envelope: UWDocumentEnvelope): string[] {
  const sections: string[] = [];
  const isExternal = (block: UWEnvelopeBlock): boolean =>
    isRecord(block.content) && EXTERNAL_ANNOTATION_KEY in block.content;

  for (const [section, entry] of Object.entries(envelope.sections)) {
    if (isEnvelopeBlock(entry)) {
      if (isExternal(entry)) sections.push(section);
      continue;
    }
    for (const [variant, block] of Object.entries(entry)) {
      if (isExternal(block)) sections.push(`${section}.${variant}`);
    }
  }
  return sections;
}

export function stringifyUWX(envelope: UWDocumentEnvelope): string {
  const output = [serializeFrontmatter(envelope.frontmatter), ''];
  for (const [, blocks] of Object.entries(envelope.superseded).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    for (const block of blocks) {
      output.push(serializeEnvelopeBlock(block), '');
    }
  }

  for (const [_section, entry] of Object.entries(envelope.sections).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (isEnvelopeBlock(entry)) {
      output.push(serializeEnvelopeBlock(entry), '');
      continue;
    }
    for (const [, block] of Object.entries(entry).sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      output.push(serializeEnvelopeBlock(block), '');
    }
  }
  for (const [id, block] of Object.entries(envelope.extensions).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (block.annotation.section !== id) {
      throw new UWLiteBridgeError(
        'UWX_EXTENSION_ID_MISMATCH',
        `Extension key ${id} disagrees with its block annotation.`,
      );
    }
    output.push(serializeEnvelopeBlock(block), '');
  }
  for (const block of envelope.custom_calculations) {
    output.push(serializeEnvelopeBlock(block), '');
  }
  for (const block of envelope.custom_scenarios) {
    output.push(serializeEnvelopeBlock(block), '');
  }
  for (const block of envelope.pipeline_log) {
    output.push(serializeEnvelopeBlock(block), '');
  }
  return output.join('\n').replace(/\n+$/g, '\n');
}

function compileFrontmatter(
  document: ParsedUWLite,
  report: UWLiteCompilationReport,
): UWFrontmatter | null {
  const dealId = readRequiredString(document.frontmatter, 'deal_id', report);
  const dealName = readRequiredString(document.frontmatter, 'deal_name', report);
  const created = readRequiredString(document.frontmatter, 'created', report);
  if (!dealId || !dealName || !created) return null;
  const semanticVersion =
    typeof document.frontmatter['uw_version'] === 'string'
      ? document.frontmatter['uw_version']
      : FORMAT_VERSION;
  if (document.frontmatter['uw_version'] === undefined) {
    report.defaults.push({
      path: 'frontmatter.uw_version',
      value: FORMAT_VERSION,
      reason: 'RFC 0017 keeps UW semantic format 1.1 for the initial bridge.',
    });
  }

  const output: Record<string, unknown> = {
    ...document.frontmatter,
    uw_version: semanticVersion,
    deal_id: dealId,
    deal_name: dealName,
    created,
    last_modified:
      typeof document.frontmatter['last_modified'] === 'string'
        ? document.frontmatter['last_modified']
        : created,
  };
  delete output['uw_lite_version'];
  return output as UWFrontmatter;
}

function readRequiredString(
  frontmatter: Record<string, UWLiteScalar | UWLiteScalar[]>,
  key: string,
  report: UWLiteCompilationReport,
): string | null {
  const value = frontmatter[key];
  if (typeof value === 'string' && value.trim() !== '') return value;
  report.issues.push({
    code: 'LITE_COMPILE_FRONTMATTER_REQUIRED',
    severity: 'error',
    message: `Compilation requires frontmatter.${key}.`,
  });
  return null;
}

function resolveFieldMapping(
  field: UWLiteFieldNode,
  report: UWLiteCompilationReport,
): UWLiteFieldMapping | null {
  const mapped = MAPPING_BY_LITE_PATH.get(field.path);
  if (mapped) return mapped;
  const [section, ...rest] = field.path.split('.');
  if (section && rest.length > 0 && KNOWN_SECTIONS.has(section)) {
    return {
      lite_path: field.path,
      target_path: field.path,
      ...(field.unit ? { expected_unit: field.unit } : {}),
      label: field.label,
    };
  }
  report.issues.push({
    code: 'LITE_COMPILE_FIELD_UNKNOWN',
    severity: 'error',
    message: 'Field is not recognized by the selected bridge profile.',
    field_path: field.path,
  });
  return null;
}

function createEnvelopeBlock(
  section: string,
  values: Record<string, unknown>,
  timestamp: string,
  actor: string,
): UWEnvelopeBlock {
  const meta: UWMeta = {
    section,
    version: 1,
    superseded: false,
    source: 'manual',
    agent_id: null,
    agent_version: null,
    actor,
    timestamp,
    confidence: 'high',
    human_review_required: false,
    flags: [],
    input_hash: null,
    notes: null,
  };
  return {
    annotation: {
      section,
      source: 'manual',
      ts: timestamp,
      v: 1,
      confidence: 'high',
    },
    content: { _meta: meta, ...values },
  };
}

function setPath(target: Record<string, unknown>, path: string[], value: unknown): boolean {
  let cursor = target;
  for (let index = 0; index < path.length - 1; index++) {
    const key = path[index];
    const existing = cursor[key];
    if (existing !== undefined && !isRecord(existing)) return false;
    const next = isRecord(existing) ? existing : {};
    cursor[key] = next;
    cursor = next;
  }
  const leaf = path.at(-1);
  if (!leaf || Object.hasOwn(cursor, leaf)) return false;
  cursor[leaf] = value;
  return true;
}

function projectFrontmatter(frontmatter: UWFrontmatter): string[] {
  const keys = ['deal_id', 'deal_name', 'created', 'last_modified', 'asset_class', 'created_by'];
  return keys.flatMap((key) => {
    const value = frontmatter[key];
    return value === undefined ? [] : [`${key}: ${serializeYamlScalar(value)}`];
  });
}

function getEnvelopePath(envelope: UWDocumentEnvelope, path: string): unknown {
  const [section, ...rest] = path.split('.');
  const entry = envelope.sections[section];
  if (!entry || !isEnvelopeBlock(entry)) return undefined;
  let value: unknown = entry.content;
  for (const segment of rest) {
    if (!isRecord(value)) return undefined;
    value = value[segment];
  }
  return value;
}

function collectEnvelopeLeafPaths(envelope: UWDocumentEnvelope): string[] {
  const output: string[] = [];
  flattenLeaves(envelope.frontmatter, 'frontmatter', output);
  for (const [section, entry] of Object.entries(envelope.sections)) {
    if (isEnvelopeBlock(entry)) {
      flattenLeaves(entry.content, section, output);
    } else {
      for (const [variant, block] of Object.entries(entry)) {
        flattenLeaves(block.content, `${section}.${variant}`, output);
      }
    }
  }
  for (const [id, block] of Object.entries(envelope.extensions)) {
    flattenLeaves(block.content, `extensions.${id}`, output);
  }
  return output;
}

function flattenLeaves(value: unknown, prefix: string, output: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenLeaves(item, `${prefix}[${index}]`, output));
    return;
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      flattenLeaves(child, `${prefix}.${key}`, output);
    }
    return;
  }
  output.push(prefix);
}

function formatProjectedValue(value: unknown, unit?: string): string {
  if (typeof value !== 'number') return String(value);
  if (unit === 'USD') {
    return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
  if (unit === 'fraction') {
    return `${(value * 100).toLocaleString('en-US', { maximumFractionDigits: 6 })}%`;
  }
  if (unit === 'ratio') return `${value}x`;
  return value.toLocaleString('en-US', { maximumFractionDigits: 12 });
}

function headingLabel(section: string): string {
  return section
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function serializeFrontmatter(frontmatter: UWFrontmatter): string {
  const priority = ['uw_version', 'deal_id', 'deal_name', 'created', 'last_modified'];
  const keys = Object.keys(frontmatter).sort((left, right) => {
    const leftPriority = priority.indexOf(left);
    const rightPriority = priority.indexOf(right);
    if (leftPriority >= 0 || rightPriority >= 0) {
      if (leftPriority < 0) return 1;
      if (rightPriority < 0) return -1;
      return leftPriority - rightPriority;
    }
    return left.localeCompare(right);
  });
  const lines = ['---'];
  for (const key of keys) {
    const value = frontmatter[key];
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${serializeYamlScalar(item)}`);
    } else if (isRecord(value)) {
      lines.push(`${key}:`);
      for (const [childKey, child] of Object.entries(value).sort(([left], [right]) =>
        left.localeCompare(right),
      )) {
        lines.push(`  ${childKey}: ${serializeYamlScalar(child)}`);
      }
    } else {
      lines.push(`${key}: ${serializeYamlScalar(value)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

function serializeYamlScalar(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const text = String(value);
  if (
    text === '' ||
    /^(?:true|false|null|~|-?\d+(?:\.\d+)?)$/i.test(text) ||
    /[:#\[\]{},&*!|>'"%@\`\s]/.test(text)
  ) {
    return JSON.stringify(text);
  }
  return text;
}

function serializeEnvelopeBlock(block: UWEnvelopeBlock): string {
  const annotation = Object.entries(block.annotation)
    .filter(([key]) => key !== 'section')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
  const fence = `\`\`\`json uw:section=${block.annotation.section}${annotation ? ` ${annotation}` : ''}`;
  const content = JSON.stringify(sortObject(block.content), null, 2);
  return [block.prose?.trim(), fence, content, '\`\`\`'].filter(Boolean).join('\n');
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => {
        if (left === '_meta') return -1;
        if (right === '_meta') return 1;
        return left.localeCompare(right);
      })
      .map(([key, child]) => [key, sortObject(child)]),
  );
}

function isEnvelopeBlock(value: UWEnvelopeSectionEntry): value is UWEnvelopeBlock {
  return isRecord(value) && 'annotation' in value && 'content' in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
