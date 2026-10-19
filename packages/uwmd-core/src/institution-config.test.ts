import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, relative } from 'node:path';
import { DEFAULT_THRESHOLDS, parseUWFile, validateUWFile } from '@uwmd/verify';
import { describe, expect, it, vi } from 'vitest';
import { InstitutionConfigError, loadInstitutionThresholds, parseInstitutionThresholds, type InstitutionFileIO } from './institution-config.js';

const bytes = (text: string) => new TextEncoder().encode(text);
const parse = (text: string) => parseInstitutionThresholds(bytes(text));
function refusal(run: () => unknown, code = 'MALFORMED', pointer?: string): void {
  let observed: unknown;
  try { run(); } catch (error) { observed = error; }
  expect(observed).toBeInstanceOf(InstitutionConfigError);
  const error = observed as InstitutionConfigError;
  expect(error.proto).toEqual({ category: 'validate', code: `VAL-INSTITUTION-CONFIG-${code}`, message: code === 'MALFORMED' ? 'Selected institution config is malformed.' : 'Selected institution config could not be read.', ...(pointer === undefined ? {} : { pointer }) });
  expect(error.code).toBe(error.proto.code);
  expect(error.message).toBe(error.proto.message);
  expect(Object.hasOwn(error, 'cause')).toBe(false);
}
function fsError(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error('private raw path and bytes must never leak'), { code, syscall: 'read' });
}

describe('RFC0097 whole-byte and whole-JSON profile', () => {
  it.each(['', '{', '{} {}', '{}x', '{}\u00a0', '//comment\n{}', '{"x":undefined}', '{"x":NaN}', '{"x":Infinity}', '{"x":01}', '{"x":1,}'])('refuses whole syntax without pointer: %j', text => refusal(() => parse(text)));
  it.each([
    [0xef, 0xbb, 0xbf, 0x7b, 0x7d], [0xff], [0xc0, 0xaf], [0xed, 0xa0, 0x80],
    [0xf4, 0x90, 0x80, 0x80], [0xe2, 0x82], [0x7b, 0x22, 0xff, 0x22, 0x3a, 0x31, 0x7d],
  ].map(octets => ({ octets })))('refuses BOM/invalid UTF8 bytes (%#)', ({ octets }) => refusal(() => parseInstitutionThresholds(Uint8Array.from(octets))));
  it.each([
    '{"a":1,"a":2}', String.raw`{"a":1,"\u0061":2}`, '{"opaque":[{"x":1,"x":2}]}',
    String.raw`{"validation_overrides":{"dscr_warning_below":1,"\u0064scr_warning_below":2}}`,
    '{"opaque":{"nested":{"a":1,"a":2}}}',
  ])('refuses decoded duplicate names in every object (%#)', text => refusal(() => parse(text)));
  it.each([
    String.raw`{"opaque":"\ud800"}`, String.raw`{"opaque":"\udfff"}`, String.raw`{"\ud800":1}`,
    String.raw`{"opaque":["\ud800","\udc00"]}`, String.raw`{"opaque":"\ud800x"}`,
    String.raw`{"thresholds":null,"opaque":"\ud800"}`,
  ])('whole Unicode profile precedes shape (%#)', text => refusal(() => parse(text)));
  it.each([
    '{}', ' \r\n\t{}\t\r\n ', '{"opaque":1e309}', String.raw`{"opaque":"\ud83d\ude00"}`,
    '{"opaque":"😀"}', String.raw`{"opaque":"\ufffd\uffff\ufeff"}`, String.raw`{"opaque":"\u0000"}`,
    '{"a":{"x":1},"b":{"x":2}}', String.raw`{"é":1,"e\u0301":2}`,
    JSON.stringify({ opaque: 'escaped quote " braces {} colon: [ ]' }),
    '{"nested":{"validation_overrides":null,"thresholds":true}}',
    '{"validation_overrides":{"unknown":1e309,"nested":{"dscr_warning_below":null}}}',
  ])('admits opaque data without normalization or accidental application (%#)', text => expect(parse(text)).toBeUndefined());
  it('walks deeply nested opaque objects/arrays iteratively without a policy depth cap', () => {
    const text = `{"opaque":${'['.repeat(12000)}0${']'.repeat(12000)}}`;
    expect(parse(text)).toBeUndefined();
  });
  it('does not reclassify unrelated internal exceptions as malformed config', () => {
    const bug = new RangeError('internal test sentinel');
    const spy = vi.spyOn(JSON, 'parse').mockImplementation(() => { throw bug; });
    try { expect(() => parse('{}')).toThrow(bug); } finally { spy.mockRestore(); }
  });
});

