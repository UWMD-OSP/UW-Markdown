// Capital-stack validation — CS-01 (structure), CS-02 (rate by class),
// CS-WATERFALL-UNSUPPORTED (deferred waterfall), and the generalized CC-03
// senior reconciliation. RFC 0026 / UW_FORMAT_SPEC §4.24.

import { describe, expect, it } from 'vitest';
import { BUILTIN_REMEDIATIONS } from './protocol.js';
import { validateUWFile } from './validator.js';
import type { ParsedUWFile, UWBlock } from './types.js';

function block(section: string, content: Record<string, unknown>): UWBlock {
  return {
    annotation: { section },
    content,
    meta: {
      section, version: 1, superseded: false, source: 'manual', agent_id: null, agent_version: null,
      actor: 'test', timestamp: '2026-08-20T00:00:00Z', confidence: 'high', human_review_required: false,
      flags: [], input_hash: null, notes: null,
    },
    prose: '', rawJson: JSON.stringify(content), lineStart: 1, lineEnd: 1,
  };
}

function file(sections: Record<string, UWBlock>): ParsedUWFile {
  return {
    frontmatter: { asset_class: 'multifamily' } as ParsedUWFile['frontmatter'],
    sections, prose: {}, pipeline_log: [], custom_calculations: [], custom_scenarios: [],
    extensions: {}, superseded: {}, raw: '',
  };
}

const codes = (parsed: ParsedUWFile): string[] => validateUWFile(parsed).issues.map((i) => i.code);

// A well-formed two-tranche stack that trips none of the rules.
const goodStack = () =>
  block('capital_stack', {
    tranches: [
      { id: 'senior', class: 'senior_debt', position: 1, amount: 20_000_000, rate: 0.05 },
      { id: 'mezz', class: 'mezzanine_debt', position: 2, amount: 5_000_000, rate: 0.1 },
      { id: 'common', class: 'common_equity', position: 3, amount: 5_000_000 },
    ],
  });

describe('validateUWFile — capital stack (RFC 0026)', () => {
  it('a well-formed stack trips none of the capital-stack rules', () => {
    const emitted = codes(file({ capital_stack: goodStack() }));
    for (const c of ['CS-01', 'CS-02', 'CS-WATERFALL-UNSUPPORTED', 'CC-03']) {
      expect(emitted, c).not.toContain(c);
    }
  });

  it('CS-01: a tranche missing required fields', () => {
    const parsed = file({
      capital_stack: block('capital_stack', {
        tranches: [
          { id: 'senior', class: 'senior_debt', position: 1 }, // no amount
          { id: 'mezz', class: 'mezzanine_debt', position: 2, amount: 5_000_000, rate: 0.1 },
        ],
      }),
    });
    expect(codes(parsed)).toContain('CS-01');
  });

  it('CS-01: duplicate ids and duplicate positions', () => {
    const dupId = file({
      capital_stack: block('capital_stack', {
        tranches: [
          { id: 'a', class: 'senior_debt', position: 1, amount: 1, rate: 0.05 },
          { id: 'a', class: 'mezzanine_debt', position: 2, amount: 1, rate: 0.1 },
        ],
      }),
    });
    expect(codes(dupId)).toContain('CS-01');

    const dupPos = file({
      capital_stack: block('capital_stack', {
        tranches: [
          { id: 'a', class: 'senior_debt', position: 1, amount: 1, rate: 0.05 },
          { id: 'b', class: 'mezzanine_debt', position: 1, amount: 1, rate: 0.1 },
        ],
      }),
    });
    expect(codes(dupPos)).toContain('CS-01');
  });

  it('CS-01: an invalid tranche class', () => {
    const parsed = file({
      capital_stack: block('capital_stack', {
        tranches: [
          { id: 'a', class: 'crypto_token', position: 1, amount: 1, rate: 0.05 },
          { id: 'b', class: 'common_equity', position: 2, amount: 1 },
        ],
      }),
    });
    expect(codes(parsed)).toContain('CS-01');
  });

  it('CS-02: a debt tranche omits its rate', () => {
    const parsed = file({
      capital_stack: block('capital_stack', {
        tranches: [
          { id: 'senior', class: 'senior_debt', position: 1, amount: 20_000_000 }, // no rate
          { id: 'common', class: 'common_equity', position: 2, amount: 5_000_000 },
        ],
      }),
    });
    const issue = validateUWFile(parsed).issues.find((i) => i.code === 'CS-02');
    expect(issue).toBeDefined();
    expect(issue!.field).toBe('senior.rate');
  });

  it('CS-02: a common-equity tranche states a rate', () => {
    const parsed = file({
      capital_stack: block('capital_stack', {
        tranches: [
          { id: 'senior', class: 'senior_debt', position: 1, amount: 20_000_000, rate: 0.05 },
          { id: 'common', class: 'common_equity', position: 2, amount: 5_000_000, rate: 0.2 },
        ],
      }),
    });
    expect(codes(parsed)).toContain('CS-02');
  });

  it('CS-WATERFALL-UNSUPPORTED: a section-level distribution waterfall is refused', () => {
    const parsed = file({
      capital_stack: block('capital_stack', {
        tranches: [
          { id: 'senior', class: 'senior_debt', position: 1, amount: 1, rate: 0.05 },
          { id: 'common', class: 'common_equity', position: 2, amount: 1 },
        ],
        promote: { hurdle: 0.08, split: 0.2 },
      }),
    });
    const issue = validateUWFile(parsed).issues.find((i) => i.code === 'CS-WATERFALL-UNSUPPORTED');
    expect(issue).toBeDefined();
    expect(issue!.field).toBe('promote');
  });

  it('CS-WATERFALL-UNSUPPORTED: a waterfall smuggled onto a tranche is refused', () => {
    const parsed = file({
      capital_stack: block('capital_stack', {
        tranches: [
          { id: 'senior', class: 'senior_debt', position: 1, amount: 1, rate: 0.05 },
          { id: 'pref', class: 'preferred_equity', position: 2, amount: 1, rate: 0.09, catch_up: 1.0 },
        ],
      }),
    });
    const issue = validateUWFile(parsed).issues.find((i) => i.code === 'CS-WATERFALL-UNSUPPORTED');
    expect(issue).toBeDefined();
    expect(issue!.field).toBe('pref.catch_up');
  });

  it('CC-03: the senior tranche must reconcile with debt_structure', () => {
    const mismatch = file({
      capital_stack: goodStack(),
      debt_structure: block('debt_structure', { loan_amount: 18_000_000 }),
    });
    const issue = validateUWFile(mismatch).issues.find(
      (i) => i.code === 'CC-03' && i.section === 'capital_stack',
    );
    expect(issue).toBeDefined();

    const matched = file({
      capital_stack: goodStack(),
      debt_structure: block('debt_structure', { loan_amount: 20_000_000 }),
    });
    expect(
      validateUWFile(matched).issues.filter((i) => i.code === 'CC-03'),
    ).toHaveLength(0);
  });

  it('every new code has a BUILTIN_REMEDIATIONS entry', () => {
    for (const c of ['CS-01', 'CS-02', 'CS-WATERFALL-UNSUPPORTED']) {
      expect(BUILTIN_REMEDIATIONS.find((r) => r.code === c), c).toBeDefined();
    }
  });
});
