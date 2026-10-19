import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { DEFAULT_THRESHOLDS, parseUWFile, validateUWFile } from '@uwmd/verify';
import { describe, expect, it, vi } from 'vitest';
import { institutionThresholds, loadInstitutionThresholds } from './institution-config.js';

describe('documented institution threshold adapter', () => {
  it.each([
    ['dscr_warning_below', 'dscr', 'warning_below', 1.25],
    ['ltv_warning_above', 'ltv', 'warning_above', .70],
    ['debt_yield_warning_below', 'debt_yield', 'warning_below', .09],
  ] as const)('maps %s with fresh bands and untouched limits', (key, metric, field, value) => {
    const before = structuredClone(DEFAULT_THRESHOLDS);
    const input = { validation_overrides: { [key]: value } };
    const first = institutionThresholds(input)!;
    expect(first).toEqual({ [metric]: { ...DEFAULT_THRESHOLDS[metric], [field]: value } });
    expect(first[metric]).not.toBe(DEFAULT_THRESHOLDS[metric]);
    expect(first[metric]).not.toBe(institutionThresholds(input)![metric]);
    expect(DEFAULT_THRESHOLDS).toEqual(before);
  });
  it('maps only documented own numeric leaves, without a nested wire alias', () => {
    expect(institutionThresholds({ thresholds: { dscr: { warning_below: 2 } } })).toBeUndefined();
    expect(institutionThresholds({ validation_overrides: { dscr_error_below: 2 } })).toBeUndefined();
    expect(institutionThresholds({ validation_overrides: Object.create({ dscr_warning_below: 2 }) })).toBeUndefined();
    for (const value of [null, true, '1.25', Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(institutionThresholds({ validation_overrides: { dscr_warning_below: value } })).toBeUndefined();
    }
    // These observations bound the mapper, not normative malformed-config verdicts.
  });
  it('selects one explicit or adjacent file without changing their bytes', () => {
    const directory = mkdtempSync(resolve(tmpdir(), 'uwmd institution adapter '));
    const adjacent = resolve(directory, '.uw.institution.json');
    const explicit = resolve(directory, 'explicit.json');
    const file = resolve(directory, 'deal.uwx.md');
    try {
      expect(loadInstitutionThresholds(file)).toBeUndefined();
      const a = JSON.stringify({ validation_overrides: { dscr_warning_below: 1.25 } });
      const e = JSON.stringify({ validation_overrides: { ltv_warning_above: .7 } });
      writeFileSync(adjacent, a); writeFileSync(explicit, e);
      expect(loadInstitutionThresholds(file)).toEqual({ dscr: { error_below: 1, warning_below: 1.25 } });
      expect(loadInstitutionThresholds(file, explicit)).toEqual({ ltv: { warning_above: .7, error_above: .85 } });
      expect(readFileSync(adjacent, 'utf8')).toBe(a); expect(readFileSync(explicit, 'utf8')).toBe(e);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it('preserves existing malformed explicit warning transport without allocating a code', () => {
    const directory = mkdtempSync(resolve(tmpdir(), 'uwmd-institution-warning-'));
    const file = resolve(directory, 'bad.json');
    const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      writeFileSync(file, '{');
      expect(loadInstitutionThresholds(resolve(directory, 'deal.uwx.md'), file)).toBeUndefined();
      expect(warning).toHaveBeenCalledExactlyOnceWith(`Warning: could not load institution config: ${file}`);
    } finally { warning.mockRestore(); rmSync(directory, { recursive: true, force: true }); }
  });
  it('keeps pure API threshold parameters and later default validation independent', () => {
    const source = '---\nuw_version: "3.0"\nasset_class: multifamily\ndeal_id: institution-api\nquick_metrics:\n  dscr: 1.25\n---\n';
    const model = parseUWFile(source);
    const mapped = institutionThresholds({ validation_overrides: { dscr_warning_below: 1.3 } });
    expect(validateUWFile(model, mapped).issues.some(i => i.code === 'FV-04')).toBe(true);
    expect(validateUWFile(source).issues.some(i => i.code === 'FV-04')).toBe(false);
    expect(DEFAULT_THRESHOLDS.dscr).toEqual({ error_below: 1, warning_below: 1.2 });
  });
});
