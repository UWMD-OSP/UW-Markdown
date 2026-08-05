import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { indexUWMDDirectory, writeUWMDCollectionIndex } from './index.js';

describe('indexUWMDDirectory', () => {
  it('indexes valid deals, isolates malformed files, and writes deterministic projections', async () => {
    const root = await mkdtemp(join(tmpdir(), 'uwmd-batch-'));

    try {
      await copyFile(
        join(process.cwd(), '..', '..', 'examples', 'Parkview-Apts-Glendale-AZ.uw.md'),
        join(root, 'parkview.uw.md'),
      );
      await writeFile(join(root, 'broken.uw.md'), '```uwmd json\nnot-json\n```', 'utf8');

      const index = await indexUWMDDirectory(root);
      expect(index.files_scanned).toBe(2);
      expect(index.valid_deals).toBe(1);
      expect(index.invalid_deals).toBe(1);
      expect(index.deals.find((deal) => deal.path === 'parkview.uw.md')?.semantic_digest).toMatch(/^sha256:/);

      const outputs = await writeUWMDCollectionIndex(index, join(root, 'out'));
      expect(JSON.parse(await readFile(outputs.json, 'utf8'))).toEqual(index);
      expect(await readFile(outputs.csv, 'utf8')).toContain('semantic_digest');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});