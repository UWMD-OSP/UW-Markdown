import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildUWMDFactTable,
  filterUWMDCollection,
  indexUWMDDirectory,
  projectUnderwritingQueue,
  summarizeUWMDCollection,
  UWMD_BATCH_INDEX_VERSION,
  UWMD_FACT_TABLE_VERSION,
  writeUWMDCollectionIndex,
  writeUWMDFactTable,
  type UWMDCollectionIndex,
} from './index.js';

const COLLECTION: UWMDCollectionIndex = {
  index_version: UWMD_BATCH_INDEX_VERSION,
  files_scanned: 4,
  valid_deals: 3,
  invalid_deals: 1,
  deals: [
    {
      path: 'a-office.uw.md', deal_id: 'a', deal_name: 'A', asset_class: 'office', deal_stage: 'screening',
      semantic_digest: 'sha256:a', valid: true, error_count: 0, warning_count: 1,
      flags: ['lease_roll'], blocking_flags: [], quick_metrics: { dscr: 1.3, ltv: 0.7 },
    },
    {
      path: 'b-multifamily.uw.md', deal_id: 'b', deal_name: 'B', asset_class: 'multifamily', deal_stage: 'full_underwrite',
      semantic_digest: 'sha256:b', valid: true, error_count: 0, warning_count: 3,
      flags: ['lease_roll'], blocking_flags: ['ofac_match'], quick_metrics: { dscr: 0.9, ltv: 0.8 },
    },
    {
      path: 'c-retail.uw.md', deal_id: 'c', deal_name: 'C', asset_class: 'retail', deal_stage: 'screening',
      semantic_digest: 'sha256:c', valid: true, error_count: 0, warning_count: 3,
      flags: [], blocking_flags: [], quick_metrics: { dscr: 1.1, ltv: 0.75 },
    },
    {
      path: 'z-invalid.uw.md', deal_id: null, deal_name: null, asset_class: null, deal_stage: null,
      semantic_digest: null, valid: false, error_count: 1, warning_count: 0,
      flags: [], blocking_flags: [], quick_metrics: {}, error: '[MISSING_UW_ENVELOPE] missing',
    },
  ],
};

describe('indexUWMDDirectory', () => {
  it('indexes valid deals, isolates malformed files, and writes deterministic projections', async () => {
    const root = await mkdtemp(join(tmpdir(), 'uwmd-batch-'));

    try {
      await copyFile(
        join(process.cwd(), '..', '..', 'examples', 'Parkview-Apts-Glendale-AZ.uwx.md'),
        join(root, 'parkview.uw.md'),
      );
      await writeFile(join(root, 'broken.uw.md'), '```uwmd json\nnot-json\n```', 'utf8');

      const index = await indexUWMDDirectory(root);
      expect(index.files_scanned).toBe(2);
      expect(index.valid_deals).toBe(1);
      expect(index.invalid_deals).toBe(1);
      expect(index.deals.find((deal) => deal.path === 'parkview.uw.md')?.semantic_digest).toMatch(/^sha256:/);
      expect(index.deals.find((deal) => deal.path === 'parkview.uw.md')?.quick_metrics.dscr).toBe(1.109);

      const outputs = await writeUWMDCollectionIndex(index, join(root, 'out'));
      expect(JSON.parse(await readFile(outputs.json, 'utf8'))).toEqual(index);
      expect(await readFile(outputs.csv, 'utf8')).toContain('semantic_digest');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('batch workflow projections', () => {
  it('filters deterministically by asset class, stage, flag, and metric threshold', () => {
    expect(filterUWMDCollection(COLLECTION, { asset_class: ['office', 'retail'], deal_stage: 'screening' }).map((deal) => deal.path))
      .toEqual(['a-office.uw.md', 'c-retail.uw.md']);
    expect(filterUWMDCollection(COLLECTION, { flag: 'ofac_match' }).map((deal) => deal.path))
      .toEqual(['b-multifamily.uw.md']);
    expect(filterUWMDCollection(COLLECTION, { metric: { metric: 'dscr', comparison: 'lt', value: 1 } }).map((deal) => deal.path))
      .toEqual(['b-multifamily.uw.md']);
    expect(filterUWMDCollection(COLLECTION, { metric: { metric: 'ltv', comparison: 'gte', value: 0.75 } }).map((deal) => deal.path))
      .toEqual(['b-multifamily.uw.md', 'c-retail.uw.md']);
  });

  it('summarizes groups and flags while retaining invalid candidates', () => {
    const summary = summarizeUWMDCollection(COLLECTION);

    expect(summary).toMatchObject({ deals: 4, valid_deals: 3, invalid_deals: 1, error_count: 1, warning_count: 7 });
    expect(summary.by_asset_class).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'office', deals: 1 }),
      expect.objectContaining({ key: '(unknown)', deals: 1, valid_deals: 0 }),
    ]));
    expect(summary.flags).toEqual([
      { flag: 'lease_roll', deals: 2, blocking: false },
      { flag: 'ofac_match', deals: 1, blocking: true },
    ]);
  });

  it('projects a reproducible queue that prioritizes blocking flags, then issues, then path', () => {
    const first = projectUnderwritingQueue(COLLECTION);
    const second = projectUnderwritingQueue(COLLECTION);

    expect(first).toEqual(second);
    expect(first.ordering).toBe('blocking_flags desc, error_count desc, warning_count desc, path asc');
    expect(first.deals.map((deal) => deal.path)).toEqual([
      'b-multifamily.uw.md', 'z-invalid.uw.md', 'c-retail.uw.md', 'a-office.uw.md',
    ]);
  });
});

