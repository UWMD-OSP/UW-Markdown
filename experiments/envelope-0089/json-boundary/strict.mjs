// UNAPPROVED raw JSON research boundary, not a public decoder or new receipt rule.
// Unique decoded names are checked before JSON object construction can erase them.
import { jcs } from '../codec-study/independent.mjs';
const check = (condition, message) => { if (!condition) throw new TypeError(message); };
export function parseUniqueJson(text) {
  check(typeof text === 'string' && Buffer.byteLength(text) <= 1048576, 'JSON bounded input');
  let at = 0;
  const space = () => { while (/[ \t\r\n]/.test(text[at] ?? '\0')) at++; };
  const string = () => {
    check(text[at] === '"', 'JSON string');
    const start = at++;
    while (at < text.length) {
      const ch = text[at++];
      if (ch === '"') {
        const value = JSON.parse(text.slice(start, at));
        jcs(value); // Existing Unicode/JCS admission, including member names.
        return value;
      }
      if (ch === '\\') at++;
    }
    throw new TypeError('JSON unterminated string');
  };
  function value(depth = 0) {
    check(depth < 64, 'JSON bounded depth');
    space();
    if (text[at] === '"') return string();
    if (text[at] === '{') {
      at++; space();
      const result = Object.create(null);
      if (text[at] === '}') { at++; return result; }
      while (true) {
        space(); const key = string();
        check(!Object.hasOwn(result, key), 'duplicate decoded JSON key');
        space(); check(text[at++] === ':', 'JSON object colon');
        result[key] = value(depth + 1); space();
        if (text[at] === '}') { at++; return result; }
        check(text[at++] === ',', 'JSON object separator');
      }
    }
    if (text[at] === '[') {
      at++; space();
      const result = [];
      if (text[at] === ']') { at++; return result; }
      while (true) {
        result.push(value(depth + 1)); space();
        if (text[at] === ']') { at++; return result; }
        check(text[at++] === ',', 'JSON array separator');
      }
    }
    for (const [token, parsed] of [['true', true], ['false', false], ['null', null]]) {
      if (text.startsWith(token, at)) { at += token.length; return parsed; }
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(at));
    check(number, 'JSON value');
    at += number[0].length;
    const parsed = JSON.parse(number[0]);
    check(Number.isFinite(parsed), 'nonfinite JSON');
    return parsed;
  }
  const parsed = value(); space();
  check(at === text.length, 'JSON trailing input');
  return parsed;
}
