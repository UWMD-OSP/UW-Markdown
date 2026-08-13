import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { computeEnvelopeDigest, parseUWFile, toUWEnvelope, validateUWFile } from '@uwmd/core';

export const UWMD_BATCH_INDEX_VERSION = '0.2' as const;

export type MetricComparison = 'gt' | 'gte' | 'lt' | 'lte' | 'eq';

export interface BatchMetricFilter {
  metric: string;
  comparison: MetricComparison;
  value: number;
}

export interface BatchDealFilters {
  asset_class?: string | readonly string[];
  deal_stage?: string | readonly string[];
  flag?: string;
  metric?: BatchMetricFilter;
}

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
  flags: string[];
  blocking_flags: string[];
  quick_metrics: Record<string, number>;
  error?: string;
}

export interface UWMDCollectionIndex {
  index_version: typeof UWMD_BATCH_INDEX_VERSION;
  files_scanned: number;
  valid_deals: number;
  invalid_deals: number;
  deals: BatchDealIndexEntry[];
}

export interface BatchGroupSummary {
  key: string;
  deals: number;
  valid_deals: number;
  error_count: number;
  warning_count: number;
}

export interface BatchFlagSummary {
  flag: string;
  deals: number;
  blocking: boolean;
}

export interface UWMDCollectionSummary {
  deals: number;
  valid_deals: number;
  invalid_deals: number;
  error_count: number;
  warning_count: number;
  by_asset_class: BatchGroupSummary[];
  by_deal_stage: BatchGroupSummary[];
  flags: BatchFlagSummary[];
}

export interface UnderwritingQueueProjection {
  ordering: 'blocking_flags desc, error_count desc, warning_count desc, path asc';
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
  const columns: Array<keyof BatchDealIndexEntry> = ['path', 'deal_id', 'deal_name', 'asset_class', 'deal_stage', 'semantic_digest', 'valid', 'error_count', 'warning_count', 'flags', 'blocking_flags', 'quick_metrics', 'error'];
  const rows = [columns.join(','), ...index.deals.map((deal) => columns.map((column) => csvCell(deal[column])).join(','))];
  await writeFile(csv, `${rows.join('\n')}\n`, 'utf8');
  return { json, csv };
}

/** Returns a deterministic read-only subset of a collection index. */
export function filterUWMDCollection(
  index: UWMDCollectionIndex,
  filters: BatchDealFilters = {},
): BatchDealIndexEntry[] {
  const assetClasses = normaliseFilter(filters.asset_class);
  const dealStages = normaliseFilter(filters.deal_stage);
  return index.deals.filter((deal) => {
    if (assetClasses && (!deal.asset_class || !assetClasses.has(deal.asset_class))) return false;
    if (dealStages && (!deal.deal_stage || !dealStages.has(deal.deal_stage))) return false;
    if (filters.flag && !deal.flags.includes(filters.flag) && !deal.blocking_flags.includes(filters.flag)) return false;
    return !filters.metric || matchesMetric(deal.quick_metrics[filters.metric.metric], filters.metric);
  });
}

/** Summarises a collection index without changing the canonical source files. */
export function summarizeUWMDCollection(index: UWMDCollectionIndex): UWMDCollectionSummary {
  const validDeals = index.deals.filter((deal) => deal.valid).length;
  return {
    deals: index.deals.length,
    valid_deals: validDeals,
    invalid_deals: index.deals.length - validDeals,
    error_count: index.deals.reduce((total, deal) => total + deal.error_count, 0),
    warning_count: index.deals.reduce((total, deal) => total + deal.warning_count, 0),
    by_asset_class: summarizeBy(index.deals, (deal) => deal.asset_class ?? '(unknown)'),
    by_deal_stage: summarizeBy(index.deals, (deal) => deal.deal_stage ?? '(unknown)'),
    flags: summarizeFlags(index.deals),
  };
}

/**
 * Produces the underwriting queue in a stated, stable order. Invalid files are
 * retained: they sort with the highest error count instead of disappearing.
 */
