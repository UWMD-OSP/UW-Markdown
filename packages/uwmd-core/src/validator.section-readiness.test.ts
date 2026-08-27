// CC-14 / DQ-06 — section-level readiness (RFC 0028 / UW_FORMAT_SPEC §5.1,
// §5.3). CC-14 warns when a deal-record document has no property section at
// all, unconditionally on stage; DQ-06 names, at info severity, each section
// the declared deal_stage requires but the file lacks. One defect, one
// diagnostic: CC-14 suppresses both CC-13 (its precondition 4) and DQ-06's
// own property entry.

import { describe, expect, it } from 'vitest';
import { BUILTIN_REMEDIATIONS } from './protocol.js';
import {
  STAGE_REQUIREMENTS,
  STAGE_SECTION_OVERLAYS,
  requiredSectionsFor,
  validateUWFile,
} from './validator.js';
import type { ParsedUWFile, UWBlock, ValidationMessage } from './types.js';

function block(section: string, content: Record<string, unknown>, annotation: Record<string, unknown> = {}): UWBlock {
  return {
    annotation: { section, ...annotation },
    content,
    meta: {
      section, version: 1, superseded: false, source: 'manual', agent_id: null, agent_version: null,
      actor: 'test', timestamp: '2026-08-26T00:00:00Z', confidence: 'high', human_review_required: false,
      flags: [], input_hash: null, notes: null,
    },
    prose: '', rawJson: JSON.stringify(content), lineStart: 1, lineEnd: 1,
  };
}

function file(
  sections: Record<string, UWBlock>,
  frontmatterExtra: Record<string, unknown> = {},
): ParsedUWFile {
  return {
    frontmatter: { asset_class: 'office', ...frontmatterExtra } as ParsedUWFile['frontmatter'],
    sections, prose: {}, pipeline_log: [], custom_calculations: [], custom_scenarios: [],
    extensions: {}, superseded: {}, raw: '',
  };
}

const codes = (parsed: ParsedUWFile, code: string): ValidationMessage[] =>
  validateUWFile(parsed).issues.filter((i) => i.code === code);

describe('validateUWFile — CC-14 property section missing (RFC 0028)', () => {
  it('warns when a deal record has no property section, and never blocks', () => {
    const parsed = file({});
    const found = codes(parsed, 'CC-14');
    expect(found).toHaveLength(1);
    expect(found[0]!.severity).toBe('warning');
    expect(found[0]!.section).toBe('property');
    const reg = BUILTIN_REMEDIATIONS.find((r) => r.code === 'CC-14');
    expect(reg).toBeDefined();
    expect(found[0]!.title).toBe(reg!.title);
    expect(found[0]!.remediation).toBe(reg!.remediation);
    expect(validateUWFile(parsed).overall_status).toBe('warnings');
  });

  it('fires at every stage — a scope-stage record without property warns too', () => {
    expect(codes(file({}, { deal_stage: 'scope' }), 'CC-14')).toHaveLength(1);
    expect(codes(file({}, { deal_stage: 'monitoring' }), 'CC-14')).toHaveLength(1);
  });

  it('is satisfied by a property section', () => {
    const parsed = file({ property: block('property', { address: '1 Main St' }) });
    expect(codes(parsed, 'CC-14')).toHaveLength(0);
  });

  it('an externalized property section is present, not missing (precondition 3)', () => {
    const parsed = file({
      property: block('property', { external: true, parts: [] }, { external: true }),
    });
    expect(codes(parsed, 'CC-14')).toHaveLength(0);
  });

  it('is silent for a non-deal document profile (precondition 2)', () => {
    const parsed = file({}, { document_profile: 'market-data-v1' });
    expect(codes(parsed, 'CC-14')).toHaveLength(0);
  });

  it('fires for the explicit deal-underwriting profile', () => {
    const parsed = file({}, { document_profile: 'deal-underwriting-v1' });
    expect(codes(parsed, 'CC-14')).toHaveLength(1);
  });

  it('is silent for a compiled UW Lite summary (precondition 1)', () => {
    const parsed = file({
      x_uw_lite_source: block('x_uw_lite_source', { representation: 'uw-lite-markdown' }),
    });
    expect(codes(parsed, 'CC-14')).toHaveLength(0);
  });

  it('never coincides with CC-13 — a missing section is one defect', () => {
    const result = validateUWFile(file({}, { deal_stage: 'full_underwrite' }));
    const emitted = result.issues.map((i) => i.code);
    expect(emitted).toContain('CC-14');
    expect(emitted).not.toContain('CC-13');
  });
});

