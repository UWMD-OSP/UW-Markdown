import { describe, expect, it } from 'vitest';
import { BUILTIN_REMEDIATIONS, DEFAULT_RETURN_TAX_BASIS, RETURN_TAX_BASES, validatorCodeFamily } from './protocol.js';
import { getReturnTaxBasis, validateUWFile } from './validator.js';
import type { ParsedUWFile, UWBlock } from './types.js';

function block(section: string, content: Record<string, unknown>): UWBlock {
  return {
    annotation: { section },
    content,
    meta: {
      section, version: 1, superseded: false, source: 'manual', agent_id: null, agent_version: null,
      actor: 'test', timestamp: '2026-09-09T00:00:00Z', confidence: 'high', human_review_required: false,
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

describe('dcf.returns.tax_basis (RFC 0038)', () => {
  it('registers the closed set, the default, and the RT family', () => {
    expect(RETURN_TAX_BASES).toEqual(['pre_tax', 'after_tax']);
    expect(DEFAULT_RETURN_TAX_BASIS).toBe('pre_tax');
    expect(validatorCodeFamily('RT-01')?.prefix).toBe('RT');
  });

  it('defaults to pre_tax when the field, the returns object, or the dcf section is absent', () => {
    expect(getReturnTaxBasis(file({}))).toBe('pre_tax');
    expect(getReturnTaxBasis(file({ dcf: block('dcf', {}) }))).toBe('pre_tax');
    expect(getReturnTaxBasis(file({ dcf: block('dcf', { returns: { levered_irr: 0.14 } }) }))).toBe('pre_tax');
    expect(validateUWFile(file({ dcf: block('dcf', { returns: { levered_irr: 0.14 } }) })).issues.find((i) => i.code === 'RT-01')).toBeUndefined();
  });

  it('accepts both registered values and reports them', () => {
    for (const basis of RETURN_TAX_BASES) {
      const parsed = file({ dcf: block('dcf', { returns: { levered_irr: 0.14, tax_basis: basis } }) });
      expect(getReturnTaxBasis(parsed)).toBe(basis);
      expect(validateUWFile(parsed).issues.find((i) => i.code === 'RT-01')).toBeUndefined();
    }
  });

  it('rejects an unregistered value as RT-01 with the registry copy, and reports the default', () => {
    const parsed = file({ dcf: block('dcf', { returns: { levered_irr: 0.14, tax_basis: 'post_tax' } }) });
    const result = validateUWFile(parsed);
    const issue = result.issues.find((i) => i.code === 'RT-01');
    expect(issue).toMatchObject({ severity: 'error', section: 'dcf', field: 'returns.tax_basis', value: 'post_tax' });
    const remediation = BUILTIN_REMEDIATIONS.find((r) => r.code === 'RT-01');
    expect(remediation).toBeDefined();
    expect(issue!.title).toBe(remediation!.title);
    expect(result.overall_status).toBe('errors');
    expect(getReturnTaxBasis(parsed)).toBe('pre_tax');
  });

  it('rejects a non-string value the same way', () => {
    const parsed = file({ dcf: block('dcf', { returns: { tax_basis: 1 } }) });
    expect(validateUWFile(parsed).issues.find((i) => i.code === 'RT-01')).toBeDefined();
  });
});
