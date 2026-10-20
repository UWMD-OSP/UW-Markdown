import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parseUWFile } from '@uwmd/verify';
import { render } from './renderer.js';
import { runProcess } from '../../../test/cli.mjs';

vi.setConfig({ testTimeout: 30_000 });
function source(reverse: boolean): string {
  const peers = ['annotation', 'content'].map((variant, index) => `\n\`\`\`json uw:section=operating_statement variant=${variant}\n${JSON.stringify({ _meta: { section: 'operating_statement', lifecycle: { revision: 1, superseded: false } }, value: index + 111 })}\n\`\`\`\n`);
  return `---\nuw_version: "3.0"\nasset_class: multifamily\n---\n${(reverse ? peers.reverse() : peers).join('')}`;
}
describe('lawful variant labels through renderer and actual CLI', () => {
  it.each([false, true])('preserves both peers through json rendering without source writes (reverse=%s)', reverse => {
    const raw = source(reverse);
    const parsed = parseUWFile(raw);
    const before = structuredClone(parsed);
    const output = JSON.parse(render(parsed, { format: 'json' }).content);
    expect(Object.keys(output.sections.operating_statement).sort()).toEqual(['annotation', 'content']);
    expect(output.sections.operating_statement.annotation.value).toBe(111);
    expect(output.sections.operating_statement.content.value).toBe(112);
    expect(parsed).toEqual(before);
    expect(parsed.raw).toBe(raw);
  });
  it.each([false, true])('actual parse CLI emits complete portable per-variant projection (reverse=%s)', async reverse => {
    const directory = mkdtempSync(resolve(tmpdir(), 'uwmd-annotation-peer-'));
    const file = resolve(directory, 'source with spaces.uwx.md');
    const raw = source(reverse);
    writeFileSync(file, raw);
    try {
      const result = await runProcess(process.execPath, [resolve(process.cwd(), 'dist/cli.js'), 'parse', file, '--compact'], { encoding: 'utf8' });
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      const output = JSON.parse(result.stdout);
      expect(Object.keys(output.sections.operating_statement).sort()).toEqual(['annotation', 'content']);
      expect(output.sections.operating_statement.annotation.content.value).toBe(111);
      expect(output.sections.operating_statement.content.content.value).toBe(112);
      expect(output.sections.operating_statement.annotation.meta.section).toBe('operating_statement');
      expect(output.superseded).toEqual({});
      expect(readFileSync(file, 'utf8')).toBe(raw);
    } finally { unlinkSync(file); rmdirSync(directory); }
  });
});
