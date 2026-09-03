import { strToU8, unzipSync, zipSync } from 'fflate';
import { inspectZipSafety } from './zip-safety.js';
import type { UWCodec } from './codec.js';
import {
  assertUWEnvelope,
  stampEnvelopeDigest,
  verifyEnvelopeDigest,
  type UWDocumentEnvelope,
  type UWEnvelopeBlock,
} from './envelope.js';
import { sha256TextHex } from './integrity.js';

export const UW_CSV_BUNDLE_VERSION = '1.0.0' as const;
export const UW_CSV_BUNDLE_MEDIA_TYPE = 'application/vnd.uwmd.csv-bundle+zip' as const;

const REQUIRED_FILES = [
  'document.csv',
  'frontmatter.csv',
  'blocks.csv',
  'block_values.csv',
  'prose.csv',
] as const;

const MAX_COMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
const MAX_FILES = 100;
const MAX_COMPRESSION_RATIO = 100;
const ZIP_EPOCH = new Date('1980-01-02T00:00:00.000Z');

export interface UWCSVBundle {
  files: Record<string, string>;
}

export interface UWCSVDecodeOptions {
  maxCompressedBytes?: number;
  maxUncompressedBytes?: number;
  maxFiles?: number;
  maxCompressionRatio?: number;
}

interface BundleFileManifest {
  path: string;
  media_type: string;
  sha256: string;
  bytes: number;
  fidelity: 'model' | 'view';
  profile?: string;
}

interface BundleViewManifest {
  path: string;
  profile: string;
  fidelity: 'view';
  source_sections: string[];
  column_schema_version: '1.0.0';
  spreadsheet_safety: 'apostrophe-prefix';
}

interface BundleManifest {
  bundle_version: typeof UW_CSV_BUNDLE_VERSION;
  envelope_version: string;
  format_version: string;
  semantic_digest: string;
  files: BundleFileManifest[];
  views: BundleViewManifest[];
  normalized_value_encoding: 'canonical-json';
  csv_dialect: 'rfc4180';
}

interface FlatValueRow {
  pointer: string;
  json_type: JSONValueType;
  value_json: string;
}

interface EncodedBlock {
  block_ref: string;
  collection: string;
  section: string | null;
  variant: string | null;
  ordinal: number | null;
  state: 'current' | 'superseded';
  block: UWEnvelopeBlock;
}

export type UWJSONValueType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
type JSONValueType = UWJSONValueType;

/**
 * One row of the normative `block_values.csv` fact table (UW CSV Bundle spec
 * §3): one entry per JSON fact in a block, addressed by JSON Pointer, with the
 * scalar value as canonical JSON. `scope` separates block `annotation`, the
 * `_meta` provenance subtree, and the remaining `content`. `block_ref` is the
 * exact JSON Pointer to the block in the envelope — local to the encoding, not
 * a durable business identifier.
 */
export interface UWBlockValueRow {
  block_ref: string;
  scope: 'annotation' | 'meta' | 'content';
  pointer: string;
  json_type: UWJSONValueType;
  value_json: string;
}

export class UWCSVError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'UWCSVError';
    this.code = code;
  }
}

