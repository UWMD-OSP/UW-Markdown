import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { ACTOR_SOURCE_RE, buildMeta, parseActorSource, parseUWFile, validateUWFile, verifyProvenance } from './index.js';

const sources = ['manual', 'agent/x', 'document/OM.pdf', 'system/calc_1', 'institution/X-2'];
const suffixes = ['\n', '\r', '\r\n', '\u2028', '\u2029', ' ', '\t'];
const schema = JSON.parse(readFileSync(new URL('../../../spec/schemas/uwmd-block.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv2020({ strict: false, validateFormats: false });
const canonicalSource = ajv.compile(schema.$defs.UWMeta.properties.provenance.properties.source);
const overrideSource = ajv.compile(schema.properties._overrides.items.properties.source);
const block = (source: unknown, annotation = ''): string => {
  const meta = buildMeta('property', 1, { source: 'manual', actor: 'synthetic', timestamp: '2026-10-18T00:00:00Z' });
  return `\`\`\`json uw:section=property${annotation}\n${JSON.stringify({ _meta: { ...meta, provenance: { ...meta.provenance, source, agent_id: 'synthetic' } }, total_units: 10 })}\n\`\`\`\n`;
};
const header = '---\nuw_version: "3.0"\nasset_class: multifamily\ndeal_id: exact-source\n---\n';

describe('RFC0031 whole actor-source grammar through the public API', () => {
  it.each(sources)('keeps %s exact and rejects every trailing line terminator without normalization', source => {
    expect(parseActorSource(source).kind).not.toBe('invalid');
    expect(ACTOR_SOURCE_RE.test(source)).toBe(true);
    expect(canonicalSource(source)).toBe(true);
    expect(overrideSource(source)).toBe(true);
    for (const suffix of suffixes) {
      const malformed = source + suffix;
      expect(parseActorSource(malformed), JSON.stringify(malformed)).toEqual({ kind: 'invalid' });
      expect(ACTOR_SOURCE_RE.test(malformed)).toBe(false);
      expect(canonicalSource(malformed)).toBe(false);
      expect(overrideSource(malformed)).toBe(false);
    }
  });

  it.each(['\nagent/x', 'agent/\nx', 'agent/x\ny', 'agent/x\u0000', 'agent/x/more'])('rejects other non-grammar content %j', source => {
    expect(parseActorSource(source)).toEqual({ kind: 'invalid' });
    expect(ACTOR_SOURCE_RE.test(source)).toBe(false);
    expect(canonicalSource(source)).toBe(false);
    expect(overrideSource(source)).toBe(false);
  });

  it.each(suffixes)('reports canonical SRC-01 for a current source with suffix %j', suffix => {
    const raw = header + block(`agent/x${suffix}`);
    const result = validateUWFile(raw);
    const sourceIssues = result.errors.filter(i => i.code.startsWith('SRC-'));
    expect(sourceIssues.map(i => [i.code, i.section, i.field])).toEqual([['SRC-01', 'property', undefined]]);
    const parsed = parseUWFile(raw);
    expect(parsed.raw).toBe(raw);
    expect(validateUWFile(parsed).errors.filter(i => i.code.startsWith('SRC-'))).toEqual(sourceIssues);
    expect(parsed.raw).toBe(raw);
  });

  it('keeps malformed actor sources outside restricted provenance authority', () => {
    const policy = [{ source_pattern: 'agent/*', authority: 'agent_only' as const, supersede_on_edit: true }];
    expect(verifyProvenance(parseUWFile(header + block('agent/x')), policy).issues).toEqual([]);
    expect(verifyProvenance(parseUWFile(header + block('agent/x\n')), policy).issues.map(i => i.code)).toEqual(['POL-01']);
  });

  it('does not expand canonical SRC applicability to history or allocate absent/non-string sources', () => {
    const raw = header + block('agent/x\n', ' superseded=true') + block('manual');
    expect(validateUWFile(raw).errors.filter(i => i.code.startsWith('SRC-'))).toEqual([]);
    for (const source of [undefined, null, 4, '']) {
      expect(validateUWFile(header + block(source)).errors.filter(i => i.code.startsWith('SRC-'))).toEqual([]);
    }
  });
});
