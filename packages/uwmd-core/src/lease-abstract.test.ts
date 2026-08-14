// lease-abstract-v1 tests (RFC 0018 §2).

import { describe, expect, it } from 'vitest';
import {
  LeaseAbstractError,
  assertLeaseAbstract,
  projectLeaseAbstractToRentRoll,
  validateLeaseAbstract,
  type LeaseAbstract,
} from './lease-abstract.js';

function baseAbstract(): LeaseAbstract {
  return {
    document_id: 'doc:anchor',
    lease_id: 'lease:anchor',
    artifact_kind: 'executed_lease',
    tenant: 'Anchor Tenant LLC',
    premises: 'Suite 210',
    governing_documents: ['source:anchor-lease'],
    lease_context: {
      suite: { value: '210', source_ref: { source: 'source:anchor-lease', locator: '§1.1, p. 2' } },
    },
    lease_term: {
      commencement: { value: '2024-03-01', source_ref: { source: 'source:anchor-lease', locator: '§2.1' } },
      expiration: { value: '2034-02-28', source_ref: { source: 'source:anchor-lease', locator: '§2.1' } },
    },
    lease_economics: {
      base_rent_annual: { value: 184800, source_ref: { source: 'source:anchor-lease', locator: '§4.1' } },
    },
  };
}

describe('validateLeaseAbstract', () => {
  it('accepts a fully sourced abstract', () => {
    expect(validateLeaseAbstract(baseAbstract())).toEqual([]);
  });

  it('requires an artifact kind that distinguishes a lease from a proposal', () => {
    const a = { ...baseAbstract(), artifact_kind: 'something' as never };
    expect(validateLeaseAbstract(a).some((e) => e.code === 'LEASE-003')).toBe(true);
  });

  it('requires at least one governing document', () => {
    const a = { ...baseAbstract(), governing_documents: [] };
    expect(validateLeaseAbstract(a).some((e) => e.code === 'LEASE-004')).toBe(true);
  });

  // The rule that stops silent invention: null must say why.
  it('rejects a null term with no status', () => {
    const a = baseAbstract();
    a.lease_credit = { guaranty: { value: null } };
    const errors = validateLeaseAbstract(a);
    expect(errors.some((e) => e.code === 'LEASE-008')).toBe(true);
  });

  it('accepts a null term carrying an explicit status', () => {
    const a = baseAbstract();
    a.lease_credit = { guaranty: { value: null, status: 'not_stated' } };
    expect(validateLeaseAbstract(a)).toEqual([]);
  });

  it('rejects a status on a non-null term', () => {
    const a = baseAbstract();
    a.lease_credit = {
      guaranty: {
        value: 'full',
        status: 'ambiguous',
        source_ref: { source: 'source:anchor-lease', locator: '§9' },
      },
    };
    expect(validateLeaseAbstract(a).some((e) => e.code === 'LEASE-009')).toBe(true);
  });

  it('requires a source_ref on every asserted term', () => {
    const a = baseAbstract();
    a.lease_economics = { base_rent_annual: { value: 184800 } };
    expect(validateLeaseAbstract(a).some((e) => e.code === 'LEASE-010')).toBe(true);
  });

  it('requires a locator, not just a source', () => {
    const a = baseAbstract();
    a.lease_economics = {
      base_rent_annual: { value: 184800, source_ref: { source: 'source:anchor-lease', locator: '' } },
    };
    expect(validateLeaseAbstract(a).some((e) => e.code === 'LEASE-012')).toBe(true);
  });

  it('throws a typed error from the assert helper', () => {
    expect(() => assertLeaseAbstract({})).toThrow(LeaseAbstractError);
  });
});

describe('projectLeaseAbstractToRentRoll', () => {
  it('projects unambiguous current facts and reports lossiness', () => {
    const { row, report } = projectLeaseAbstractToRentRoll(baseAbstract());
    expect(row).toMatchObject({
      tenant: 'Anchor Tenant LLC',
      unit_id: '210',
      base_rent_annual: 184800,
    });
    expect(report.lossy).toBe(true);
    expect(report.profile).toBe('rent-roll-v1');
  });

  it('refuses to project anything but an executed lease', () => {
    const { row, report } = projectLeaseAbstractToRentRoll({
      ...baseAbstract(),
      artifact_kind: 'proposal',
    });
    expect(row).toBeNull();
    expect(report.omitted[0]?.reason).toContain('proposal');
  });

  // An ambiguous term is a conflict for a human; a merely unstated one is an
  // omission. Collapsing them would hide a disagreement between documents.
  it('separates ambiguous conflicts from plain omissions', () => {
    const a = baseAbstract();
    a.lease_economics = { base_rent_annual: { value: null, status: 'ambiguous' } };
    a.lease_term = { commencement: { value: null, status: 'not_stated' } };

    const { row, report } = projectLeaseAbstractToRentRoll(a);
    expect(report.conflicts.some((c) => c.term === 'lease_economics.base_rent_annual')).toBe(true);
    expect(report.omitted.some((o) => o.term === 'lease_term.commencement')).toBe(true);
    expect(row).not.toHaveProperty('base_rent_annual');
  });

  it('never computes a rent figure it was not given', () => {
    const a = baseAbstract();
    // Monthly rent present, annual absent. A projection must not annualize.
    a.lease_economics = {
      base_rent_monthly: { value: 15400, source_ref: { source: 'source:anchor-lease', locator: '§4.1' } },
    };
    const { row, report } = projectLeaseAbstractToRentRoll(a);
    expect(row).not.toHaveProperty('base_rent_annual');
    expect(report.omitted.some((o) => o.term === 'lease_economics.base_rent_annual')).toBe(true);
  });
});