export async function encodeUWCSVBundle(envelope: UWDocumentEnvelope): Promise<UWCSVBundle> {
  const stamped = await stampEnvelopeDigest(envelope);
  const blocks = enumerateBlocks(stamped);
  const extra = Object.fromEntries(
    Object.entries(stamped)
      .filter(([key]) => ![
        'envelope_version',
        'format_version',
        'generated_at',
        'generator',
        'semantic_digest',
        'frontmatter',
        'sections',
        'pipeline_log',
        'custom_calculations',
        'custom_scenarios',
        'extensions',
        'superseded',
      ].includes(key))
      .sort(([left], [right]) => compareCodeUnits(left, right)),
  );

  const files: Record<string, string> = {};
  files['document.csv'] = encodeCSV([
    [
      'envelope_version',
      'format_version',
      'generated_at_json',
      'generator_json',
      'semantic_digest',
      'deal_id_json',
      'deal_name_json',
      'extra_json',
    ],
    [
      stamped.envelope_version,
      stamped.format_version,
      jsonCell(stamped.generated_at ?? null),
      jsonCell(stamped.generator ?? null),
      stamped.semantic_digest ?? '',
      jsonCell(stamped.frontmatter.deal_id ?? null),
      jsonCell(stamped.frontmatter.deal_name ?? null),
      jsonCell(extra),
    ],
  ]);

  files['frontmatter.csv'] = encodeFlatValues(flattenJSON(stamped.frontmatter));
  files['blocks.csv'] = encodeCSV([
    ['block_ref', 'collection', 'section_json', 'variant_json', 'ordinal', 'state'],
    ...blocks.map((entry) => [
      entry.block_ref,
      entry.collection,
      jsonCell(entry.section),
      jsonCell(entry.variant),
      entry.ordinal === null ? '' : String(entry.ordinal),
      entry.state,
    ]),
  ]);

  const blockValueRows: string[][] = [
    ['block_ref', 'scope', 'pointer', 'json_type', 'value_json'],
    ...flattenEnvelopeBlockValues(stamped).map((row) => [
      row.block_ref,
      row.scope,
      row.pointer,
      row.json_type,
      row.value_json,
    ]),
  ];
  const proseRows: string[][] = [['prose_ref', 'scope', 'block_ref', 'prose_json']];
  for (const entry of blocks) {
    if (entry.block.prose !== undefined) {
      proseRows.push([
        `${entry.block_ref}/prose`,
        'block',
        entry.block_ref,
        jsonCell(entry.block.prose),
      ]);
    }
  }
  files['block_values.csv'] = encodeCSV(blockValueRows);
  files['prose.csv'] = encodeCSV(proseRows);

  const views = buildViews(stamped);
  for (const view of views) files[view.path] = view.csv;

  const inventory: BundleFileManifest[] = [];
  for (const path of Object.keys(files).sort()) {
    const view = views.find((item) => item.path === path);
    const text = files[path] ?? '';
    inventory.push({
      path,
      media_type: 'text/csv; charset=utf-8',
      sha256: `sha256:${await sha256TextHex(text)}`,
      bytes: strToU8(text).byteLength,
      fidelity: view ? 'view' : 'model',
      ...(view ? { profile: view.profile } : {}),
    });
  }

  const manifest: BundleManifest = {
    bundle_version: UW_CSV_BUNDLE_VERSION,
    envelope_version: stamped.envelope_version,
    format_version: stamped.format_version,
    semantic_digest: stamped.semantic_digest ?? '',
    files: inventory,
    views: views.map(({ path, profile, sourceSections }) => ({
      path,
      profile,
      fidelity: 'view',
      source_sections: sourceSections,
      column_schema_version: '1.0.0',
      spreadsheet_safety: 'apostrophe-prefix',
    })),
    normalized_value_encoding: 'canonical-json',
    csv_dialect: 'rfc4180',
  };
  files['manifest.json'] = `${JSON.stringify(manifest, null, 2)}\n`;
  return { files };
}