describe('validateUWFile — DQ-06 declared-stage section gaps (RFC 0028)', () => {
  it('names each missing required section of the declared stage, at info', () => {
    const parsed = file(
      { property: block('property', { address: '1 Main St' }) },
      { deal_stage: 'screening' },
    );
    const found = codes(parsed, 'DQ-06');
    expect(found.map((i) => i.section).sort()).toEqual(['debt_structure', 'validation']);
    for (const issue of found) {
      expect(issue.severity).toBe('info');
      expect(issue.message).toContain('screening requires');
    }
    // info never degrades the verdict past what warnings already say
    expect(validateUWFile(parsed).overall_status).not.toBe('errors');
  });

  it('suppresses its property entry when CC-14 fired — one defect, one diagnostic', () => {
    const parsed = file({}, { deal_stage: 'screening' });
    expect(codes(parsed, 'CC-14')).toHaveLength(1);
    const sections = codes(parsed, 'DQ-06').map((i) => i.section);
    expect(sections).not.toContain('property');
    expect(sections).toContain('debt_structure');
  });

  it('still lists property when CC-14 was silenced by a precondition', () => {
    // A compiled Lite summary declaring a stage: CC-14 stays quiet, so the
    // stage-readiness gap on property is DQ-06's to report.
    const parsed = file(
      { x_uw_lite_source: block('x_uw_lite_source', { representation: 'uw-lite-markdown' }) },
      { deal_stage: 'screening' },
    );
    expect(codes(parsed, 'CC-14')).toHaveLength(0);
    expect(codes(parsed, 'DQ-06').map((i) => i.section)).toContain('property');
  });

  it('is silent when no deal_stage is declared — no claim to check', () => {
    expect(codes(file({}), 'DQ-06')).toHaveLength(0);
  });

  it('is silent for a fully stage-ready document', () => {
    const parsed = file(
      {
        property: block('property', { address: '1 Main St' }),
        debt_structure: block('debt_structure', { loan_amount: 1 }),
        validation: block('validation', {}),
      },
      { deal_stage: 'screening' },
    );
    expect(codes(parsed, 'DQ-06')).toHaveLength(0);
  });

  it('operating_statement is required at full_underwrite and counts through its t12 variant', () => {
    // RFC 0028 decision (a): §5.1 always listed operating_statement; the
    // stage table now checks it, and a multi-variant section satisfies it.
    expect(STAGE_REQUIREMENTS.full_underwrite.required_sections).toContain('operating_statement');
    const sections: Record<string, UWBlock> = {};
    for (const id of STAGE_REQUIREMENTS.full_underwrite.required_sections) {
      if (id !== 'operating_statement') sections[id] = block(id, {});
    }
    const missingOS = file(sections, { deal_stage: 'full_underwrite' });
    expect(codes(missingOS, 'DQ-06').map((i) => i.section)).toEqual(['operating_statement']);

    const withVariant = {
      ...sections,
      operating_statement: { t12: block('operating_statement', { egi: 1 }, { variant: 't12' }) },
    } as unknown as Record<string, UWBlock>;
    expect(codes(file(withVariant, { deal_stage: 'full_underwrite' }), 'DQ-06')).toHaveLength(0);
  });

  it('stage_readiness reflects the operating_statement requirement too', () => {
    const sections: Record<string, UWBlock> = {};
    for (const id of STAGE_REQUIREMENTS.full_underwrite.required_sections) {
      if (id !== 'operating_statement') sections[id] = block(id, {});
    }
    const readiness = validateUWFile(file(sections, { deal_stage: 'full_underwrite' })).stage_readiness;
    expect(readiness.full_underwrite).toBe(false);
  });
});

// ─── RFC 0029: class overlays ────────────────────────────────────────────────

