import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { buildMeta } from '@uwmd/verify';
import { describe, expect, it, vi } from 'vitest';
import { runProcess } from '../../../test/cli.mjs';

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });
const cli = resolve(process.cwd(), 'dist/cli.js');

describe('RFC0031 exact actor-source actual CLI transport', () => {
  it.each(['validate', 'verify'])('%s reports canonical SRC-01 for a trailing line terminator and preserves bytes', async command => {
    const directory = mkdtempSync(resolve(tmpdir(), 'uwmd-exact-source-'));
    const file = resolve(directory, 'source.uwx.md');
    const meta = buildMeta('property', 1, { source: 'manual', actor: 'synthetic', timestamp: '2026-10-18T00:00:00Z' });
    const body = { _meta: { ...meta, provenance: { ...meta.provenance, source: 'agent/x\n', agent_id: 'synthetic' } }, total_units: 10 };
    const raw = `---\nuw_version: "3.0"\nasset_class: multifamily\ndeal_id: exact-source-cli\n---\n\`\`\`json uw:section=property\n${JSON.stringify(body)}\n\`\`\`\n`;
    writeFileSync(file, raw);
    try {
      const actual = await runProcess(process.execPath, [cli, command, file, ...(command === 'verify' ? ['--validate'] : []), '--json'], { encoding: 'utf8' });
      expect(actual.status).toBe(1);
      expect(actual.stderr).toBe('');
      const dto = JSON.parse(actual.stdout);
      const result = command === 'verify' ? dto.validation : dto;
      expect(result.errors.filter((i: { code: string }) => i.code.startsWith('SRC-')).map((i: { code: string, section: string }) => [i.code, i.section])).toEqual([['SRC-01', 'property']]);
      expect(result.issues.filter((i: { severity: string }) => i.severity === 'error')).toEqual(result.errors);
      expect(readFileSync(file, 'utf8')).toBe(raw);
    } finally { unlinkSync(file); rmdirSync(directory); }
  });
});
