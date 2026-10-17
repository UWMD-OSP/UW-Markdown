// Unapproved candidate lexical XML only. Separate namespace reconstruction;
// preserved JCS/model validation reused, never production XML or source admission.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { jcs, validate } from '../codec-study/independent.mjs';
const require = createRequire(new URL('../../../package.json', import.meta.url));
const { XMLParser, XMLValidator } = require('fast-xml-parser');
const NS = 'urn:uwmd:unaccepted:rfc0089:json-lexical';
const XML = 'http://www.w3.org/XML/1998/namespace';
const XMLNS = 'http://www.w3.org/2000/xmlns/';
const own = (value, key) => Object.hasOwn(value, key);
const check = (value, message) => { if (!value) throw new TypeError(message); };
const lexical = text => jcs(text).replace(/[\u007f-\uffff]/g, unit => `\\u${unit.charCodeAt(0).toString(16).padStart(4, '0')}`);
function string(text) {
  const value = JSON.parse(text);
  check(typeof value === 'string' && lexical(value) === text, 'XML lexical spelling');
  return value;
}
function qname(name) {
  const parts = name.split(':');
  check(parts.length <= 2 && parts.every(value => /^[A-Za-z_][A-Za-z0-9._-]*$/.test(value)), 'XML bounded QName');
  return parts.length === 1 ? ['', parts[0]] : parts;
}
function expanded(name, namespaces, attribute = false) {
  const [prefix, local] = qname(name);
  check(prefix !== 'xmlns', 'XML reserved prefix');
  if (prefix) check(namespaces.has(prefix) && namespaces.get(prefix) !== '', 'XML unbound prefix');
  return [prefix ? namespaces.get(prefix) : attribute ? '' : namespaces.get(''), local];
}
export function decodeNamespaceXml(text) {
  check(Buffer.byteLength(text) <= 1048576 && !text.includes('<!') && [...text].every(ch => ch.charCodeAt(0) <= 127), 'XML bounded declaration/domain');
  check(XMLValidator.validate(text) === true, 'XML syntax');
  const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '', trimValues: false, parseTagValue: false, parseAttributeValue: false, ignoreDeclaration: true, htmlEntities: { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } });
  const roots = parser.parse(text);
  check(roots.length === 1, 'XML root');
  function read(node, expectedLocal, inherited, depth = 0) {
    check(depth < 64, 'XML bounded depth');
    const names = Object.keys(node).filter(key => key !== ':@');
    check(names.length === 1 && !names[0].startsWith('#') && !names[0].startsWith('?'), 'XML element node');
    const attrs = { ...node[':@'] };
    const namespaces = new Map(inherited);
    for (const [name, uri] of Object.entries(attrs)) {
      if (name !== 'xmlns' && !name.startsWith('xmlns:')) continue;
      const prefix = name === 'xmlns' ? '' : name.slice(6);
      check(!prefix || qname(prefix)[0] === '' && !prefix.includes(':'), 'XML namespace declaration');
      check(typeof uri === 'string' && prefix !== 'xmlns' && uri !== XMLNS, 'XML reserved namespace');
      check(prefix === 'xml' ? uri === XML : uri !== XML, 'XML reserved xml binding');
      check(!prefix || uri !== '', 'XML empty prefix binding');
      namespaces.set(prefix, uri);
      delete attrs[name];
    }
    const [uri, local] = expanded(names[0], namespaces);
    check(uri === NS && local === expectedLocal, 'XML expanded element');
    const seen = new Set();
    for (const name of Object.keys(attrs)) {
      const identity = JSON.stringify(expanded(name, namespaces, true));
      check(!seen.has(identity), 'XML duplicate expanded attribute'); seen.add(identity);
    }
    for (const name of Object.keys(attrs)) check(expanded(name, namespaces, true)[0] === '', 'XML mapping attribute must be unqualified');
    assert.deepEqual(Object.keys(attrs).sort(), expectedLocal === 'member' ? ['name-json', 'type'] : ['type'], 'XML mapping attributes');
    const children = node[names[0]];
    let value;
    if (attrs.type === 'object') {
      value = Object.create(null);
      for (const child of children) {
        const member = read(child, 'member', namespaces, depth + 1);
        check(!own(value, member.key), 'XML duplicate restored key'); value[member.key] = member.value;
      }
    } else if (attrs.type === 'array') value = children.map(child => read(child, 'value', namespaces, depth + 1).value);
    else {
      check(children.length <= 1 && children.every(child => own(child, '#text')), 'XML scalar children');
      const raw = children[0]?.['#text'] ?? '';
      if (attrs.type === 'string') value = string(raw);
      else {
        value = JSON.parse(raw);
        check(jcs(value) === raw, 'XML scalar spelling');
        check(attrs.type === 'null' && value === null || attrs.type === 'number' && typeof value === 'number' || attrs.type === 'boolean' && typeof value === 'boolean', 'XML scalar type');
      }
    }
    return { ...(expectedLocal === 'member' ? { key: string(attrs['name-json']) } : {}), value };
  }
  return validate(read(roots[0], 'value', new Map([['', ''], ['xml', XML]])).value);
}
