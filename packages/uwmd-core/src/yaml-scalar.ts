// Frontmatter scalar reading for the YAML subset of Format Appendix D, shared
// by the UWX reader (parser.ts) and the Lite reader (lite.ts) so the two can
// never disagree about what a quoted value or a comment means.
//
// Admitted constructs keep their YAML 1.2 meaning (Appendix D, "Scalar
// semantics"): double-quoted escapes, `''` in single quotes, indicators inside
// quotes are content, and a whitespace-preceded `#` outside quotes begins a
// comment. One entry is one line, so a quoted scalar must close on its line.
// Each reader still decides what a *plain* scalar's text means (number,
// boolean, null...); that typing is unchanged by this module.

export type YamlScalarFailure = 'unterminated' | 'escape' | 'trailing' | 'flow';

export type YamlScalarResult =
  | { ok: true; quoted: boolean; text: string }
  | { ok: false; failure: YamlScalarFailure };

export const YAML_SCALAR_FAILURE_FEATURE: Record<YamlScalarFailure, string> = {
  unterminated: 'a quoted scalar that does not close on its line',
  escape: 'a double-quoted escape YAML 1.2 does not define',
  trailing: 'content after a quoted scalar other than a comment',
  flow: 'YAML flow-style mapping or non-empty sequence',
};

const SIMPLE_ESCAPES: Record<string, string> = {
  '0': '\0',
  a: '\x07',
  b: '\b',
  t: '\t',
  '\t': '\t',
  n: '\n',
  v: '\v',
  f: '\f',
  r: '\r',
  e: '\x1b',
  ' ': ' ',
  '"': '"',
  '/': '/',
  '\\': '\\',
  N: '\x85',
  _: '\xa0',
  L: ' ',
  P: ' ',
};

const HEX_ESCAPE_LENGTH: Record<string, number> = { x: 2, u: 4, U: 8 };

/** Whether `rest` (what follows a closing quote) is empty or only a comment. */
function onlyComment(rest: string): boolean {
  return rest.trim() === '' || /^\s+#/.test(rest);
}

function readDoubleQuoted(value: string): YamlScalarResult {
  let text = '';
  for (let i = 1; i < value.length; i++) {
    const ch = value[i]!;
    if (ch === '"') {
      return onlyComment(value.slice(i + 1)) ? { ok: true, quoted: true, text } : { ok: false, failure: 'trailing' };
    }
    if (ch !== '\\') {
      text += ch;
      continue;
    }
    const code = value[i + 1];
    if (code === undefined) return { ok: false, failure: 'unterminated' };
    const simple = SIMPLE_ESCAPES[code];
    if (simple !== undefined) {
      text += simple;
      i++;
      continue;
    }
    const length = HEX_ESCAPE_LENGTH[code];
    const hex = length === undefined ? '' : value.slice(i + 2, i + 2 + length);
    if (length === undefined || !new RegExp(`^[0-9A-Fa-f]{${length}}$`).test(hex)) {
      return { ok: false, failure: 'escape' };
    }
    const point = Number.parseInt(hex, 16);
    if (point > 0x10ffff) return { ok: false, failure: 'escape' };
    // `\u` is a UTF-16 unit, as in JSON, so an escaped surrogate pair joins.
    text += code === 'u' ? String.fromCharCode(point) : String.fromCodePoint(point);
    i += 1 + length;
  }
  return { ok: false, failure: 'unterminated' };
}

function readSingleQuoted(value: string): YamlScalarResult {
  let text = '';
  for (let i = 1; i < value.length; i++) {
    const ch = value[i]!;
    if (ch !== "'") {
      text += ch;
      continue;
    }
    if (value[i + 1] === "'") {
      text += "'";
      i++;
      continue;
    }
    return onlyComment(value.slice(i + 1)) ? { ok: true, quoted: true, text } : { ok: false, failure: 'trailing' };
  }
  return { ok: false, failure: 'unterminated' };
}

/**
 * Reads the scalar that follows a `key:` or a sequence item's `-`. `raw` is the
 * rest of the line after that separator. Plain text comes back with any
 * comment removed and surrounding whitespace trimmed; an empty plain result
 * means the entry has no inline value.
 */
export function readYamlScalar(raw: string): YamlScalarResult {
  const value = raw.trimStart();
  if (value.startsWith('"')) return readDoubleQuoted(value);
  if (value.startsWith("'")) return readSingleQuoted(value);
  // A comment needs whitespace before it; the separator supplies it for a
  // value that is nothing but a comment.
  const comment = value.startsWith('#') ? 0 : value.search(/\s#/);
  const text = (comment === -1 ? value : value.slice(0, comment)).trim();
  if (text.startsWith('{') || (text.startsWith('[') && text !== '[]')) return { ok: false, failure: 'flow' };
  return { ok: true, quoted: false, text };
}

/**
 * The line with any quoted scalar's content blanked out, for the reader's
 * unsupported-feature scan: inside quotes, `&`, `*` and `!` are content, not
 * YAML indicators. A line whose quoted scalar does not read is returned as is;
 * `readYamlScalar` reports it.
 */
export function maskQuotedScalar(line: string): string {
  const item = /^(\s*-\s+)(.*)$/.exec(line);
  const colon = item ? -1 : line.indexOf(':');
  const prefix = item ? item[1]! : colon === -1 ? line : line.slice(0, colon + 1);
  const rest = item ? item[2]! : colon === -1 ? '' : line.slice(colon + 1);
  const value = rest.trimStart();
  if (!value.startsWith('"') && !value.startsWith("'")) return line;
  const scalar = readYamlScalar(value);
  if (!scalar.ok) return line;
  const close = closingQuoteIndex(value);
  const lead = rest.slice(0, rest.length - value.length);
  return `${prefix}${lead}${value[0]}${'_'.repeat(Math.max(0, close - 1))}${value.slice(close)}`;
}

/** Index of the closing quote of the quoted scalar that opens `value`. */
function closingQuoteIndex(value: string): number {
  const quote = value[0];
  for (let i = 1; i < value.length; i++) {
    const ch = value[i];
    if (quote === '"' && ch === '\\') {
      i++;
      continue;
    }
    if (ch === quote) {
      if (quote === "'" && value[i + 1] === "'") {
        i++;
        continue;
      }
      return i;
    }
  }
  return value.length;
}
