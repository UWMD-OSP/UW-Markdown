import type { UWDocumentEnvelope, UWEnvelopeBlock } from './envelope.js';
import { hasBlockShape } from './block-kind.js';
const writeCSV = (rows: string[][]) => `${rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')}\r\n`;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isEnvelopeBlock = (value: unknown): value is UWEnvelopeBlock => hasBlockShape(value);
export function buildViews(envelope: UWDocumentEnvelope): Array<{ path: string; profile: string; sourceSections: string[]; csv: string }> {
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
  return writeCSV([
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

