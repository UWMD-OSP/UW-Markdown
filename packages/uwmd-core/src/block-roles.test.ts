import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveRoleBlock } from './block-roles.js';
import { BLOCK_ROLES, CROSS_CHECK_ROLE_PREFERENCE } from './protocol.js';
import { parseUWFile, getSection } from './parser.js';
import { validateUWFile } from './validator.js';
import { applyEdit } from './editor.js';
import { writeAgentBlock } from './runner.js';
import { computeBlockHash } from './integrity.js';
import { reshapeMetaV1toV2 } from './meta-shape.js';
import { stringifyUWX } from './lite-bridge.js';
import { toUWEnvelope, fromUWEnvelope } from './envelope.js';
import { stringifyUWJson, parseUWJson } from './uwjson.js';
import { stringifyUWXml, parseUWXml } from './uwxml.js';
import { encodeUWCSVBundle, decodeUWCSVBundle } from './uwcsv.js';
import type { ParsedUWFile, UWBlock } from './types.js';

const meta = (section: string) => ({ section, version: 1, superseded: false, source: 'manual', agent_id: null,
  agent_version: null, actor: 'host', timestamp: '2026-09-11T00:00:00Z', confidence: 'high' as const,
  human_review_required: false, flags: [], input_hash: null, notes: null });
function block(content: Record<string, unknown>, section = 'debt_structure', variant?: string): UWBlock {
  return { annotation: { section, ...(variant ? { variant } : {}) }, content, meta: meta(section),
    prose: '', rawJson: JSON.stringify(content), lineStart: 1, lineEnd: 1 };
}
function file(sections: Record<string, UWBlock | Record<string, UWBlock>>): ParsedUWFile {
  return { frontmatter: { asset_class: 'multifamily' } as ParsedUWFile['frontmatter'], sections,
    prose: {}, pipeline_log: [], custom_calculations: [], custom_scenarios: [], extensions: {}, superseded: {}, raw: '' };
}
const frontmatter = '---\nuw_version: "1.1"\ndeal_id: roles\nasset_class: multifamily\nlast_modified: "2026-09-11T00:00:00Z"\n---\n';
const document = (role: unknown = 'primary') => `${frontmatter}Untouched prose.

\`\`\`json uw:section=property source=manual v=1
${JSON.stringify({ _role: role, _meta: meta('property'), total_units: 100 }, null, 2)}
\`\`\`

Untouched tail.
`;

