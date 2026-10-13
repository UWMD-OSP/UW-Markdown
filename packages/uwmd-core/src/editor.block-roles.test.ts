// RFC 0040 block roles through the trusted writers: the editor's section edits
// and the agent runner (starter products). The role selection itself is
// @uwmd/verify's (block-roles.test.ts there); these cases moved here with the
// writers (RFC 0083).
import { describe, expect, it } from 'vitest';
import { getSection, parseUWFile } from '@uwmd/verify';
import { applyEdit } from './editor.js';
import { writeAgentBlock } from './runner.js';

const meta = (section: string) => ({ section, lifecycle: { revision: 1, superseded: false }, provenance: { source: 'manual', agent_id: null, agent_version: null, actor: 'host', timestamp: '2026-09-11T00:00:00Z', notes: null }, quality: { confidence: 'high' as const, human_review_required: false, flags: [] }, integrity: { input_hash: null } });
const frontmatter = "---\nuw_version: \"3.0\"\ndeal_id: roles\nasset_class: multifamily\nlast_modified: \"2026-09-11T00:00:00Z\"\n---\n";
const document = (role: unknown = 'primary') => `${frontmatter}Untouched prose.

\`\`\`json uw:section=property source=manual v=1
${JSON.stringify({ _meta: meta('property'), _role: role, total_units: 100 }, null, 2)}
\`\`\`

Untouched tail.
`;

describe('RFC 0040 trusted writers', () => {
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
});