describe('buildUWMDFactTable', () => {
  it('flattens every parseable deal to identity-prefixed fact rows and lists skips', async () => {
    const root = await mkdtemp(join(tmpdir(), 'uwmd-facts-'));
    try {
      await copyFile(
        join(process.cwd(), '..', '..', 'examples', 'Parkview-Apts-Glendale-AZ.uwx.md'),
        join(root, 'parkview.uw.md'),
      );
      await writeFile(join(root, 'broken.uw.md'), '```uwmd json\nnot-json\n```', 'utf8');

      const table = await buildUWMDFactTable(root);
      expect(table.fact_table_version).toBe(UWMD_FACT_TABLE_VERSION);
      expect(table.files_scanned).toBe(2);
      expect(table.deals_included).toBe(1);
      expect(table.deals_skipped).toHaveLength(1);
      expect(table.deals_skipped[0]?.path).toBe('broken.uw.md');
      expect(table.rows.length).toBeGreaterThan(0);

      const index = await indexUWMDDirectory(root);
      const parkview = index.deals.find((deal) => deal.path === 'parkview.uw.md');
      for (const row of table.rows) {
        expect(row.path).toBe('parkview.uw.md');
        expect(row.semantic_digest).toBe(parkview?.semantic_digest);
        expect(row.valid).toBe(true);
        expect(['annotation', 'meta', 'content']).toContain(row.scope);
      }
      // A scalar business fact is addressable by (block_ref, scope, pointer).
      expect(
        table.rows.some((row) => row.scope === 'content' && row.json_type === 'number' && row.pointer !== ''),
      ).toBe(true);

      const again = await buildUWMDFactTable(root);
      expect(again).toEqual(table);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('writes JSONL that parses line-for-line plus a rowless manifest', async () => {
    const root = await mkdtemp(join(tmpdir(), 'uwmd-facts-out-'));
    try {
      await copyFile(
        join(process.cwd(), '..', '..', 'examples', 'Parkview-Apts-Glendale-AZ.uwx.md'),
        join(root, 'parkview.uw.md'),
      );
      const table = await buildUWMDFactTable(root);
      const files = await writeUWMDFactTable(table, join(root, 'out'));

      const lines = (await readFile(files.jsonl, 'utf8')).split('\n').filter((line) => line !== '');
      expect(lines).toHaveLength(table.rows.length);
      expect(JSON.parse(lines[0] ?? '')).toEqual(table.rows[0]);

      const manifest = JSON.parse(await readFile(files.manifest, 'utf8'));
      expect(manifest.row_count).toBe(table.rows.length);
      expect(manifest.rows).toBeUndefined();
      expect(manifest.fact_table_version).toBe(UWMD_FACT_TABLE_VERSION);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