export async function decodeUWCSVBundle(
  bundle: UWCSVBundle,
  options: UWCSVDecodeOptions = {},
): Promise<UWDocumentEnvelope> {
  const entries = Object.entries(bundle.files);
  const maxFiles = options.maxFiles ?? MAX_FILES;
  if (entries.length > maxFiles) {
    throw new UWCSVError('CSV_FILE_LIMIT', `Bundle contains ${entries.length} files; limit is ${maxFiles}.`);
  }
  let totalBytes = 0;
  for (const [path, text] of entries) {
    assertSafeBundlePath(path);
    totalBytes += strToU8(text).byteLength;
  }
  const maxBytes = options.maxUncompressedBytes ?? MAX_UNCOMPRESSED_BYTES;
  if (totalBytes > maxBytes) {
    throw new UWCSVError('CSV_SIZE_LIMIT', `Bundle expands to ${totalBytes} bytes; limit is ${maxBytes}.`);
  }

  const manifestText = bundle.files['manifest.json'];
  if (!manifestText) throw new UWCSVError('CSV_MANIFEST_MISSING', 'manifest.json is required.');
  const manifest = parseManifest(manifestText);
  const listed = new Set<string>();
  for (const file of manifest.files) {
    if (listed.has(file.path)) throw new UWCSVError('CSV_MANIFEST_DUPLICATE', `Manifest repeats ${file.path}.`);
    listed.add(file.path);
    const text = bundle.files[file.path];
    if (text === undefined) throw new UWCSVError('CSV_FILE_MISSING', `${file.path} is listed but missing.`);
    if (strToU8(text).byteLength !== file.bytes) {
      throw new UWCSVError('CSV_SIZE_MISMATCH', `${file.path} byte length does not match manifest.`);
    }
    const digest = `sha256:${await sha256TextHex(text)}`;
    if (digest !== file.sha256) throw new UWCSVError('CSV_HASH_MISMATCH', `${file.path} hash does not match manifest.`);
  }
  for (const path of Object.keys(bundle.files)) {
    if (path !== 'manifest.json' && !listed.has(path)) {
      throw new UWCSVError('CSV_FILE_UNLISTED', `${path} is not listed in manifest.`);
    }
  }
  for (const required of REQUIRED_FILES) {
    if (!listed.has(required)) throw new UWCSVError('CSV_FILE_MISSING', `${required} is required.`);
  }

  const documentRows = decodeCSV(requiredFile(bundle, 'document.csv'));
  assertHeader(documentRows, [
    'envelope_version',
    'format_version',
    'generated_at_json',
    'generator_json',
    'semantic_digest',
    'deal_id_json',
    'deal_name_json',
    'extra_json',
  ], 'document.csv');
  if (documentRows.length !== 2) throw new UWCSVError('CSV_DOCUMENT_ROWS', 'document.csv must contain one data row.');
  const document = documentRows[1] ?? [];
  const extras = parseJSONCell(document[7] ?? '', 'document.csv.extra_json');
  if (!isRecord(extras)) throw new UWCSVError('CSV_DOCUMENT_EXTRA', 'extra_json must be an object.');
  const envelope: Record<string, unknown> = Object.assign(Object.create(null), extras, {
    envelope_version: document[0],
    format_version: document[1],
    generated_at: parseNullableJSONCell(document[2] ?? '', 'document.csv.generated_at_json'),
    generator: parseNullableJSONCell(document[3] ?? '', 'document.csv.generator_json'),
    semantic_digest: document[4],
    frontmatter: decodeFlatValues(requiredFile(bundle, 'frontmatter.csv')),
    sections: Object.create(null),
    pipeline_log: [],
    custom_calculations: [],
    custom_scenarios: [],
    extensions: Object.create(null),
    superseded: Object.create(null),
  });
  if (envelope.generated_at === null) delete envelope.generated_at;
  if (envelope.generator === null) delete envelope.generator;
  const frontmatter = envelope.frontmatter as Record<string, unknown>;
  if (parseNullableJSONCell(document[5] ?? '', 'document.csv.deal_id_json') !== (frontmatter['deal_id'] ?? null)) {
    throw new UWCSVError('CSV_DOCUMENT_IDENTITY', 'document.csv deal_id disagrees with frontmatter.csv.');
  }
  if (parseNullableJSONCell(document[6] ?? '', 'document.csv.deal_name_json') !== (frontmatter['deal_name'] ?? null)) {
    throw new UWCSVError('CSV_DOCUMENT_IDENTITY', 'document.csv deal_name disagrees with frontmatter.csv.');
  }
  if (manifest.envelope_version !== envelope.envelope_version || manifest.format_version !== envelope.format_version) {
    throw new UWCSVError('CSV_MANIFEST_VERSION', 'Manifest versions disagree with document.csv.');
  }

  const blockRows = decodeCSV(requiredFile(bundle, 'blocks.csv'));
  assertHeader(blockRows, ['block_ref', 'collection', 'section_json', 'variant_json', 'ordinal', 'state'], 'blocks.csv');
  const valueRows = decodeCSV(requiredFile(bundle, 'block_values.csv'));
  assertHeader(valueRows, ['block_ref', 'scope', 'pointer', 'json_type', 'value_json'], 'block_values.csv');
  const proseRows = decodeCSV(requiredFile(bundle, 'prose.csv'));
  assertHeader(proseRows, ['prose_ref', 'scope', 'block_ref', 'prose_json'], 'prose.csv');

  const valuesByBlock = new Map<string, Map<string, FlatValueRow[]>>();
  for (const row of valueRows.slice(1)) {
    if (row.length !== 5) throw new UWCSVError('CSV_ROW_WIDTH', 'block_values.csv row width is invalid.');
    const [blockRef = '', scope = '', pointer = '', type = '', valueJson = ''] = row;
    if (!['annotation', 'meta', 'content'].includes(scope)) {
      throw new UWCSVError('CSV_SCOPE_INVALID', `Unknown block value scope ${scope}.`);
    }
    const scopes = valuesByBlock.get(blockRef) ?? new Map<string, FlatValueRow[]>();
    const rows = scopes.get(scope) ?? [];
    rows.push({ pointer, json_type: assertJSONType(type), value_json: valueJson });
    scopes.set(scope, rows);
    valuesByBlock.set(blockRef, scopes);
  }

  const proseByBlock = new Map<string, string>();
  for (const row of proseRows.slice(1)) {
    if (row.length !== 4 || row[1] !== 'block') throw new UWCSVError('CSV_PROSE_ROW', 'prose.csv row is invalid.');
    const blockRef = row[2] ?? '';
    if (row[0] !== `${blockRef}/prose`) throw new UWCSVError('CSV_PROSE_REF', `${row[0]} does not match ${blockRef}.`);
    if (proseByBlock.has(blockRef)) throw new UWCSVError('CSV_PROSE_DUPLICATE', `${blockRef} repeats prose.`);
    const prose = parseJSONCell(row[3] ?? '', 'prose.csv.prose_json');
    if (typeof prose !== 'string') throw new UWCSVError('CSV_PROSE_TYPE', 'prose_json must contain a string.');
    proseByBlock.set(blockRef, prose);
  }

  const seenBlocks = new Set<string>();
  for (const row of blockRows.slice(1)) {
    if (row.length !== 6) throw new UWCSVError('CSV_ROW_WIDTH', 'blocks.csv row width is invalid.');
    const blockRef = row[0] ?? '';
    if (seenBlocks.has(blockRef)) throw new UWCSVError('CSV_BLOCK_DUPLICATE', `Duplicate ${blockRef}.`);
    seenBlocks.add(blockRef);
    validateBlockDescriptor(row);
    const scopes = valuesByBlock.get(blockRef);
    if (!scopes) throw new UWCSVError('CSV_BLOCK_VALUES_MISSING', `${blockRef} has no value rows.`);
    const annotation = buildJSON(scopes.get('annotation') ?? []);
    const meta = buildJSON(scopes.get('meta') ?? []);
    const content = buildJSON(scopes.get('content') ?? []);
    if (!isRecord(annotation) || !isRecord(meta) || !isRecord(content)) {
      throw new UWCSVError('CSV_BLOCK_SHAPE', `${blockRef} scopes must decode as objects.`);
    }
    const block: UWEnvelopeBlock = {
      annotation: annotation as unknown as UWEnvelopeBlock['annotation'],
      content: { ...content, _meta: meta },
      ...(proseByBlock.has(blockRef) ? { prose: proseByBlock.get(blockRef) } : {}),
    };
    assignBlock(envelope, row, block);
  }
  for (const blockRef of valuesByBlock.keys()) {
    if (!seenBlocks.has(blockRef)) throw new UWCSVError('CSV_BLOCK_UNLISTED', `${blockRef} has values but no block row.`);
  }
  for (const blockRef of proseByBlock.keys()) {
    if (!seenBlocks.has(blockRef)) throw new UWCSVError('CSV_BLOCK_UNLISTED', `${blockRef} has prose but no block row.`);
  }

  assertUWEnvelope(envelope);
  const verification = await verifyEnvelopeDigest(envelope);
  if (!verification.actual) throw new UWCSVError('CSV_DIGEST_MISSING', 'semantic_digest is required.');
  if (!verification.valid || manifest.semantic_digest !== verification.actual) {
    throw new UWCSVError('CSV_DIGEST_MISMATCH', 'Reconstructed envelope digest does not match the bundle manifest.');
  }
  return envelope;
}