export function projectUnderwritingQueue(
  index: UWMDCollectionIndex,
  filters: BatchDealFilters = {},
): UnderwritingQueueProjection {
  const deals = [...filterUWMDCollection(index, filters)].sort((left, right) =>
    right.blocking_flags.length - left.blocking_flags.length
    || right.error_count - left.error_count
    || right.warning_count - left.warning_count
    || left.path.localeCompare(right.path),
  );
  return {
    ordering: 'blocking_flags desc, error_count desc, warning_count desc, path asc',
    deals,
  };
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
    return {
      path,
      deal_id: stringOrNull(frontmatter.deal_id),
      deal_name: stringOrNull(frontmatter.deal_name),
      asset_class: stringOrNull(frontmatter.asset_class),
      deal_stage: stringOrNull(frontmatter.deal_stage),
      semantic_digest: digest,
      valid: count('error') === 0,
      error_count: count('error'),
      warning_count: count('warning'),
      flags: stringArray(frontmatter.flags),
      blocking_flags: stringArray(frontmatter.blocking_flags),
      quick_metrics: numericRecord(frontmatter.quick_metrics),
    };
  } catch (error) {
    return { path, deal_id: null, deal_name: null, asset_class: null, deal_stage: null, semantic_digest: null, valid: false, error_count: 1, warning_count: 0, flags: [], blocking_flags: [], quick_metrics: {}, error: error instanceof Error ? error.message : String(error) };
  }
}

function stringOrNull(value: unknown): string | null { return typeof value === 'string' ? value : null; }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').sort() : []; }
function numericRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === 'number' && Number.isFinite(item)));
}
function hasUWEnvelope(frontmatter: Record<string, unknown>): boolean {
  return ['uw_version', 'deal_id', 'deal_name', 'created', 'last_modified', 'property_address', 'city', 'state', 'zip', 'asset_class']
    .every((field) => typeof frontmatter[field] === 'string' && frontmatter[field].length > 0);
}
function csvCell(value: unknown): string { const text = value == null ? '' : String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function normaliseFilter(value: string | readonly string[] | undefined): ReadonlySet<string> | undefined {
  if (value === undefined) return undefined;
  return new Set(typeof value === 'string' ? [value] : value);
}
function matchesMetric(value: number | undefined, filter: BatchMetricFilter): boolean {
  if (value === undefined) return false;
  switch (filter.comparison) {
    case 'gt': return value > filter.value;
    case 'gte': return value >= filter.value;
    case 'lt': return value < filter.value;
    case 'lte': return value <= filter.value;
    case 'eq': return value === filter.value;
  }
}
function summarizeBy(deals: readonly BatchDealIndexEntry[], keyFor: (deal: BatchDealIndexEntry) => string): BatchGroupSummary[] {
  const groups = new Map<string, BatchDealIndexEntry[]>();
  for (const deal of deals) {
    const key = keyFor(deal);
    groups.set(key, [...(groups.get(key) ?? []), deal]);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, entries]) => ({
    key,
    deals: entries.length,
    valid_deals: entries.filter((deal) => deal.valid).length,
    error_count: entries.reduce((total, deal) => total + deal.error_count, 0),
    warning_count: entries.reduce((total, deal) => total + deal.warning_count, 0),
  }));
}
function summarizeFlags(deals: readonly BatchDealIndexEntry[]): BatchFlagSummary[] {
  const flags = new Map<string, BatchFlagSummary>();
  for (const deal of deals) {
    for (const [flag, blocking] of [...deal.flags.map((flag) => [flag, false] as const), ...deal.blocking_flags.map((flag) => [flag, true] as const)]) {
      const prior = flags.get(flag) ?? { flag, deals: 0, blocking: false };
      flags.set(flag, { flag, deals: prior.deals + 1, blocking: prior.blocking || blocking });
    }
  }
  return [...flags.values()].sort((left, right) => left.flag.localeCompare(right.flag));
}
