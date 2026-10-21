// The asset-class identifier checks inside `validateUWFile` (RFC 0003).
//
// Deliberately narrow. Whether a custom class can be *resolved* depends on
// which modules a host has loaded, and a validator that reported the same file
// as valid or invalid depending on who ran it would be worse than useless.
// What is checked here is the part that is true everywhere: the syntax, and
// the obligation a namespaced class carries to name the modules it needs.

import { describe, expect, it } from 'vitest';
import { validateUWFile } from './validator.js';
import type { ParsedUWFile, ValidationMessage } from './types.js';

function file(assetClass: unknown, frontmatterExtra: Record<string, unknown> = {}): ParsedUWFile {
  return {
    frontmatter: { asset_class: assetClass, ...frontmatterExtra } as ParsedUWFile['frontmatter'],
    sections: {},
    prose: {},
    pipeline_log: [],
    custom_calculations: [],
    custom_scenarios: [],
    extensions: {},
    superseded: {},
    raw: '',
  };
}

const find = (parsed: ParsedUWFile, code: string): ValidationMessage | undefined =>
  validateUWFile(parsed).issues.find((i) => i.code === code);

describe('validateUWFile — asset-class identifiers (RFC 0003)', () => {
  it('says nothing about a builtin', () => {
    const issues = validateUWFile(file('multifamily')).issues;
    expect(issues.some((i) => i.code.startsWith('INVALID-ASSET-CLASS'))).toBe(false);
    expect(issues.some((i) => i.code === 'MOD-DEPENDENCY-UNDECLARED')).toBe(false);
  });

  it('reports an unnamespaced unknown class as an error', () => {
    const issue = find(file('specialty_facility'), 'INVALID-ASSET-CLASS-001');
    expect(issue?.severity).toBe('error');
    expect(issue?.field).toBe('asset_class');
    expect(issue?.value).toBe('specialty_facility');
  });

  it('reports a namespaced class shadowing a builtin', () => {
    expect(find(file('com.example.retail'), 'INVALID-ASSET-CLASS-002')?.severity).toBe('error');
  });

  it('accepts a well-formed custom class that names its modules', () => {
    const parsed = file('com.example.specialty_facility', {
      modules: [{ id: 'com.example.datacenters', version: '>=0.1.0 <1.0.0' }],
    });
    const issues = validateUWFile(parsed).issues;
    expect(issues.some((i) => i.code.startsWith('INVALID-ASSET-CLASS'))).toBe(false);
    expect(issues.some((i) => i.code === 'MOD-DEPENDENCY-UNDECLARED')).toBe(false);
  });

  it('warns when a custom class names no modules', () => {
    // A file that states a dependency it never names is unreadable by anyone
    // who does not already happen to hold the right module. A warning, not an
    // error: the document is well-formed, and a host that does hold the module
    // reads it correctly — the cost falls on everyone else.
    const issue = find(file('com.example.specialty_facility'), 'MOD-DEPENDENCY-UNDECLARED');
    expect(issue?.severity).toBe('warning');
    expect(issue?.field).toBe('modules');
  });

  it('reads only the object-list spelling of the modules list (RFC 0081 §5)', () => {
    const bare = file('com.example.specialty_facility', { modules: ['com.example.datacenters'] });
    expect(find(bare, 'MOD-DEPENDENCY-UNDECLARED')).toBeDefined();
    const listed = file('com.example.specialty_facility', { modules: [{ id: 'com.example.datacenters' }] });
    expect(find(listed, 'MOD-DEPENDENCY-UNDECLARED')).toBeUndefined();
    const markdown = file('com.example.specialty_facility', { modules: ['id: com.example.datacenters'] });
    expect(find(markdown, 'MOD-DEPENDENCY-UNDECLARED')).toBeUndefined();
  });

  it('reports each modules entry that names no module, whatever the class', () => {
    // A bare id beside a valid entry would otherwise vanish silently.
    const mixed = file('multifamily', { modules: [{ id: 'com.example.x' }, 'com.example.bare', 7] });
    const issues = validateUWFile(mixed).issues.filter((i) => i.code === 'MOD-DEPENDENCY-UNDECLARED');
    expect(issues.map((i) => [i.field, i.severity, i.value])).toEqual([
      ['modules[1]', 'warning', 'com.example.bare'],
      ['modules[2]', 'warning', 7],
    ]);
  });

  it('does not warn about modules on a file whose class is malformed', () => {
    // One finding per problem: telling an author to add a `modules` list for a
    // class that cannot exist sends them to fix the wrong thing.
    const parsed = file('DataCenter');
    expect(find(parsed, 'INVALID-ASSET-CLASS-001')).toBeDefined();
    expect(find(parsed, 'MOD-DEPENDENCY-UNDECLARED')).toBeUndefined();
  });

  it('ignores a missing or null asset_class rather than reporting a syntax error', () => {
    // Absence is a different defect, reported by the frontmatter checks. A
    // syntax complaint about a field that is not there would be noise.
    expect(find(file(undefined), 'INVALID-ASSET-CLASS-001')).toBeUndefined();
    expect(find(file(null), 'INVALID-ASSET-CLASS-001')).toBeUndefined();
  });

  it('reports a present non-string or empty asset_class (#427)', () => {
    // A value that is there but is no identifier would otherwise validate
    // clean while every class-scoped rule and metric is skipped.
    for (const value of [42, 1.5, true, false, [], {}, '']) {
      const issue = find(file(value), 'INVALID-ASSET-CLASS-001');
      expect(issue?.severity, JSON.stringify(value)).toBe('error');
      expect(issue?.value, JSON.stringify(value)).toEqual(value);
    }
  });
});
