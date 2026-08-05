import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { computeEnvelopeDigest, parseUWFile, toUWEnvelope, validateUWFile } from '@uwmd/core';

export const UWMD_BATCH_INDEX_VERSION = '0.1' as const;

export interface BatchDealIndexEntry {
  path: string;
  deal_id: string | null;
  deal_name: string | null;
  asset_class: string | null;
  deal_stage: string | null;
  semantic_digest: string | null;
  valid: boolean;
  error_count: number;
  warning_count: number;
  error?: string;
}

export interface UWMDCollectionIndex {
  index_version: typeof UWMD_BATCH_INDEX_VERSION;
  files_scanned: number;
  valid_deals: number;
  invalid_deals: number;
  deals: BatchDealIndexEntry[];
}

export class BatchError extends Error {
  constructor(readonly code: string, message: string) { super(`[${code}] ${message}`); this.name = 'BatchError'; }
}

export async function indexUWMDDirectory(inputDirectory: string): Promise<UWMDCollectionIndex> {
  const root = resolve(inputDirectory);
  const files = (await discoverUWMD(root)).sort();
  const deals = await Promise.all(files.map((file) => indexFile(root, file)));
  const validDeals = deals.filter((deal) => deal.valid).length;
  return { index_version: UWMD_BATCH_INDEX_VERSION, files_scanned: deals.length, valid_deals: validDeals, invalid_deals: deals.length - validDeals, deals };
}

export async function writeUWMDCollectionIndex(index: UWMDCollectionIndex, outputDirectory: string): Promise<{ json: string; csv: string }> {
  await mkdir(outputDirectory, { recursive: true });
  const json = resolve(outputDirectory, 'uwmd-collection.json');
  const csv = resolve(outputDirectory, 'uwmd-collection.csv');
  await writeFile(json, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  const columns: Array<keyof BatchDealIndexEntry> = ['path', 'deal_id', 'deal_name', 'asset_class', 'deal_stage', 'semantic_digest', 'valid', 'error_count', 'warning_count', 'error'];
  const rows = [columns.join(','), ...index.deals.map((deal) => columns.map((column) => csvCell(deal[column])).join(','))];
  await writeFile(csv, `${rows.join('\n')}\n`, 'utf8');
  return { json, csv };
}

async function discoverUWMD(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const found = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return discoverUWMD(path);
    return entry.isFile() && entry.name.endsWith('.uw.md') ? [path] : [];
  }));
  return found.flat();
}

async function indexFile(root: string, file: string): Promise<BatchDealIndexEntry> {
  const path = relative(root, file).split(sep).join('/');
  try {
    const parsed = parseUWFile(await readFile(file, 'utf8'));
    if (!hasUWEnvelope(parsed.frontmatter)) {
      throw new BatchError('MISSING_UW_ENVELOPE', 'File does not contain the required UW Markdown frontmatter envelope.');
    }
    const validation = validateUWFile(parsed);
    const digest = await computeEnvelopeDigest(toUWEnvelope(parsed));
    const frontmatter = parsed.frontmatter as Record<string, unknown>;
    const count = (severity: 'error' | 'warning') => validation.issues.filter((issue) => issue.severity === severity).length;
    return { path, deal_id: stringOrNull(frontmatter.deal_id), deal_name: stringOrNull(frontmatter.deal_name), asset_class: stringOrNull(frontmatter.asset_class), deal_stage: stringOrNull(frontmatter.deal_stage), semantic_digest: digest, valid: count('error') === 0, error_count: count('error'), warning_count: count('warning') };
  } catch (error) {
    return { path, deal_id: null, deal_name: null, asset_class: null, deal_stage: null, semantic_digest: null, valid: false, error_count: 1, warning_count: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

function stringOrNull(value: unknown): string | null { return typeof value === 'string' ? value : null; }
function hasUWEnvelope(frontmatter: Record<string, unknown>): boolean {
  return ['uw_version', 'deal_id', 'deal_name', 'created', 'last_modified', 'property_address', 'city', 'state', 'zip', 'asset_class']
    .every((field) => typeof frontmatter[field] === 'string' && frontmatter[field].length > 0);
}
function csvCell(value: unknown): string { const text = value == null ? '' : String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }