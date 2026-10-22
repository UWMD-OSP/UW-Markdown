import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { computeEnvelopeDigest, CORE_CODEC_REGISTRY, parseUWFile, toUWEnvelope } from '@uwmd/verify';
import { loadEditableUWXFile, loadUWSourceFile } from './source-file.js';

const root = resolve('../..');
let temp: string;
let original: string;
const files: Record<string, string> = {};
beforeAll(async () => {
  temp = await mkdtemp(join(tmpdir(), 'uwmd-source-file-'));
  original = await readFile(join(root, 'examples/Parkview-Apts-Glendale-AZ.uwx.md'), 'utf8');
  files.uwx = join(temp, 'deal.uwx.md');
  await writeFile(files.uwx, original);
  const envelope = toUWEnvelope(parseUWFile(original));
  for (const id of ['uw-json', 'uw-xml', 'uw-csv-bundle']) {
    const codec = CORE_CODEC_REGISTRY.get(id);
    const file = join(temp, `deal${codec.descriptor.file_extensions[0]}`);
    const encoded = await codec.encode(envelope);
    await writeFile(file, encoded as string | Uint8Array);
    files[id] = file;
  }
  files.lite = join(root, 'examples/Parkview-Apts-Glendale-AZ.uw.md');
});
afterAll(async () => {
  const target = resolve(temp);
  if (dirname(target) !== resolve(tmpdir()) || !target.split(/[\\/]/).pop()?.startsWith('uwmd-source-file-'))
    throw new Error('Unexpected test temporary directory');
  await rm(target, { recursive: true, force: true });
});

describe('registered source files', () => {
  it.each(['uwx', 'uw-json', 'uw-xml', 'uw-csv-bundle'])('reads %s without changing the source or underwriting values', async (id) => {
    const file = files[id]!;
    const before = await readFile(file);
    const result = await loadUWSourceFile(file);
    expect(await computeEnvelopeDigest(result.envelope)).toBe(await computeEnvelopeDigest(toUWEnvelope(parseUWFile(original))));
    expect(result.parsed.frontmatter.deal_id).toBe(parseUWFile(original).frontmatter.deal_id);
    expect(await readFile(file)).toEqual(before);
  });
  it('compiles Lite for reading and retains UWX bytes for editing', async () => {
    expect((await loadUWSourceFile(files.lite!)).parsed.frontmatter.asset_class).toBe('multifamily');
    expect((await loadEditableUWXFile(files.uwx!)).raw).toBe(original);
    for (const id of ['lite', 'uw-json', 'uw-xml', 'uw-csv-bundle'])
      await expect(loadEditableUWXFile(files[id]!)).rejects.toMatchObject({ code: 'SOURCE_EDIT_UNSUPPORTED' });
  });
  it.each(['uwx', 'lite', 'uw-json', 'uw-xml', 'uw-csv-bundle'])('CLI commands read %s through the shared loader', (id) => {
    for (const args of [['summary'], ['render', '--format=json'], ['scope', '--json'], ['verify', '--integrity', '--json']]) {
      const child = spawnSync(process.execPath, [join(root, 'packages/uwmd-cli/bin/uwmd.mjs'), args[0]!, files[id]!, ...args.slice(1)],
        { encoding: 'utf8', timeout: 30_000, maxBuffer: 2_000_000 });
      expect(child.error, `${id} ${args[0]}`).toBeUndefined();
      expect(child.status, `${id} ${args[0]}: ${child.stderr}`).toBe(0);
      expect(child.stdout).not.toBe('');
    }
  }, 60_000);
});