describe('requiredSectionsFor — class overlays (RFC 0029)', () => {
  const STAGES = Object.keys(STAGE_REQUIREMENTS) as (keyof typeof STAGE_REQUIREMENTS)[];

  it('an unlisted or unrecognized class takes the base list verbatim, every stage', () => {
    for (const stage of STAGES) {
      const base = STAGE_REQUIREMENTS[stage].required_sections;
      expect(requiredSectionsFor(stage, 'office')).toEqual(base);
      expect(requiredSectionsFor(stage, 'data_center')).toEqual(base);
      expect(requiredSectionsFor(stage)).toEqual(base);
    }
  });

  it('land is exempt from rent_roll and operating_statement at every stage, and nothing stands in', () => {
    for (const stage of STAGES) {
      const resolved = requiredSectionsFor(stage, 'land');
      const base = STAGE_REQUIREMENTS[stage].required_sections;
      expect(resolved).not.toContain('rent_roll');
      expect(resolved).not.toContain('operating_statement');
      const exempted: string[] = base.filter((s) => s === 'rent_roll' || s === 'operating_statement');
      expect(resolved.length).toBe(base.length - exempted.length);
      expect(resolved).toEqual(base.filter((s) => !exempted.includes(s)));
    }
  });

  it('mixed_use substitutes components for both, required once (the dedup)', () => {
    const resolved = requiredSectionsFor('full_underwrite', 'mixed_use');
    expect(resolved).not.toContain('rent_roll');
    expect(resolved).not.toContain('operating_statement');
    expect(resolved.filter((s) => s === 'components')).toHaveLength(1);
    // two sections replaced, one substitute added
    expect(resolved.length).toBe(STAGE_REQUIREMENTS.full_underwrite.required_sections.length - 1);
  });

  it('a substitution is checkable: components is required where the replaced sections were', () => {
    // rent_roll enters the base lists at term_sheet, so the substitute must
    // be required from term_sheet up and absent below it.
    expect(requiredSectionsFor('screening', 'mixed_use')).not.toContain('components');
    expect(requiredSectionsFor('term_sheet', 'mixed_use')).toContain('components');
    expect(requiredSectionsFor('monitoring', 'mixed_use')).toContain('components');
  });

  it('property is never exempt or substituted for any class in the registry', () => {
    for (const overlay of Object.values(STAGE_SECTION_OVERLAYS)) {
      expect(overlay?.exempt ?? []).not.toContain('property');
      expect(Object.keys(overlay?.substitute ?? {})).not.toContain('property');
    }
  });
});

describe('DQ-06 and stage_readiness respect the overlays (RFC 0029)', () => {
  const landSections = (): Record<string, UWBlock> => {
    const sections: Record<string, UWBlock> = {};
    for (const id of requiredSectionsFor('full_underwrite', 'land')) sections[id] = block(id, {});
    return sections;
  };

  it('a land deal reaches full_underwrite without rent_roll or operating_statement', () => {
    const parsed = file(landSections(), { asset_class: 'land', deal_stage: 'full_underwrite' });
    expect(codes(parsed, 'DQ-06')).toHaveLength(0);
    expect(validateUWFile(parsed).stage_readiness.full_underwrite).toBe(true);
  });

  it('the same sections under an office class still owe rent_roll and operating_statement — no loophole', () => {
    const parsed = file(landSections(), { asset_class: 'office', deal_stage: 'full_underwrite' });
    const missing = codes(parsed, 'DQ-06').map((i) => i.section).sort();
    expect(missing).toEqual(['operating_statement', 'rent_roll']);
    expect(validateUWFile(parsed).stage_readiness.full_underwrite).toBe(false);
  });

  it('mixed_use: a present components section satisfies the substitution; an absent one is named', () => {
    const sections: Record<string, UWBlock> = {};
    for (const id of requiredSectionsFor('full_underwrite', 'mixed_use')) sections[id] = block(id, {});
    const satisfied = file(sections, { asset_class: 'mixed_use', deal_stage: 'full_underwrite' });
    expect(codes(satisfied, 'DQ-06')).toHaveLength(0);

    const { components: _dropped, ...withoutComponents } = sections;
    const missing = file(withoutComponents, { asset_class: 'mixed_use', deal_stage: 'full_underwrite' });
    const named = codes(missing, 'DQ-06').map((i) => i.section);
    expect(named).toEqual(['components']);
    expect(named).not.toContain('rent_roll');
  });

  it('CC-14 still fires on a property-less land deal — property is never exempt', () => {
    const parsed = file({}, { asset_class: 'land', deal_stage: 'scope' });
    expect(codes(parsed, 'CC-14')).toHaveLength(1);
  });
});