export async function encodeUWCSVZip(envelope: UWDocumentEnvelope): Promise<Uint8Array> {
  const bundle = await encodeUWCSVBundle(envelope);
  const input: Record<string, [Uint8Array, { level: 6; mtime: Date }]> = {};
  for (const path of Object.keys(bundle.files).sort()) {
    input[path] = [strToU8(bundle.files[path] ?? ''), { level: 6, mtime: ZIP_EPOCH }];
  }
  return zipSync(input);
}

export async function decodeUWCSVZip(
  input: Uint8Array,
  options: UWCSVDecodeOptions = {},
): Promise<UWDocumentEnvelope> {
  inspectZip(input, options);
  let inflated: Record<string, Uint8Array>;
  try {
    inflated = unzipSync(input);
  } catch (error) {
    throw new UWCSVError('CSV_ZIP_INVALID', `Could not extract ZIP: ${String(error)}`);
  }
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const files: Record<string, string> = {};
  try {
    for (const path of Object.keys(inflated).sort()) {
      assertSafeBundlePath(path);
      files[path] = decoder.decode(inflated[path]);
    }
  } catch (error) {
    if (error instanceof UWCSVError) throw error;
    throw new UWCSVError('CSV_UTF8_INVALID', `Bundle files must be UTF-8: ${String(error)}`);
  }
  return decodeUWCSVBundle({ files }, options);
}

export const UW_CSV_BUNDLE_CODEC: UWCodec<Uint8Array> = {
  descriptor: {
    id: 'uw-csv-bundle',
    media_types: [UW_CSV_BUNDLE_MEDIA_TYPE],
    file_extensions: ['.uw.csv.zip'],
    directions: ['read', 'write'],
    fidelity: 'model',
    representation_version: UW_CSV_BUNDLE_VERSION,
    max_bytes: MAX_COMPRESSED_BYTES,
  },
  encode: encodeUWCSVZip,
  decode: decodeUWCSVZip,
};

function enumerateBlocks(envelope: UWDocumentEnvelope): EncodedBlock[] {
  const output: EncodedBlock[] = [];
  for (const section of Object.keys(envelope.sections).sort()) {
    const entry = envelope.sections[section];
    if (isEnvelopeBlock(entry)) {
      output.push({ block_ref: `/sections/${pointerEscape(section)}`, collection: 'sections', section, variant: null, ordinal: null, state: 'current', block: entry });
    } else {
      for (const variant of Object.keys(entry ?? {}).sort()) {
        const block = entry?.[variant];
        if (!isEnvelopeBlock(block)) throw new UWCSVError('CSV_BLOCK_SHAPE', `sections.${section}.${variant} is not a block.`);
        output.push({ block_ref: `/sections/${pointerEscape(section)}/${pointerEscape(variant)}`, collection: 'sections', section, variant, ordinal: null, state: 'current', block });
      }
    }
  }
  for (const collection of ['pipeline_log', 'custom_calculations', 'custom_scenarios'] as const) {
    envelope[collection].forEach((block, ordinal) => output.push({ block_ref: `/${collection}/${ordinal}`, collection, section: null, variant: null, ordinal, state: 'current', block }));
  }
  for (const id of Object.keys(envelope.extensions).sort()) {
    output.push({ block_ref: `/extensions/${pointerEscape(id)}`, collection: 'extensions', section: id, variant: null, ordinal: null, state: 'current', block: envelope.extensions[id] });
  }
  for (const section of Object.keys(envelope.superseded).sort()) {
    envelope.superseded[section]?.forEach((block, ordinal) => output.push({ block_ref: `/superseded/${pointerEscape(section)}/${ordinal}`, collection: 'superseded', section, variant: null, ordinal, state: 'superseded', block }));
  }
  return output;
}