describe('RFC 0040 role selection', () => {
  it('publishes frozen role vocabulary and preferences', () => {
    expect(Object.isFrozen(BLOCK_ROLES)).toBe(true);
    expect(Object.isFrozen(CROSS_CHECK_ROLE_PREFERENCE)).toBe(true);
    expect(Object.isFrozen(CROSS_CHECK_ROLE_PREFERENCE['CC-03'])).toBe(true);
  });
  it('selects senior before primary/default and exposes evidence', () => {
    const senior = block({ _role: 'senior' });
    expect(resolveRoleBlock({ producer: senior, default: block({ _role: 'primary' }) }, 'debt_structure', [], 'CC-03'))
      .toMatchObject({ block: senior, evidence: { variant: 'producer', via: 'role' } });
  });
  it('selects an explicit key before consulting a duplicate role', () => {
    const map = { t12: block({}), a: block({ _role: 'primary' }), b: block({ _role: 'primary' }) };
    expect(resolveRoleBlock(map, 'operating_statement', ['t12'])).toMatchObject({ variant: 't12', evidence: { via: 'preference' } });
    expect(resolveRoleBlock(map, 'operating_statement')).toMatchObject({ state: 'unresolvable', detail: 'multiple variants claim role primary: a, b' });
  });
  it('refuses consulted duplicate seniors even with a default', () => {
    const result = resolveRoleBlock({ a: block({ _role: 'senior' }), b: block({ _role: 'senior' }), default: block({}) }, 'debt_structure', [], 'CC-03');
    expect(result).toMatchObject({ state: 'unresolvable', detail: 'multiple variants claim role senior: a, b' });
  });
  it.each(['preferred', 'default', 'base', 'sole', 'single'])('excludes components on the %s path', (path) => {
    const component = block({ _role: 'component' });
    const entry = path === 'single' ? component : { [path]: component };
    expect(resolveRoleBlock(entry, 'debt_structure', ['preferred'], 'CC-03')).toMatchObject({ state: 'unresolvable' });
  });
  it('allows repeated components, filters before the sole fallback', () => {
    expect(resolveRoleBlock({ a: block({ _role: 'component' }), b: block({ _role: 'component' }), c: block({}) }, 'noi_model'))
      .toMatchObject({ variant: 'c', evidence: { via: 'sole' } });
  });
  it.each(['main', null, ['primary'], 1, {}].map(role => ({ role })))('rejects invalid role $role even in an unselected variant', ({ role }) => {
    const result = validateUWFile(file({ sources_uses: { default: block({ total_sources: 1, total_uses: 1 }, 'sources_uses'), bad: block({ _role: role }, 'sources_uses', 'bad') } }));
    expect(result.issues.find(i => i.code === 'ROLE-01')).toMatchObject({ severity: 'error', field: '_role' });
    expect(result.coverage['CC-04']?.status).toBe('evaluated');
    expect(resolveRoleBlock({ default: block({ _role: role }) }, 'sources_uses')).toMatchObject({ state: 'unresolvable' });
  });
  it('records detail and primary selections separately for CC-01', () => {
    const result = validateUWFile(file({ rent_roll: {
      summary: block({ _role: 'summary', gross_potential_rent: 999 }, 'rent_roll'),
      detail: block({ _role: 'detail', gross_potential_rent: 100 }, 'rent_roll'),
    }, operating_statement: {
      producer: block({ _role: 'primary', gross_potential_rent: 100 }, 'operating_statement'),
      other: block({ gross_potential_rent: 999 }, 'operating_statement'),
    } }));
    expect(result.coverage['CC-01']).toEqual({ status: 'evaluated', resolutions: {
      rent_roll: { variant: 'detail', via: 'role' }, operating_statement: { variant: 'producer', via: 'primary' },
    } });
    expect(result.issues.some(i => i.code === 'CC-01')).toBe(false);
  });
  it('restores all four senior debt checks including direct CC-03', () => {
    const result = validateUWFile(file({
      debt_structure: { senior: block({ _role: 'senior', loan_amount: 600, ltv: 0.6, annual_debt_service: 50, underwritten_noi: 100, dscr: 2 }), junior: block({ _role: 'junior', loan_amount: 999 }) },
      sources_uses: block({ sources: { loan_amount: 600 } }, 'sources_uses'),
      valuation: block({ underwritten_value: 1000 }, 'valuation'),
      noi_model: block({ net_operating_income: 100 }, 'noi_model'),
      stress_tests: block({ base_case: { annual_debt_service: 50 } }, 'stress_tests'),
    }));
    for (const code of ['CC-02', 'CC-03', 'CC-05', 'CC-09']) {
      expect(result.coverage[code]?.status, code).toBe('evaluated');
      expect(result.coverage[code]?.resolutions?.['debt_structure']).toEqual({ variant: 'senior', via: 'role' });
    }
  });
  it('uses the declared property NOI in CC-12', () => {
    const parsed = file({ components: block({ retail: { component_class: 'retail', net_operating_income: 40 }, office: { component_class: 'office', net_operating_income: 60 } }, 'components'),
      noi_model: { property: block({ _role: 'primary', net_operating_income: 100 }, 'noi_model'), unit: block({ _role: 'component', net_operating_income: 40 }, 'noi_model') } });
    parsed.frontmatter.asset_class = 'mixed_use';
    const result = validateUWFile(parsed);
    expect(result.coverage['CC-12']).toMatchObject({ status: 'evaluated', resolutions: { noi_model: { variant: 'property', via: 'primary' } } });
    expect(result.issues.some(i => i.code === 'CC-12')).toBe(false);
  });
  it('keeps the legacy role-free shape and does not alias _meta.role', () => {
    const plain = block({ total_sources: 100, total_uses: 100 }, 'sources_uses');
    const baseline = validateUWFile(file({ sources_uses: plain }));
    const ignored = { ...plain, content: { ...plain.content, _meta: { ...plain.meta, role: 'component' } } };
    expect(validateUWFile(file({ sources_uses: ignored }))).toEqual(baseline);
    expect(baseline.coverage['CC-04']).toEqual({ status: 'evaluated' });
  });
});

