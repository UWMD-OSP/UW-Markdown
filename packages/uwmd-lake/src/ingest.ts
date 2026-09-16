/**
 * Readers that turn the three shapes an adopter already has into lake inputs.
 *
 *   - a canonical envelope (what `decodeUWCSVBundle` hands back, and what the
 *     parser produces directly) — `lakeInputFromEnvelope`;
 *   - `block_values.csv` from a UW CSV bundle — `readBlockValuesCSV`;
 *   - `uwmd-facts.jsonl` from `@uwmd/batch` — `readBatchFactJSONL`.
 *
 * None of these reinterpret a UWMD document. They re-key rows the standard has
 * already produced so the warehouse can join them, which is the whole point of
 * RFC 0049: the lake consumes canonical output, it does not become a second
 * definition of what a deal says.
 */

import { computeEnvelopeDigest, flattenEnvelopeBlockValues, type UWDocumentEnvelope } from '@uwmd/core';
import type { LakeDocumentInput, LakeFactInput } from './plan.js';
import { LakeError } from './schema.js';

/** The columns `block_values.csv` is required to carry (UW CSV Bundle §3). */
const BLOCK_VALUE_COLUMNS = ['block_ref', 'scope', 'pointer', 'json_type', 'value_json'] as const;

const SCOPES = new Set(['annotation', 'meta', 'content']);
const JSON_TYPES = new Set(['object', 'array', 'string', 'number', 'boolean', 'null']);

/** Identity columns that every fact row from a single document shares. */
export interface LakeDocumentIdentity {
  semantic_digest: string;
  deal_id?: string | null;
  asset_class?: string | null;
  path?: string | null;
  valid?: boolean | null;
}

/**
 * Projects one envelope into its document row and its complete fact table.
 *
 * The semantic digest is recomputed here rather than trusted from a caller's
 * metadata, because the digest is the lake's primary key and a stale one would
 * silently overwrite a different document's row.
 */
export async function lakeInputFromEnvelope(
  envelope: UWDocumentEnvelope,
  extras: Omit<LakeDocumentInput, 'semantic_digest' | 'envelope'> = {},
): Promise<{ document: LakeDocumentInput; facts: LakeFactInput[] }> {
  const semantic_digest = await computeEnvelopeDigest(envelope);
  const document: LakeDocumentInput = { ...extras, semantic_digest, envelope };
  const facts = flattenEnvelopeBlockValues(envelope).map((row) => ({
    ...row,
    semantic_digest,
    deal_id: extras.deal_id ?? null,
    asset_class: extras.asset_class ?? null,
    path: extras.path ?? null,
    valid: extras.valid ?? null,
  }));
  return { document, facts };
}

/**
 * Reads `block_values.csv` into fact rows, stamped with the document identity
 * the CSV itself does not carry.
 *
 * Extra columns are ignored rather than rejected: a future bundle revision that
 * adds a column must still load, and the raw value stays addressable through
 * the envelope row.
 */
export function readBlockValuesCSV(csv: string, identity: LakeDocumentIdentity): LakeFactInput[] {
  const rows = parseCSV(csv);
  if (rows.length === 0) return [];
  const header = rows[0];
  const index = new Map(header.map((name, position) => [name, position]));
  for (const column of BLOCK_VALUE_COLUMNS) {
    if (!index.has(column)) {
      throw new LakeError('LAKE_CSV_COLUMNS', `block_values.csv is missing the required "${column}" column.`);
    }
  }
  const facts: LakeFactInput[] = [];
  for (let line = 1; line < rows.length; line += 1) {
    const cells = rows[line];
    if (cells.length === 1 && cells[0] === '') continue;
    const cell = (column: string) => cells[index.get(column) as number] ?? '';
    const scope = cell('scope');
    const json_type = cell('json_type');
    if (!SCOPES.has(scope)) {
      throw new LakeError('LAKE_CSV_SCOPE', `block_values.csv row ${line} has scope "${scope}", which is not annotation, meta, or content.`);
    }
    if (!JSON_TYPES.has(json_type)) {
      throw new LakeError('LAKE_CSV_JSON_TYPE', `block_values.csv row ${line} has json_type "${json_type}", which is not a JSON value type.`);
    }
    facts.push({
      ...identity,
      block_ref: cell('block_ref'),
      scope: scope as LakeFactInput['scope'],
      pointer: cell('pointer'),
      json_type: json_type as LakeFactInput['json_type'],
      value_json: cell('value_json'),
    });
  }
  return facts;
}

/**
 * Reads `@uwmd/batch`'s `uwmd-facts.jsonl`. Each line already carries its own
 * `semantic_digest`, so no identity argument is needed — and a line that does
 * not is refused rather than loaded under a guessed key.
 */
export function readBatchFactJSONL(jsonl: string): LakeFactInput[] {
  const facts: LakeFactInput[] = [];
  const lines = jsonl.split('\n');
  for (let line = 0; line < lines.length; line += 1) {
    const raw = lines[line].trim();
    if (raw === '') continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new LakeError('LAKE_JSONL_PARSE', `uwmd-facts.jsonl line ${line + 1} is not valid JSON.`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new LakeError('LAKE_JSONL_SHAPE', `uwmd-facts.jsonl line ${line + 1} is not a JSON object.`);
    }
    const row = parsed as Record<string, unknown>;
    for (const field of ['semantic_digest', 'block_ref', 'scope', 'pointer', 'json_type', 'value_json'] as const) {
      if (typeof row[field] !== 'string') {
        throw new LakeError('LAKE_JSONL_FIELD', `uwmd-facts.jsonl line ${line + 1} is missing the "${field}" string field.`);
      }
    }
    facts.push(row as unknown as LakeFactInput);
  }
  return facts;
}

/** Minimal RFC 4180 reader — the dialect the UW CSV bundle declares. */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/\r\n/g, '\n');
  for (let position = 0; position < source.length; position += 1) {
    const character = source[position];
    if (quoted) {
      if (character === '"') {
        if (source[position + 1] === '"') {
          cell += '"';
          position += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += character;
  }
  if (quoted) throw new LakeError('LAKE_CSV_QUOTE', 'block_values.csv ends inside an unterminated quoted field.');
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