/**
 * Flattens every block of an envelope into the normative `block_values` rows
 * (UW CSV Bundle spec §3) — the same rows `encodeUWCSVBundle` writes to
 * `block_values.csv`, exposed as data so hosts (e.g. `@uwmd/batch`) can build
 * corpus-level fact tables without re-implementing the flattening. Row order
 * is deterministic: envelope block order, then annotation → meta → content,
 * then sorted-key JSON Pointer order within each scope.
 */
export function flattenEnvelopeBlockValues(envelope: UWDocumentEnvelope): UWBlockValueRow[] {
  const rows: UWBlockValueRow[] = [];
  for (const entry of enumerateBlocks(envelope)) {
    const content = { ...entry.block.content };
    const meta = isRecord(content['_meta']) ? content['_meta'] : {};
    delete content['_meta'];
    for (const [scope, value] of [
      ['annotation', entry.block.annotation],
      ['meta', meta],
      ['content', content],
    ] as const) {
      for (const row of flattenJSON(value)) {
        rows.push({
          block_ref: entry.block_ref,
          scope,
          pointer: row.pointer,
          json_type: row.json_type,
          value_json: row.value_json,
        });
      }
    }
  }
  return rows;
}

function flattenJSON(value: unknown, pointer = ''): FlatValueRow[] {
  const type = jsonType(value);
  const row: FlatValueRow = {
    pointer,
    json_type: type,
    value_json: type === 'object' || type === 'array' ? '' : jsonCell(value),
  };
  if (Array.isArray(value)) {
    return [row, ...value.flatMap((item, index) => flattenJSON(item, `${pointer}/${index}`))];
  }
  if (isRecord(value)) {
    return [row, ...Object.keys(value).sort().flatMap((key) => flattenJSON(value[key], `${pointer}/${pointerEscape(key)}`))];
  }
  return [row];
}

function encodeFlatValues(rows: FlatValueRow[]): string {
  return encodeCSV([
    ['pointer', 'json_type', 'value_json'],
    ...rows.map((row) => [row.pointer, row.json_type, row.value_json]),
  ]);
}

function decodeFlatValues(text: string): unknown {
  const rows = decodeCSV(text);
  assertHeader(rows, ['pointer', 'json_type', 'value_json'], 'flat value table');
  return buildJSON(rows.slice(1).map((row) => {
    if (row.length !== 3) throw new UWCSVError('CSV_ROW_WIDTH', 'Flat value row width is invalid.');
    return { pointer: row[0] ?? '', json_type: assertJSONType(row[1] ?? ''), value_json: row[2] ?? '' };
  }));
}

function buildJSON(rows: FlatValueRow[]): unknown {
  const sorted = [...rows].sort((left, right) => comparePointers(left.pointer, right.pointer));
  if (sorted.length === 0 || sorted[0]?.pointer !== '') throw new UWCSVError('CSV_ROOT_MISSING', 'Flat values require a root row.');
  const seen = new Set<string>();
  let root: unknown;
  for (const row of sorted) {
    if (seen.has(row.pointer)) throw new UWCSVError('CSV_POINTER_DUPLICATE', `Duplicate pointer ${row.pointer}.`);
    seen.add(row.pointer);
    const value = row.json_type === 'object' ? Object.create(null) : row.json_type === 'array' ? [] : parseJSONCell(row.value_json, row.pointer || '/');
    if (jsonType(value) !== row.json_type) throw new UWCSVError('CSV_TYPE_MISMATCH', `${row.pointer} type does not match value_json.`);
    if (row.pointer === '') root = value;
    else setJSONPointer(root, row.pointer, value);
  }
  return root;
}

function encodeCSV(rows: string[][]): string {
  return `${rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\r\n')}\r\n`;
}

function decodeCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let index = 0;
  let quoted = false;
  while (index < text.length) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { cell += '"'; index += 2; continue; }
        quoted = false; index++; continue;
      }
      cell += char; index++; continue;
    }
    if (char === '"' && cell.length === 0) { quoted = true; index++; continue; }
    if (char === ',') { row.push(cell); cell = ''; index++; continue; }
    if (char === '\r' && text[index + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; index += 2; continue; }
    if (char === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; index++; continue; }
    cell += char; index++;
  }
  if (quoted) throw new UWCSVError('CSV_QUOTE_INVALID', 'CSV ends inside a quoted field.');
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

