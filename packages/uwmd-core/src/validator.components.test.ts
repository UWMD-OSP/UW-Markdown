// Mixed-use components validation — CC-11 (asset-class gate), CC-12 (footing),
// and the section-internal MU-* rules. RFC 0019 / UW_FORMAT_SPEC §4.23.

import { describe, expect, it } from 'vitest';
import { BUILTIN_REMEDIATIONS } from './protocol.js';
import { validateUWFile } from './validator.js';
import type { ParsedUWFile, UWBlock, ValidationMessage } from './types.js';

function block(section: string, content: Record<string, unknown>): UWBlock {
  return {
    annotation: { section },
    content,
    meta: {
      section, version: 1, superseded: false, source: 'manual', agent_id: null, agent_version: null,
      actor: 'test', timestamp: '2026-08-18T00:00:00Z', confidence: 'high', human_review_required: false,
      flags: [], input_hash: null, notes: null,
    },
    prose: '', rawJson: JSON.stringify(content), lineStart: 1, lineEnd: 1,
  };
}

function file(sections: Record<string, UWBlock>, assetClass = 'mixed_use'): ParsedUWFile {
  return {
    frontmatter: { asset_class: assetClass } as ParsedUWFile['frontmatter'],
    sections, prose: {}, pipeline_log: [], custom_calculations: [], custom_scenarios: [],
    extensions: {}, superseded: {}, raw: '',
  };
}

const codes = (parsed: ParsedUWFile): string[] => validateUWFile(parsed).issues.map((i) => i.code);
const find = (parsed: ParsedUWFile, code: string): ValidationMessage | undefined =>
  validateUWFile(parsed).issues.find((i) => i.code === code);

// A well-formed two-component mixed-use document that must trip none of the rules.
const goodComponents = () =>
  block('components', {
    multifamily: { component_class: 'multifamily', net_operating_income: 1_300_000, allocation_pct: 0.7 },
    retail: { component_class: 'retail', net_operating_income: 372_000, allocation_pct: 0.3 },
  });

describe('validateUWFile — mixed-use components (RFC 0019)', () => {
  it('a well-formed mixed-use document trips none of the component rules', () => {
    const parsed = file({
      components: goodComponents(),
      noi_model: block('noi_model', { net_operating_income: 1_672_000 }),
    });
    const emitted = codes(parsed);
    for (const c of ['CC-11', 'CC-12', 'MU-01', 'MU-02', 'MU-03', 'MU-04', 'MU-05', 'MU-06']) {
      expect(emitted, c).not.toContain(c);
    }
  });

  it('CC-11: a components section under a non-mixed-use asset class is rejected', () => {
    const parsed = file({ components: goodComponents() }, 'office');
    const issue = find(parsed, 'CC-11');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('error');
    expect(issue!.field).toBe('asset_class');
    // enriched from BUILTIN_REMEDIATIONS
    const reg = BUILTIN_REMEDIATIONS.find((r) => r.code === 'CC-11');
    expect(reg).toBeDefined();
    expect(issue!.title).toBe(reg!.title);
    expect(issue!.remediation).toBe(reg!.remediation);
    // the mixed-use-specific rules do not run on a mis-typed doc
    expect(codes(parsed)).not.toContain('MU-01');
  });

  it('CC-12: property NOI must equal the sum of component NOIs', () => {
    const mismatch = file({
      components: goodComponents(),
      noi_model: block('noi_model', { net_operating_income: 2_000_000 }),
    });
    const issue = find(mismatch, 'CC-12');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('error');
    const reg = BUILTIN_REMEDIATIONS.find((r) => r.code === 'CC-12');
    expect(issue!.title).toBe(reg!.title);

    // exact footing → no CC-12
    const footed = file({
      components: goodComponents(),
      noi_model: block('noi_model', { net_operating_income: 1_672_000 }),
    });
    expect(codes(footed)).not.toContain('CC-12');
  });

  it('CC-12 does not fire when a component NOI is missing (that is MU-04, not a footing mismatch)', () => {
    const parsed = file({
      components: block('components', {
        multifamily: { component_class: 'multifamily', net_operating_income: 1_300_000 },
        retail: { component_class: 'retail' },
      }),
      noi_model: block('noi_model', { net_operating_income: 1_672_000 }),
    });
    const emitted = codes(parsed);
    expect(emitted).toContain('MU-04');
    expect(emitted).not.toContain('CC-12');
  });

  it('MU-01: fewer than two components', () => {
    const parsed = file({
      components: block('components', {
        multifamily: { component_class: 'multifamily', net_operating_income: 1 },
      }),
    });
    expect(codes(parsed)).toContain('MU-01');
  });

  it('MU-02: land and unknown classes are inadmissible components', () => {
    const parsed = file({
      components: block('components', {
        multifamily: { component_class: 'multifamily', net_operating_income: 1 },
        retail: { component_class: 'retail', net_operating_income: 1 },
        land: { component_class: 'land', net_operating_income: -5 },
      }),
    });
    const issue = find(parsed, 'MU-02');
    expect(issue).toBeDefined();
    expect(issue!.field).toBe('land');
    expect(codes(parsed)).not.toContain('MU-01'); // two admissible components present
  });

  it('MU-03: a component key must equal its component_class', () => {
    const parsed = file({
      components: block('components', {
        multifamily: { component_class: 'retail', net_operating_income: 1 },
        retail: { component_class: 'retail', net_operating_income: 1 },
      }),
    });
    const issue = find(parsed, 'MU-03');
    expect(issue).toBeDefined();
    expect(issue!.field).toBe('multifamily.component_class');
  });

  it('MU-04: a present component must state net_operating_income', () => {
    const parsed = file({
      components: block('components', {
        multifamily: { component_class: 'multifamily' },
        retail: { component_class: 'retail', net_operating_income: 1 },
      }),
    });
    const issue = find(parsed, 'MU-04');
    expect(issue).toBeDefined();
    expect(issue!.field).toBe('multifamily.net_operating_income');
  });

  it('MU-05: allocation_pct must sum to 1.0 when used, and is optional when absent', () => {
    const bad = file({
      components: block('components', {
        multifamily: { component_class: 'multifamily', net_operating_income: 1, allocation_pct: 0.5 },
        retail: { component_class: 'retail', net_operating_income: 1, allocation_pct: 0.3 },
      }),
    });
    expect(codes(bad)).toContain('MU-05');

    const noAlloc = file({
      components: block('components', {
        multifamily: { component_class: 'multifamily', net_operating_income: 1 },
        retail: { component_class: 'retail', net_operating_income: 1 },
      }),
    });
    expect(codes(noAlloc)).not.toContain('MU-05');
  });

  it('MU-06: a component must not carry its own debt_structure', () => {
    const parsed = file({
      components: block('components', {
        multifamily: { component_class: 'multifamily', net_operating_income: 1, debt_structure: { loan_amount: 9 } },
        retail: { component_class: 'retail', net_operating_income: 1 },
      }),
    });
    const issue = find(parsed, 'MU-06');
    expect(issue).toBeDefined();
    expect(issue!.field).toBe('multifamily.debt_structure');
  });

  it('every new code has a BUILTIN_REMEDIATIONS entry', () => {
    for (const c of ['CC-11', 'CC-12', 'MU-01', 'MU-02', 'MU-03', 'MU-04', 'MU-05', 'MU-06']) {
      expect(BUILTIN_REMEDIATIONS.find((r) => r.code === c), c).toBeDefined();
    }
  });
});
