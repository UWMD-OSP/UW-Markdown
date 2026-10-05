import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { maskQuotedScalar, readYamlScalar } from './yaml-scalar.js';

/** The decoded text of a scalar that must read. */
const text = (raw: string): string => {
  const result = readYamlScalar(raw);
  if (!result.ok) throw new Error(`expected ${raw} to read, got ${result.failure}`);
  return result.text;
};

describe('readYamlScalar — double-quoted (Format Appendix D, YAML 1.2)', () => {
  it.each([
    [' "plain"', 'plain'],
    [' "a \\"b\\" c"', 'a "b" c'],
    [' "C:\\\\deals"', 'C:\\deals'],
    [' "tab\\there"', 'tab\there'],
    [' "line\\nbreak"', 'line\nbreak'],
    [' "\\0\\a\\b\\v\\f\\r\\e"', '\0\x07\b\v\f\r\x1b'],
    [' "\\ \\/\\N\\_\\L\\P"', ' /\x85\xa0\u2028\u2029'],
    [' "caf\\u00e9 \\x41 \\U0001F3E2"', 'café A 🏢'],
    [' "pair \\ud83c\\udfe2"', 'pair 🏢'],
    [' "Smith: &Co *North* !Phase #2 {x} [y]"', 'Smith: &Co *North* !Phase #2 {x} [y]'],
    [' ""', ''],
    [' "  padded  "', '  padded  '],
    [' "value" # a comment', 'value'],
    [' "value"   ', 'value'],
  ])('%s reads as %j, as a YAML library reads it', (raw, expected) => {
    expect(text(raw)).toBe(expected);
    expect(parseYaml(`k:${raw}`).k).toBe(expected);
  });

  it.each([
    [' "C:\\deals"', 'escape'],
    [' "\\q"', 'escape'],
    [' "\\x4"', 'escape'],
    [' "\\uZZZZ"', 'escape'],
    [' "\\U00110000"', 'escape'],
    [' "unterminated', 'unterminated'],
    [' "ends in a backslash\\', 'unterminated'],
    [' "a"b"', 'trailing'],
    [' "a"# no space before the comment', 'trailing'],
  ])('refuses %s (%s)', (raw, failure) => {
    expect(readYamlScalar(raw)).toEqual({ ok: false, failure });
  });
});

describe('readYamlScalar — single-quoted', () => {
  it.each([
    [" 'plain'", 'plain'],
    [" 'O''Brien'", "O'Brien"],
    [" ''''", "'"],
    [" ''", ''],
    [" 'C:\\deals \\n'", 'C:\\deals \\n'],
    [" 'fixture: &a *b !c #d {e} [f]'", 'fixture: &a *b !c #d {e} [f]'],
    [" 'value' # a comment", 'value'],
  ])('%s reads as %j, as a YAML library reads it', (raw, expected) => {
    expect(text(raw)).toBe(expected);
    expect(parseYaml(`k:${raw}`).k).toBe(expected);
  });

  it.each([
    [" 'O'Brien'", 'trailing'],
    [" 'unterminated", 'unterminated'],
    [" 'ends with a doubled quote''", 'unterminated'],
  ])('refuses %s (%s)', (raw, failure) => {
    expect(readYamlScalar(raw)).toEqual({ ok: false, failure });
  });
});

describe('readYamlScalar — plain scalars', () => {
  it.each([
    [' AZ', 'AZ'],
    [' AZ # comment', 'AZ'],
    [' AZ\t# tab before the comment', 'AZ'],
    [' # only a comment', ''],
    [' ', ''],
    ['', ''],
    [' a#b', 'a#b'],
    [" O'Brien", "O'Brien"],
    [' []', '[]'],
    [' [] # empty sequence', '[]'],
    [' 1.25 # ratio', '1.25'],
  ])('%j reads as %j', (raw, expected) => {
    expect(readYamlScalar(raw)).toEqual({ ok: true, quoted: false, text: expected });
  });

  it.each([' {a: 1}', ' {}', ' [1, 2]', ' [ ]', ' [a] # comment'])('refuses flow style %j', (raw) => {
    expect(readYamlScalar(raw)).toEqual({ ok: false, failure: 'flow' });
  });
});

describe('maskQuotedScalar', () => {
  it.each([
    ['deal_name: "Smith: &Co"', 'deal_name: "__________"'],
    ["  - 'a: &b'", "  - '_____'"],
    ['city: "x \\" *y" # c', 'city: "_______" # c'],
    ["notes: 'it''s !x'", "notes: '________'"],
  ])('blanks the quoted content of %j', (line, masked) => {
    expect(maskQuotedScalar(line)).toBe(masked);
  });

  it.each(['deal_name: &a Smith', "notes: O'Brien &x", 'deal_name: "unterminated &x', 'flags: []'])(
    'leaves %j alone',
    (line) => {
      expect(maskQuotedScalar(line)).toBe(line);
    },
  );
});