describe('RFC0097 closed atomic shape and precedence', () => {
  it.each(['null', '[]', '1', 'true', '"root"'])('rejects nonobject root %s', text => refusal(() => parse(text)));
  it.each(['null', 'false', '1', '"nested"', '[]', '{}'])('rejects own noncanonical thresholds regardless of value %s', raw => refusal(() => parse(`{"validation_overrides":null,"thresholds":${raw}}`), 'MALFORMED', 'thresholds'));
  it.each(['null', 'false', '1', '"x"', '[]'])('rejects present nonobject carrier %s', raw => refusal(() => parse(`{"validation_overrides":${raw}}`), 'MALFORMED', 'validation_overrides'));
  it.each(['dscr_warning_below', 'ltv_warning_above', 'debt_yield_warning_below'])('rejects every invalid recognized %s leaf without coercion', key => {
    for (const raw of ['null', 'true', 'false', '"1.2"', '[]', '{}', '1e309', '-1e309']) {
      refusal(() => parse(`{"validation_overrides":{"${key}":${raw}}}`), 'MALFORMED', `validation_overrides.${key}`);
    }
  });
  it('uses fixed diagnostic order and no partial map for invalid recognized siblings', () => {
    const before = structuredClone(DEFAULT_THRESHOLDS);
    refusal(() => parse('{"validation_overrides":{"debt_yield_warning_below":null,"ltv_warning_above":true,"dscr_warning_below":"bad"}}'), 'MALFORMED', 'validation_overrides.dscr_warning_below');
    refusal(() => parse('{"validation_overrides":{"dscr_warning_below":1.108,"ltv_warning_above":"bad"}}'), 'MALFORMED', 'validation_overrides.ltv_warning_above');
    expect(DEFAULT_THRESHOLDS).toEqual(before);
  });
  it.each([
    ['dscr_warning_below', 'dscr', 'warning_below'], ['ltv_warning_above', 'ltv', 'warning_above'],
    ['debt_yield_warning_below', 'debt_yield', 'warning_below'],
  ] as const)('maps finite %s only, with detached bands and unchanged error limits', (key, metric, member) => {
    for (const value of [-10, -0, 0, .123, Number.MAX_VALUE, Number.MIN_VALUE, 9007199254740992]) {
      const before = structuredClone(DEFAULT_THRESHOLDS);
      const text = `{"validation_overrides":{"${key}":${Object.is(value, -0) ? '-0' : value}}}`;
      const first = parse(text)!;
      expect(first).toEqual({ [metric]: { ...DEFAULT_THRESHOLDS[metric], [member]: value } });
      expect(first[metric]).not.toBe(DEFAULT_THRESHOLDS[metric]);
      expect(first[metric]).not.toBe(parse(text)![metric]);
      expect(DEFAULT_THRESHOLDS).toEqual(before);
    }
  });
  it('admits empty and absent carrier, opaque keys and all three finite leaves atomically', () => {
    expect(parse('{}')).toBeUndefined();
    expect(parse('{"validation_overrides":{}}')).toBeUndefined();
    const actual = parse('{"institution_id":"opaque","validation_overrides":{"dscr_warning_below":1.3,"ltv_warning_above":0.7,"debt_yield_warning_below":0.09,"unallocated":true}}');
    expect(actual).toEqual({ dscr: { ...DEFAULT_THRESHOLDS.dscr, warning_below: 1.3 }, ltv: { ...DEFAULT_THRESHOLDS.ltv, warning_above: .7 }, debt_yield: { ...DEFAULT_THRESHOLDS.debt_yield, warning_below: .09 } });
  });
});

