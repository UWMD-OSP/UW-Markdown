import { describe, expect, it } from 'vitest';
import {
  BUILTIN_INCOMPLETE_DATA_POLICIES,
  CASCADE_ORDER,
  SOURCE_TAGS,
  lookupIncompleteDataPolicy,
  PROTOCOL_VERSION,
} from './protocol.js';

describe('protocol — CASCADE_ORDER', () => {
  it('lists exactly the seven cascade steps in the documented order', () => {
    expect([...CASCADE_ORDER]).toEqual([
      'user_override',
      'user_input',
      'investor_profile',
      'market_data',
      'asset_class_default',
      'global_default',
      'system_default',
    ]);
  });

  it('every cascade step is present in SOURCE_TAGS', () => {
    for (const step of CASCADE_ORDER) {
      expect(SOURCE_TAGS).toContain(step);
    }
  });
});

describe('protocol — lookupIncompleteDataPolicy', () => {
  it('returns null when no policy matches', () => {
    expect(lookupIncompleteDataPolicy('not-a-section', undefined, 'scope')).toBeNull();
  });

  it('matches section + stage', () => {
    const p = lookupIncompleteDataPolicy('rent_roll', undefined, 'scope');
    expect(p?.action.kind).toBe('substitute');
  });

  it('returns halt for full_underwrite rent_roll', () => {
    const p = lookupIncompleteDataPolicy('rent_roll', undefined, 'full_underwrite');
    expect(p?.action.kind).toBe('halt');
  });

  it('field-specific policy beats section-level when both match', () => {
    const p = lookupIncompleteDataPolicy('noi_model', 'expense_ratio', 'scope');
    expect(p?.field_path).toBe('expense_ratio');
    expect(p?.action.kind).toBe('substitute');
  });

  it('section-level policy still applies when no field-specific match exists', () => {
    const p = lookupIncompleteDataPolicy('noi_model', 'some_other_field', 'scope');
    expect(p?.field_path).toBeUndefined();
    expect(p?.action.kind).toBe('substitute');
  });

  it('explicit stage match wins over wildcard stage', () => {
    const policies = [
      { section: 'foo', action: { kind: 'defer' as const } },
      { section: 'foo', stage: 'scope' as const, action: { kind: 'halt' as const } },
    ];
    const hit = lookupIncompleteDataPolicy('foo', undefined, 'scope', policies);
    expect(hit?.action.kind).toBe('halt');
  });

  it('all builtin policies reference a real section name', () => {
    for (const p of BUILTIN_INCOMPLETE_DATA_POLICIES) {
      expect(p.section.length).toBeGreaterThan(0);
    }
  });
});

describe('protocol — representation discovery', () => {
  it('publishes protocol 1.2 for representation capabilities', () => {
    expect(PROTOCOL_VERSION).toBe('1.3.0');
  });
});