function buildViews(envelope: UWDocumentEnvelope): Array<{ path: string; profile: string; sourceSections: string[]; csv: string }> {
  const views: Array<{ path: string; profile: string; sourceSections: string[]; csv: string }> = [];
  views.push({ path: 'views/deal_summary.csv', profile: 'deal_summary', sourceSections: ['frontmatter'], csv: encodeWideRows([flattenViewObject(envelope.frontmatter)]) });
  for (const [profile, section, preferredArray] of [
    ['rent_roll', 'rent_roll', 'units'],
    ['operating_statement', 'noi_model', null],
    ['debt', 'debt_structure', null],
    ['valuation', 'valuation', null],
    ['sources_uses', 'sources_uses', null],
  ] as const) {
    const block = currentSectionBlock(envelope, section);
    if (!block) continue;
    const content = Object.fromEntries(Object.entries(block.content).filter(([key]) => key !== '_meta'));
    let rows: Record<string, unknown>[];
    const list = preferredArray ? content[preferredArray] : null;
    if (Array.isArray(list) && list.length > 0) {
      rows = list.map((item, rowIndex) => ({ row_index: rowIndex, ...flattenViewObject(item) }));
    } else {
      rows = [flattenViewObject(content)];
    }
    views.push({ path: `views/${profile}.csv`, profile, sourceSections: [section], csv: encodeWideRows(rows) });
  }
  return views;
}

function encodeWideRows(rows: Record<string, unknown>[]): string {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))].sort();
  return encodeCSV([
    headers,
    ...rows.map((row) => headers.map((header) => safeViewCell(displayCell(row[header])))),
  ]);
}

function flattenViewObject(value: unknown, prefix = '', output: Record<string, unknown> = {}): Record<string, unknown> {
  if (isRecord(value)) {
    for (const key of Object.keys(value).sort()) {
      const path = prefix ? `${prefix}.${key}` : key;
      const child = value[key];
      if (isRecord(child)) flattenViewObject(child, path, output);
      else output[path] = child;
    }
  } else if (prefix) output[prefix] = value;
  return output;
}

