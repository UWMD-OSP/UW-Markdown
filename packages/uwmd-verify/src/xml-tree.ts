// XML 1.0 syntax for the RFC's bounded tree profile: no DTD, comments or PI.
// Char, Name, XMLDecl, AttValue and reference rules: https://www.w3.org/TR/xml/
import { check, put } from './carrier-values.js';

const legal = (cp: number) => cp === 9 || cp === 10 || cp === 13 || cp >= 32 && cp <= 0xd7ff
  || cp >= 0xe000 && cp <= 0xfffd || cp >= 0x10000 && cp <= 0x10ffff;
const entities = new Map([['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"]]);
function references(text: string) {
  return text.replace(/&([^;]*);|&/g, (_match, token) => {
    check(token !== undefined, 'XML unterminated reference');
    if (entities.has(token)) return entities.get(token)!;
    check(/^#(?:[0-9]+|x[0-9a-fA-F]+)$/.test(token), 'XML unknown or malformed reference');
    const cp = Number.parseInt(token.slice(token[1] === 'x' ? 2 : 1), token[1] === 'x' ? 16 : 10);
    check(legal(cp), 'XML illegal character reference');
    return String.fromCodePoint(cp);
  });
}
const start = 'A-Za-z_\\u00c0-\\u00d6\\u00d8-\\u00f6\\u00f8-\\u02ff\\u0370-\\u037d\\u037f-\\u1fff\\u200c-\\u200d\\u2070-\\u218f\\u2c00-\\u2fef\\u3001-\\ud7ff\\uf900-\\ufdcf\\ufdf0-\\ufffd\\u{10000}-\\u{effff}';
const ncname = `[${start}][${start}0-9.\\-\\u00b7\\u0300-\\u036f\\u203f-\\u2040]*`;
const qualifiedName = new RegExp(`^${ncname}(?::${ncname})?$`, 'u');
const declaration = /^<\?xml[ \t\n]+version[ \t\n]*=[ \t\n]*(?:"1\.0"|'1\.0')(?:[ \t\n]+encoding[ \t\n]*=[ \t\n]*(?:"[uU][tT][fF]-8"|'[uU][tT][fF]-8'))?(?:[ \t\n]+standalone[ \t\n]*=[ \t\n]*(?:"(?:yes|no)"|'(?:yes|no)'))?[ \t\n]*\?>/;

export function xmlTree(input: string): any[] {
  for (const character of input) check(legal(character.codePointAt(0)!), 'XML illegal literal character');
  let source = input.replace(/\r\n?/g, '\n'); // XML 1.0 end-of-line handling precedes references.
  if (source.startsWith('\ufeff')) source = source.slice(1);
  if (source.startsWith('<?xml')) {
    const match = declaration.exec(source); check(match, 'XML malformed declaration');
    source = source.slice(match[0].length);
  }
  check(!source.includes('<?'), 'XML processing instruction');
  check(!source.includes('<!'), 'XML declarations/entities/comments forbidden');
  let at = 0;
  const space = () => { const before = at; while (/[ \t\n]/.test(source[at] ?? '\0')) at++; return at - before; };
  const name = () => {
    const before = at;
    while (at < source.length && !/[ \t\n\/>=]/.test(source[at])) at++;
    const value = source.slice(before, at); check(qualifiedName.test(value), 'XML malformed qualified name'); return value;
  };
  function element(depth = 0): any {
    check(depth < 384, 'XML syntax depth limit');
    check(source[at++] === '<', 'XML element required');
    const tag = name(); const attributes: Record<string, string> = {}; const children: any[] = [];
    for (;;) {
      const separated = space();
      if (source.startsWith('/>', at)) { at += 2; return { [tag]: children, ':@': attributes }; }
      if (source[at] === '>') { at++; break; }
      check(separated > 0, 'XML attribute separator');
      const key = name(); check(!Object.hasOwn(attributes, key), 'XML duplicate attribute');
      space(); check(source[at++] === '=', 'XML attribute equality'); space();
      const quote = source[at++]; check(quote === '"' || quote === "'", 'XML attribute quote');
      const end = source.indexOf(quote, at); check(end >= 0, 'XML unterminated attribute');
      const raw = source.slice(at, end); check(!raw.includes('<'), 'XML literal less-than in attribute');
      // Literal whitespace normalizes to spaces; referenced whitespace is retained.
      put(attributes, key, references(raw.replace(/[\t\n]/g, ' '))); at = end + 1;
    }
    while (at < source.length) {
      if (source.startsWith('</', at)) {
        at += 2; check(name() === tag, 'XML mismatched closing tag'); space();
        check(source[at++] === '>', 'XML closing delimiter'); return { [tag]: children, ':@': attributes };
      }
      if (source[at] === '<') children.push(element(depth + 1));
      else {
        let end = source.indexOf('<', at); if (end < 0) end = source.length;
        const raw = source.slice(at, end); check(!raw.includes(']]>'), 'XML forbidden character-data delimiter');
        children.push({ '#text': references(raw) }); at = end;
      }
    }
    throw new TypeError('XML unclosed element');
  }
  space(); const root = element(); space(); check(at === source.length, 'XML extra root or trailing content');
  return [root];
}