describe('RFC 0040 trusted writers and integrity', () => {
  it.each(['section_replace', 'section_supersede'] as const)('%s preserves roles, supports host assignment/removal, strips spoofed content', (kind) => {
    const source = document(); const parsed = parseUWFile(source);
    for (const role of [undefined, 'detail' as const, null]) {
      const result = applyEdit(source, parsed, { kind, section_id: 'property', content: { total_units: 120, _role: 'component' }, meta: {}, ...(role !== undefined ? { role } : {}) }, { actor: 'host', source: 'manual' });
      expect(result.ok).toBe(true);
      expect(result.content).toContain('Untouched prose.');
      expect(result.content).toContain('Untouched tail.');
      expect(getSection(parseUWFile(result.content!), 'property')?.content['_role']).toBe(role === undefined ? 'primary' : role === null ? undefined : role);
    }
  });
  it('strips invented roles from new agent blocks and preserves existing roles', () => {
    for (const source of [document(), frontmatter]) {
      const result = writeAgentBlock(source, parseUWFile(source), { sectionId: 'property', content: { _role: 'component', _meta: meta('property'), total_units: 120 } }, { timestamp: '2026-09-11T00:00:00Z', logEntryId: 'role-test' });
      expect(getSection(parseUWFile(result.content), 'property')?.content['_role']).toBe(source === frontmatter ? undefined : 'primary');
    }
  });
  it.each(['1.1', '2.0'])('preserves the %s annotation through Markdown, JSON, XML and CSV envelopes', async (version) => {
    let source = document();
    if (version === '2.0') source = source.replace('uw_version: "1.1"', 'uw_version: "2.0"').replace(JSON.stringify(meta('property'), null, 2).split('\n').join('\n  '), JSON.stringify(reshapeMetaV1toV2(meta('property')), null, 2).split('\n').join('\n  '));
    const parsed = parseUWFile(source); const envelope = toUWEnvelope(parsed);
    expect(getSection(parseUWFile(stringifyUWX(envelope)), 'property')?.content['_role']).toBe('primary');
    const representations = [parseUWJson(stringifyUWJson(parsed)), await parseUWXml(await stringifyUWXml(envelope)), await decodeUWCSVBundle(await encodeUWCSVBundle(envelope))];
    for (const decoded of representations) {
      expect(getSection(fromUWEnvelope(decoded), 'property')?.content['_role']).toBe('primary');
    }
  });
  it.each(['v1', 'v2'] as const)('covers _role under the existing %s hash contract', async (shape) => {
    const original = block({ _role: 'senior', loan_amount: 100 });
    const changed = { ...original, content: { ...original.content, _role: 'junior' } };
    expect(await computeBlockHash(changed, { shape })).not.toBe(await computeBlockHash(original, { shape }));
  });
});

describe('RFC 0040 Markdown variant routing', () => {
  const fence = (variant: string, content: Record<string, unknown>) => `\n\`\`\`json uw:section=debt_structure variant=${variant} source=manual v=1\n${JSON.stringify({ _meta: meta('debt_structure'), ...content })}\n\`\`\`\n`;
  it.each([false, true])('keeps unannotated peers when the role appears first=%s', (first) => {
    const parts = [fence('a', { _role: 'senior', loan_amount: 600 }), fence('b', { loan_amount: 100 }), fence('c', { _role: 'junior', loan_amount: 200 })];
    const parsed = parseUWFile(frontmatter + (first ? parts : [...parts].reverse()).join(''));
    expect(Object.keys(parsed.sections['debt_structure']!).sort()).toEqual(['a', 'b', 'c']);
    expect(resolveRoleBlock(parsed.sections['debt_structure'], 'debt_structure', [], 'CC-03')).toMatchObject({ variant: 'a' });
  });
});

describe('RFC 0040 conformance fixture coverage', () => {
  const fixture = (name: string) => validateUWFile(parseUWFile(readFileSync(resolve(process.cwd(), '../..', 'conformance/tier-1-reader/fixtures', `${name}.uwx.md`), 'utf8')));
  it('evaluates the producer-keyed statements in the real Markdown fixture', () => {
    const result = fixture('10-declared-roles');
    for (const code of ['CC-01', 'CC-02', 'CC-03', 'CC-05', 'CC-09']) expect(result.coverage[code]?.status, code).toBe('evaluated');
    expect(result.issues.filter(issue => issue.code === 'CC-16')).toEqual([]);
  });
  it('reports a consulted senior collision once, with the affected rules', () => {
    const result = fixture('11-role-collision');
    const issues = result.issues.filter(issue => issue.code === 'CC-16');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('multiple variants claim role senior: a, b');
    expect(issues[0]?.message).toContain('CC-02, CC-03, CC-05, CC-09');
    for (const code of ['CC-02', 'CC-03', 'CC-05', 'CC-09']) expect(result.coverage[code]?.reason, code).toBe('variant_unresolvable');
  });
  it('refuses invalid or component-only statements without claiming no default exists', () => {
    const result = fixture('12-role-eligibility');
    expect(result.issues.some(issue => issue.code === 'ROLE-01')).toBe(true);
    expect(result.coverage['CC-03']?.reason).toBe('variant_unresolvable');
    expect(result.issues.filter(issue => issue.code === 'CC-16').every(issue => !issue.message.includes('none is named default'))).toBe(true);
  });
});

it('preserves CC-15 scenario exemption even if the property NOI has a role collision', () => {
  const result = validateUWFile(file({
    lease_up_schedule: { downside: block({ stabilized_summary: { annualized_noi: 100 } }, 'lease_up_schedule', 'downside') },
    noi_model: { a: block({ _role: 'primary' }, 'noi_model'), b: block({ _role: 'primary' }, 'noi_model') },
  }));
  expect(result.coverage['CC-15']).toEqual({ status: 'skipped', reason: 'not_applicable', detail: 'no base variant' });
  expect(result.issues.filter(issue => issue.code === 'CC-16').some(issue => issue.message.includes('CC-15'))).toBe(false);
});

it('names both mixed-use checks when the components statement cannot resolve', () => {
  const result = validateUWFile(file({ components: block({ _role: 'component' }, 'components') }));
  expect(result.issues.find(issue => issue.code === 'CC-16')?.message).toContain('CC-11, CC-12');
});
