import { xmlTree } from './xml-tree.mjs';
import { check, put, unicode, readJSON, jcs, validateModel, stamp, VERSION, NAMESPACE } from './model.mjs';

export function lexical(value) {
  unicode(value);
  let result = '"';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 34) result += '\\"';
    else if (code === 92) result += '\\\\';
    else if (code < 32 || code >= 127) result += `\\u${code.toString(16).padStart(4, '0')}`;
    else result += value[i];
  }
  return `${result}"`;
}
const transport = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const attribute = value => transport(value).replaceAll('"', '&quot;').replaceAll("'", '&apos;');
function write(value) {
  if (value === null) return '<uw:value type="null"/>';
  if (Array.isArray(value)) return `<uw:value type="array">${value.map(write).join('')}</uw:value>`;
  if (typeof value === 'object') return `<uw:value type="object">${Object.keys(value).sort().map(key =>
    `<uw:member name-json="${attribute(lexical(key))}">${write(value[key])}</uw:member>`).join('')}</uw:value>`;
  const type = typeof value;
  return `<uw:value type="${type}">${transport(type === 'string' ? lexical(value) : jcs(value))}</uw:value>`;
}
export function encodeXML(input) {
  const model = stamp(input);
  return `<uw:document xmlns:uw="${NAMESPACE}" envelope-version="${VERSION}" format-version="${model.format_version}">${write(model)}</uw:document>`;
}

const XML = 'http://www.w3.org/XML/1998/namespace';
const XMLNS = 'http://www.w3.org/2000/xmlns/';
const whitespace = text => /^[\x20\t\r\n]*$/.test(text);
function nodeInfo(node, inherited) {
  const names = Object.keys(node).filter(key => key !== ':@');
  check(names.length === 1 && !names[0].startsWith('#') && !names[0].startsWith('?'), 'XML element required');
  const name = names[0];
  const namespaces = new Map(inherited);
  const raw = node[':@'] ?? {};
  for (const [key, value] of Object.entries(raw)) {
    if (key !== 'xmlns' && !key.startsWith('xmlns:')) continue;
    const prefix = key === 'xmlns' ? '' : key.slice(6);
    check(prefix !== 'xmlns' && value !== XMLNS, 'reserved XML namespace binding');
    check(prefix === 'xml' ? value === XML : value !== XML, 'reserved xml prefix');
    check(prefix === '' || value !== '', 'empty prefixed namespace');
    namespaces.set(prefix, value);
  }
  const expanded = name => {
    const parts = name.split(':'); check(parts.length <= 2, 'XML qualified name');
    const prefix = parts.length === 2 ? parts[0] : '';
    const local = parts.at(-1);
    check(prefix !== 'xmlns' && namespaces.has(prefix), 'unbound XML prefix');
    return [namespaces.get(prefix), local];
  };
  const [namespace, local] = expanded(name);
  check(namespace === NAMESPACE, 'wrong mapping namespace');
  const attrs = {};
  const expandedAttributes = new Set();
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'xmlns' || key.startsWith('xmlns:')) continue;
    let identity = key;
    if (key.includes(':')) {
      const [uri, attributeName] = expanded(key); identity = `${uri}\0${attributeName}`;
      throw new TypeError('qualified mapping attribute');
    }
    check(!expandedAttributes.has(identity), 'duplicate expanded attribute');
    expandedAttributes.add(identity); put(attrs, key, value);
  }
  return { local, attrs, children: node[name], namespaces };
}
const keys = (attrs, required) => check(Object.keys(attrs).sort().join('\0') === [...required].sort().join('\0'), 'XML mapping attributes');
function elements(children) {
  const result = [];
  for (const child of children) {
    if (Object.hasOwn(child, '#text')) check(whitespace(String(child['#text'])), 'XML mixed content');
    else result.push(child);
  }
  return result;
}
function text(children) {
  check(children.every(child => Object.keys(child).length === 1 && Object.hasOwn(child, '#text')), 'XML scalar children');
  return children.map(child => String(child['#text'])).join('');
}
const readString = token => {
  const value = readJSON(token);
  check(typeof value === 'string' && lexical(value) === token, 'noncanonical ASCII string token');
  return value;
};

export function decodeXML(source) {
  check(Buffer.byteLength(source) <= 50 * 1024 * 1024, 'XML size limit');
  const roots = xmlTree(source);
  const root = nodeInfo(roots[0], new Map([['xml', XML]]));
  check(root.local === 'document', 'XML root name');
  keys(root.attrs, ['envelope-version', 'format-version']);
  const children = elements(root.children); check(children.length === 1, 'XML document value');
  function read(node, scope, depth = 0) {
    check(depth < 128, 'XML depth limit');
    const info = nodeInfo(node, scope);
    check(info.local === 'value', 'XML value element'); keys(info.attrs, ['type']);
    const type = info.attrs.type;
    if (type === 'object') {
      const value = {};
      for (const item of elements(info.children)) {
        const member = nodeInfo(item, info.namespaces);
        check(member.local === 'member', 'XML object member'); keys(member.attrs, ['name-json']);
        const key = readString(member.attrs['name-json']); check(!Object.hasOwn(value, key), 'duplicate XML name');
        const child = elements(member.children); check(child.length === 1, 'XML member value');
        Object.defineProperty(value, key, { value: read(child[0], member.namespaces, depth + 1), enumerable: true, writable: true, configurable: true });
      }
      return value;
    }
    if (type === 'array') return elements(info.children).map(child => read(child, info.namespaces, depth + 1));
    const token = text(info.children);
    if (type === 'string') return readString(token);
    if (type === 'null') { check(token === '', 'XML null content'); return null; }
    const value = readJSON(token);
    check((type === 'number' && typeof value === 'number') || (type === 'boolean' && typeof value === 'boolean'), 'XML scalar type');
    check(jcs(value) === token, 'XML scalar lexical token'); return value;
  }
  const model = read(children[0], root.namespaces);
  check(root.attrs['envelope-version'] === model.envelope_version && root.attrs['format-version'] === model.format_version, 'XML stamp agreement');
  return validateModel(model, true);
}