function safeViewCell(value: string): string {
  return /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

function displayCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function currentSectionBlock(envelope: UWDocumentEnvelope, section: string): UWEnvelopeBlock | null {
  const entry = envelope.sections[section];
  if (isEnvelopeBlock(entry)) return entry;
  if (isRecord(entry)) return Object.values(entry).find(isEnvelopeBlock) ?? null;
  return null;
}

// Delegates to the shared inspector so the Deal Package cannot drift into a
// second, subtly different set of archive rules. Every semantic violation maps
// to `CSV_` + its name, which reproduces the previous codes exactly.
function inspectZip(input: Uint8Array, options: UWCSVDecodeOptions): void {
  inspectZipSafety(
    input,
    {
      maxCompressedBytes: options.maxCompressedBytes ?? MAX_COMPRESSED_BYTES,
      maxFiles: options.maxFiles ?? MAX_FILES,
      maxUncompressedBytes: options.maxUncompressedBytes ?? MAX_UNCOMPRESSED_BYTES,
      maxCompressionRatio: options.maxCompressionRatio ?? MAX_COMPRESSION_RATIO,
    },
    (violation, message) => { throw new UWCSVError(`CSV_${violation}`, message); },
  );
}

function parseManifest(text: string): BundleManifest {
  let value: unknown;
  try { value = JSON.parse(text); } catch (error) { throw new UWCSVError('CSV_MANIFEST_INVALID', `manifest.json is invalid: ${String(error)}`); }
  if (!isRecord(value) || value['bundle_version'] !== UW_CSV_BUNDLE_VERSION || !Array.isArray(value['files']) || !Array.isArray(value['views']) || typeof value['semantic_digest'] !== 'string') {
    throw new UWCSVError('CSV_MANIFEST_INVALID', 'manifest.json has an unsupported shape or version.');
  }
  for (const file of value['files']) {
    if (
      !isRecord(file) ||
      typeof file['path'] !== 'string' ||
      typeof file['sha256'] !== 'string' ||
      !/^sha256:[0-9a-f]{64}$/.test(file['sha256']) ||
      typeof file['bytes'] !== 'number' ||
      !Number.isSafeInteger(file['bytes']) ||
      file['bytes'] < 0 ||
      (file['fidelity'] !== 'model' && file['fidelity'] !== 'view')
    ) {
      throw new UWCSVError('CSV_MANIFEST_INVALID', 'Manifest file entry is invalid.');
    }
    assertSafeBundlePath(file['path']);
  }
  if (value['normalized_value_encoding'] !== 'canonical-json' || value['csv_dialect'] !== 'rfc4180') {
    throw new UWCSVError('CSV_MANIFEST_INVALID', 'Manifest encoding or CSV dialect is unsupported.');
  }
  return value as unknown as BundleManifest;
}

function requiredFile(bundle: UWCSVBundle, path: string): string {
  const text = bundle.files[path];
  if (text === undefined) throw new UWCSVError('CSV_FILE_MISSING', `${path} is required.`);
  return text;
}

function validateBlockDescriptor(row: string[]): void {
  const [blockRef = '', collection = '', sectionJson = '', variantJson = '', ordinal = '', state = ''] = row;
  if (!blockRef.startsWith('/') || !['sections', 'pipeline_log', 'custom_calculations', 'custom_scenarios', 'extensions', 'superseded'].includes(collection)) throw new UWCSVError('CSV_BLOCK_DESCRIPTOR', `${blockRef} has an invalid collection.`);
  parseNullableJSONCell(sectionJson, `${blockRef}.section`);
  parseNullableJSONCell(variantJson, `${blockRef}.variant`);
  if (ordinal !== '' && !/^\d+$/.test(ordinal)) throw new UWCSVError('CSV_BLOCK_DESCRIPTOR', `${blockRef} ordinal is invalid.`);
  if (state !== 'current' && state !== 'superseded') throw new UWCSVError('CSV_BLOCK_DESCRIPTOR', `${blockRef} state is invalid.`);
}

function assignBlock(envelope: Record<string, unknown>, row: string[], block: UWEnvelopeBlock): void {
  const [blockRef = '', collection = '', sectionJson = '', variantJson = '', ordinalText = '', state = ''] = row;
  const section = parseNullableJSONCell(sectionJson, `${blockRef}.section`);
  const variant = parseNullableJSONCell(variantJson, `${blockRef}.variant`);
  if (section !== null && typeof section !== 'string') throw new UWCSVError('CSV_BLOCK_DESCRIPTOR', `${blockRef} section is invalid.`);
  if (variant !== null && typeof variant !== 'string') throw new UWCSVError('CSV_BLOCK_DESCRIPTOR', `${blockRef} variant is invalid.`);
  const ordinal = ordinalText === '' ? null : Number(ordinalText);
  let expected: string;
  if (collection === 'sections') {
    if (typeof section !== 'string' || ordinal !== null || state !== 'current') throw new UWCSVError('CSV_BLOCK_DESCRIPTOR', `${blockRef} section descriptor is invalid.`);
    const sections = envelope['sections'] as Record<string, unknown>;
    if (variant === null) {
      expected = `/sections/${pointerEscape(section)}`;
      if (section in sections) throw new UWCSVError('CSV_BLOCK_DUPLICATE', `${expected} already exists.`);
      sections[section] = block;
    } else {
      expected = `/sections/${pointerEscape(section)}/${pointerEscape(variant)}`;
      const variants = sections[section] ?? Object.create(null);
      if (!isRecord(variants) || isEnvelopeBlock(variants)) throw new UWCSVError('CSV_BLOCK_DESCRIPTOR', `${expected} conflicts with a section block.`);
      if (variant in variants) throw new UWCSVError('CSV_BLOCK_DUPLICATE', `${expected} already exists.`);
      variants[variant] = block;
      sections[section] = variants;
    }
  } else if (collection === 'extensions') {
    if (typeof section !== 'string' || variant !== null || ordinal !== null || state !== 'current') throw new UWCSVError('CSV_BLOCK_DESCRIPTOR', `${blockRef} extension descriptor is invalid.`);
    expected = `/extensions/${pointerEscape(section)}`;
    const extensions = envelope['extensions'] as Record<string, unknown>;
    if (section in extensions) throw new UWCSVError('CSV_BLOCK_DUPLICATE', `${expected} already exists.`);
    extensions[section] = block;
  } else if (collection === 'superseded') {
    if (typeof section !== 'string' || variant !== null || ordinal === null || state !== 'superseded') throw new UWCSVError('CSV_BLOCK_DESCRIPTOR', `${blockRef} superseded descriptor is invalid.`);
    expected = `/superseded/${pointerEscape(section)}/${ordinal}`;
    const superseded = envelope['superseded'] as Record<string, UWEnvelopeBlock[]>;
    const list = superseded[section] ?? [];
    if (ordinal !== list.length) throw new UWCSVError('CSV_BLOCK_DESCRIPTOR', `${expected} ordinal is out of order.`);
    list.push(block);
    superseded[section] = list;
  } else {
    if (!['pipeline_log', 'custom_calculations', 'custom_scenarios'].includes(collection) || section !== null || variant !== null || ordinal === null || state !== 'current') throw new UWCSVError('CSV_BLOCK_DESCRIPTOR', `${blockRef} collection descriptor is invalid.`);
    expected = `/${collection}/${ordinal}`;
    const list = envelope[collection] as UWEnvelopeBlock[];
    if (ordinal !== list.length) throw new UWCSVError('CSV_BLOCK_DESCRIPTOR', `${expected} ordinal is out of order.`);
    list.push(block);
  }
  if (blockRef !== expected) throw new UWCSVError('CSV_BLOCK_REF_MISMATCH', `${blockRef} should be ${expected}.`);
}

function assertHeader(rows: string[][], expected: string[], file: string): void {
  if (!rows[0] || rows[0].length !== expected.length || rows[0].some((cell, index) => cell !== expected[index])) throw new UWCSVError('CSV_HEADER_INVALID', `${file} header is invalid.`);
}

function assertSafeBundlePath(path: string): void {
  if (!path || path.includes('\\') || path.includes('\0') || path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.split('/').some((part) => part === '' || part === '.' || part === '..')) throw new UWCSVError('CSV_PATH_UNSAFE', `Unsafe bundle path ${JSON.stringify(path)}.`);
}

function setJSONPointer(root: unknown, pointer: string, value: unknown): void {
  if (!pointer.startsWith('/') || pointer === '/') throw new UWCSVError('CSV_POINTER_INVALID', `Invalid JSON Pointer ${pointer}.`);
  const parts = pointer.slice(1).split('/').map(pointerUnescape);
  let current = root;
  for (let index = 0; index < parts.length - 1; index++) {
    const part = parts[index] ?? '';
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(part)) throw new UWCSVError('CSV_POINTER_INVALID', `${pointer} has a non-numeric array index.`);
      const position = Number(part);
      if (current[position] === undefined) throw new UWCSVError('CSV_POINTER_PARENT_MISSING', `${pointer} parent is missing.`);
      current = current[position];
    } else if (isRecord(current)) {
      if (!(part in current)) throw new UWCSVError('CSV_POINTER_PARENT_MISSING', `${pointer} parent is missing.`);
      current = current[part];
    } else throw new UWCSVError('CSV_POINTER_PARENT_INVALID', `${pointer} parent is not a container.`);
  }
  const leaf = parts.at(-1) ?? '';
  if (Array.isArray(current)) {
    if (!/^\d+$/.test(leaf)) throw new UWCSVError('CSV_POINTER_INVALID', `${pointer} has a non-numeric array index.`);
    const position = Number(leaf);
    if (position !== current.length) throw new UWCSVError('CSV_POINTER_ORDER', `${pointer} array rows are out of order.`);
    current.push(value);
  } else if (isRecord(current)) {
    if (leaf in current) throw new UWCSVError('CSV_POINTER_DUPLICATE', `${pointer} already exists.`);
    current[leaf] = value;
  } else throw new UWCSVError('CSV_POINTER_PARENT_INVALID', `${pointer} parent is not a container.`);
}