describe('RFC0097 read selection and absence', () => {
  const file = resolve(tmpdir(), 'records', 'link.uwx.md');
  it('reads first and defaults only for actual automatic ENOENT plus absent entry', () => {
    const calls: string[] = [];
    const io: InstitutionFileIO = { read: path => { calls.push(`read:${path}`); throw fsError('ENOENT'); }, lstat: path => { calls.push(`lstat:${path}`); throw fsError('ENOENT'); } };
    expect(loadInstitutionThresholds(file, undefined, io)).toBeUndefined();
    const selected = resolve(tmpdir(), 'records', '.uw.institution.json');
    expect(calls).toEqual([`read:${selected}`, `lstat:${selected}`]);
  });
  it.each(['EACCES', 'EPERM', 'EISDIR', 'EIO', 'ENOTDIR', 'ELOOP'])('classifies actual %s read failure without absence fallback', code => {
    const io: InstitutionFileIO = { read: () => { throw fsError(code); }, lstat: () => { throw new Error('must not inspect'); } };
    refusal(() => loadInstitutionThresholds(file, undefined, io), 'UNREADABLE');
  });
  it('explicit missing path never falls back or inspects adjacency', () => {
    const selected: string[] = [];
    const io: InstitutionFileIO = { read: path => { selected.push(path); throw fsError('ENOENT'); }, lstat: () => { throw new Error('must not inspect explicit absence'); } };
    refusal(() => loadInstitutionThresholds(file, 'relative config.json', io), 'UNREADABLE');
    expect(selected).toEqual([resolve('relative config.json')]);
  });
  it('rejects automatic dangling link/present entry after ENOENT and inspection denial', () => {
    for (const outcome of [{ isSymbolicLink: () => true }, { isSymbolicLink: () => false }]) {
      refusal(() => loadInstitutionThresholds(file, undefined, { read: () => { throw fsError('ENOENT'); }, lstat: () => outcome }), 'UNREADABLE');
    }
    refusal(() => loadInstitutionThresholds(file, undefined, { read: () => { throw fsError('ENOENT'); }, lstat: () => { throw fsError('EACCES'); } }), 'UNREADABLE');
  });
  it('uses successful bytes without a racy pre-check or post-read re-selection', () => {
    const paths: string[] = [];
    const io: InstitutionFileIO = { read: path => { paths.push(path); return bytes('{"validation_overrides":{"dscr_warning_below":1.3}}'); }, lstat: () => { throw new Error('must not inspect successful read'); } };
    expect(loadInstitutionThresholds(resolve(tmpdir(), 'records', '..', 'deal.uwx.md'), undefined, io)?.dscr?.warning_below).toBe(1.3);
    expect(paths).toEqual([resolve(tmpdir(), '.uw.institution.json')]);
  });
  it('lets unrelated adapter bugs retain their own error boundary', () => {
    const bug = new RangeError('programming defect');
    expect(() => loadInstitutionThresholds(file, undefined, { read: () => { throw bug; }, lstat: () => undefined })).toThrow(bug);
  });
  it('selects one explicit or adjacent real file and leaves sources/config bytes unchanged', () => {
    const directory = mkdtempSync(resolve(tmpdir(), 'uwmd institution0097 '));
    const adjacent = resolve(directory, '.uw.institution.json');
    const explicit = resolve(directory, 'explicit config.json');
    const source = resolve(directory, 'deal.uwx.md');
    try {
      expect(loadInstitutionThresholds(source)).toBeUndefined();
      const a = '{"validation_overrides":{"dscr_warning_below":1.3}}';
      const e = '{"validation_overrides":{"ltv_warning_above":0.7}}';
      writeFileSync(adjacent, a); writeFileSync(explicit, e); writeFileSync(source, 'source sentinel');
      expect(loadInstitutionThresholds(source)?.dscr?.warning_below).toBe(1.3);
      expect(loadInstitutionThresholds(source, relative(process.cwd(), explicit))).toEqual({ ltv: { ...DEFAULT_THRESHOLDS.ltv, warning_above: .7 } });
      expect(readFileSync(adjacent, 'utf8')).toBe(a); expect(readFileSync(explicit, 'utf8')).toBe(e);
      expect(readFileSync(source, 'utf8')).toBe('source sentinel');
      refusal(() => loadInstitutionThresholds(source, directory), 'UNREADABLE');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it('rejects a real automatic dangling symbolic link where supported', ({ skip }) => {
    const directory = mkdtempSync(resolve(tmpdir(), 'uwmd-institution-link0097-'));
    try {
      try { symlinkSync(resolve(directory, 'absent.json'), resolve(directory, '.uw.institution.json'), 'file'); }
      catch (error) { if (['EPERM', 'EACCES', 'ENOSYS'].includes((error as NodeJS.ErrnoException).code ?? '')) { skip(); return; } throw error; }
      refusal(() => loadInstitutionThresholds(resolve(directory, 'deal.uwx.md')), 'UNREADABLE');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it('preserves pure SOURCE/MODEL nested parameters and later defaults without hidden I/O', () => {
    const source = '---\nuw_version: "3.0"\nasset_class: multifamily\nquick_metrics:\n  dscr: 1.25\n---\n';
    const model = parseUWFile(source);
    const before = structuredClone(model);
    const caller = { dscr: { ...DEFAULT_THRESHOLDS.dscr, warning_below: 1.3 } };
    const callerBefore = structuredClone(caller);
    expect(validateUWFile(model, caller).issues.some(i => i.code === 'FV-04')).toBe(true);
    expect(validateUWFile(source).issues.some(i => i.code === 'FV-04')).toBe(false);
    expect(model).toEqual(before); expect(caller).toEqual(callerBefore);
    expect(DEFAULT_THRESHOLDS.dscr).toEqual({ error_below: 1, warning_below: 1.2 });
  });
});