function pointerEscape(value: string): string { return value.replaceAll('~', '~0').replaceAll('/', '~1'); }
function pointerUnescape(value: string): string {
  if (/~(?![01])/.test(value)) throw new UWCSVError('CSV_POINTER_INVALID', `Invalid JSON Pointer token ${value}.`);
  return value.replaceAll('~1', '/').replaceAll('~0', '~');
}
function pointerDepth(pointer: string): number { return pointer === '' ? 0 : pointer.split('/').length - 1; }
function comparePointers(left: string, right: string): number {
  const depth = pointerDepth(left) - pointerDepth(right);
  if (depth !== 0) return depth;
  const leftParts = left.split('/').slice(1).map(pointerUnescape);
  const rightParts = right.split('/').slice(1).map(pointerUnescape);
  for (let index = 0; index < leftParts.length; index++) {
    const leftPart = leftParts[index] ?? '';
    const rightPart = rightParts[index] ?? '';
    if (leftPart === rightPart) continue;
    if (/^\d+$/.test(leftPart) && /^\d+$/.test(rightPart)) return Number(leftPart) - Number(rightPart);
    return compareCodeUnits(leftPart, rightPart);
  }
  return 0;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function jsonCell(value: unknown): string {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new UWCSVError('CSV_VALUE_UNSUPPORTED', 'undefined is not a JSON value.');
  return encoded;
}
function parseJSONCell(value: string, pointer: string): unknown {
  try { return JSON.parse(value); } catch (error) { throw new UWCSVError('CSV_JSON_INVALID', `${pointer} contains invalid JSON: ${String(error)}`); }
}
function parseNullableJSONCell(value: string, pointer: string): unknown {
  const parsed = parseJSONCell(value, pointer);
  if (parsed !== null && typeof parsed !== 'string') throw new UWCSVError('CSV_JSON_TYPE', `${pointer} must contain a string or null.`);
  return parsed;
}
function jsonType(value: unknown): JSONValueType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (isRecord(value)) return 'object';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new UWCSVError('CSV_NUMBER_INVALID', 'Non-finite numbers are not JSON values.');
    return 'number';
  }
  if (typeof value === 'boolean') return 'boolean';
  throw new UWCSVError('CSV_VALUE_UNSUPPORTED', `${typeof value} is not a JSON value.`);
}
function assertJSONType(value: string): JSONValueType {
  if (['object', 'array', 'string', 'number', 'boolean', 'null'].includes(value)) return value as JSONValueType;
  throw new UWCSVError('CSV_TYPE_INVALID', `Unsupported JSON type ${value}.`);
}
function isEnvelopeBlock(value: unknown): value is UWEnvelopeBlock { return isRecord(value) && isRecord(value['annotation']) && isRecord(value['content']); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
