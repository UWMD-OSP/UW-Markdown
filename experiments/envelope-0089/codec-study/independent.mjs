// UNAPPROVED RFC0089 research reader. Independently authored; no Python codec imports.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../package.json', import.meta.url));
const { XMLParser, XMLValidator } = require('fast-xml-parser');
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (condition, reason) => { if (!condition) throw new TypeError(reason); };
const same = (a, b, reason) => assert.deepStrictEqual(a, b, reason);
const object = () => Object.create(null);
const has = (value, key) => Object.hasOwn(value, key);
const decodeUtf8 = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const utf16 = text => {
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) { const next = text.charCodeAt(++i); check(next >= 0xdc00 && next <= 0xdfff, 'invalid Unicode'); }
    else check(unit < 0xdc00 || unit > 0xdfff, 'invalid Unicode');
  }
};
export function jcs(value) {
  if (typeof value === 'string') { utf16(value); return JSON.stringify(value); }
  if (typeof value === 'number') { check(Number.isFinite(value), 'nonfinite'); return JSON.stringify(value); }
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(jcs).join(',')}]`;
  check(value && typeof value === 'object', 'JSON type');
  return `{${Object.keys(value).sort().map(key => `${jcs(key)}:${jcs(value[key])}`).join(',')}}`;
}
const token = text => { const value = JSON.parse(text); check(jcs(value) === text, 'noncanonical JSON token'); return value; };
export function subject(model) {
  const value = Object.fromEntries(Object.entries(model).filter(([key]) => !['generated_at', 'generator', 'semantic_digest'].includes(key)));
  return `sha256:${sha(Buffer.from(jcs(value)))}`;
}
const esc = text => text.replaceAll('~', '~0').replaceAll('/', '~1');
const parts = pointer => {
  check(pointer === '' || pointer.startsWith('/'), 'pointer prefix');
  return pointer === '' ? [] : pointer.slice(1).split('/').map(encoded => {
    check(!/~(?![01])/.test(encoded), 'pointer escape');
    const decoded = encoded.replaceAll('~1', '/').replaceAll('~0', '~');
    check(esc(decoded) === encoded, 'pointer alias'); return decoded;
  });
};
const docHeader = ['envelope_version', 'format_version', 'generated_at_json', 'generator_json', 'semantic_digest', 'deal_id_json', 'deal_name_json', 'extra_json'];
const blockHeader = ['block_ref', 'collection', 'section_json', 'variant_json', 'ordinal', 'state', 'extension_mode'];
const valueHeader = ['block_ref', 'scope', 'pointer', 'json_type', 'value_json'];
const proseHeader = ['prose_ref', 'scope', 'block_ref', 'prose_json'];
export const names = ['block_values.csv', 'blocks.csv', 'document.csv', 'frontmatter.csv', 'manifest.json', 'prose.csv'];
const scopes = ['annotation', 'meta', 'content', 'block-extra'];
const arrays = ['pipeline_log', 'custom_calculations', 'custom_scenarios'];
const required = ['envelope_version', 'format_version', 'frontmatter', 'sections', ...arrays, 'extensions', 'superseded'];

// Strict quote-all RFC4180 reader: canonical transport used by this experiment.
export function csv(text, header) {
  const output = [];
  let row = [];
  let index = 0;
  while (index < text.length) {
    check(text[index++] === '"', 'CSV quoted field');
    let field = '';
    let closed = false;
    while (index < text.length) {
      const ch = text[index++];
      if (ch !== '"') field += ch;
      else if (text[index] === '"') { field += '"'; index++; }
      else { closed = true; break; }
    }
    check(closed, 'CSV unterminated'); row.push(field);
    if (text[index] === ',') { index++; continue; }
    check(text.slice(index, index + 2) === '\r\n', 'CSV CRLF'); index += 2;
    check(row.length === header.length, 'CSV width'); output.push(row); row = [];
  }
  check(output.length > 0, 'CSV header'); same(output.shift(), header, 'CSV header'); return output;
}
function tree(rows) {
  const nodes = new Map();
  for (const [pointer, kind, lexical] of rows) {
    const path = parts(pointer);
    const id = JSON.stringify(path);
    check(!nodes.has(id), 'duplicate decoded pointer');
    let value;
    if (kind === 'object' || kind === 'array') { check(lexical === '', 'container lexical'); value = kind === 'array' ? [] : object(); }
    else {
      value = token(lexical);
      check((kind === 'null' && value === null) || ((kind === 'string' && typeof value === 'string') || (kind === 'number' && typeof value === 'number') || (kind === 'boolean' && typeof value === 'boolean')), 'scalar type');
    }
    nodes.set(id, { path, kind, value });
  }
  check(nodes.has('[]'), 'root missing');
  for (const node of nodes.values()) check(!node.path.length || nodes.has(JSON.stringify(node.path.slice(0, -1))), 'missing parent');
  function build(path) {
    const { kind, value } = nodes.get(JSON.stringify(path));
    const children = [...nodes.values()].filter(node => node.path.length === path.length + 1 && JSON.stringify(node.path.slice(0, -1)) === JSON.stringify(path));
    if (!['object', 'array'].includes(kind)) { check(children.length === 0, 'scalar child'); return value; }
    if (kind === 'array') {
      same(children.map(child => child.path.at(-1)).sort(), Array.from({ length: children.length }, (_, i) => String(i)).sort(), 'array gaps');
      return Array.from({ length: children.length }, (_, i) => build([...path, String(i)]));
    }
    for (const child of children) value[child.path.at(-1)] = build(child.path);
    return value;
  }
  return build([]);
}
export function descriptors(model) {
  const output = [];
  function add(ref, collection, section, variant, ordinal, state, mode, block) {
    check(block && typeof block === 'object' && block.annotation && block.content?._meta, 'block shape');
    check(block.annotation.section === section && block.content._meta.section === section, 'section identity');
    check(!has(block.annotation, 'variant') || typeof block.annotation.variant === 'string', 'variant annotation type');
    check(block.content._meta.lifecycle?.superseded === (state === 'superseded'), 'state');
    check(!has(block, 'prose') || typeof block.prose === 'string', 'prose type');
    output.push([ref, collection, jcs(section), jcs(variant), ordinal, state, mode]);
  }
  for (const section of Object.keys(model.sections).sort()) {
    const entry = model.sections[section];
    if (has(entry, 'annotation') && has(entry, 'content')) add(`/sections/${esc(section)}`, 'sections', section, entry.annotation.variant ?? null, '', 'current', '', entry);
    else {
      check(Object.keys(entry).length, 'empty section variants unsupported');
      for (const variant of Object.keys(entry).sort()) add(`/sections/${esc(section)}/${esc(variant)}`, 'sections', section, variant, '', 'current', '', entry[variant]);
    }
  }
  for (const collection of arrays) model[collection].forEach((block, i) => add(`/${collection}/${i}`, collection, block.annotation.section, null, String(i), 'current', '', block));
  for (const section of Object.keys(model.extensions).sort()) {
    const entry = model.extensions[section];
    check(section.startsWith('x_'), 'extension id');
    if (entry.mode === 'single') {
      same(Object.keys(entry).sort(), ['block', 'mode'], 'single wrapper');
      add(`/extensions/${esc(section)}/block`, 'extensions', section, entry.block.annotation.variant ?? null, '', 'current', 'single', entry.block);
    } else {
      same(Object.keys(entry).sort(), ['blocks', 'mode'], 'variants wrapper');
      check(entry.mode === 'variants' && entry.blocks.length > 0, 'variants mode');
      const identities = entry.blocks.map(record => {
        same(Object.keys(record).sort(), ['block', 'variant'], 'record wrapper');
        check(record.variant === null || typeof record.variant === 'string', 'variant type');
        check(record.variant === (record.block.annotation.variant ?? null), 'variant identity'); return record.variant;
      });
      const sorted = [...identities].sort((a, b) => a === null ? b === null ? 0 : -1 : b === null ? 1 : a < b ? -1 : a > b ? 1 : 0);
      same(identities, sorted, 'identity order'); check(new Set(identities).size === identities.length, 'duplicate variant');
      entry.blocks.forEach((record, i) => add(`/extensions/${esc(section)}/blocks/${i}/block`, 'extensions', section, record.variant, String(i), 'current', 'variants', record.block));
    }
  }
  for (const section of Object.keys(model.superseded).sort()) {
    check(model.superseded[section].length > 0, 'empty history slot unsupported');
    model.superseded[section].forEach((block, i) => add(`/superseded/${esc(section)}/${i}`, 'superseded', section, null, String(i), 'superseded', '', block));
  }
  return output;
}
export function validate(model) {
  check(required.every(key => has(model, key)), 'required model fields');
  check(model.envelope_version === 'E_NEXT' && model.format_version === '3.0' && model.frontmatter.uw_version === '3.0', 'unsupported regime');
  check(['sections', 'extensions', 'superseded'].every(key => model[key] && !Array.isArray(model[key]) && typeof model[key] === 'object'), 'map collections');
  check(arrays.every(key => Array.isArray(model[key])), 'array collections');
  descriptors(model); check(subject(model) === model.semantic_digest, 'semantic digest'); return model;
}
export function decodeCsv(files) {
  same(Object.keys(files).sort(), names, 'file set');
  const manifest = JSON.parse(files['manifest.json']);
  check(manifest.bundle_version === 'B_NEXT' && manifest.envelope_version === 'E_NEXT' && manifest.canonicalization_version === 'C_NEXT', 'unsupported regime');
  same(manifest.inventory.map(item => item.path).sort(), names.filter(name => name !== 'manifest.json'), 'inventory set');
  for (const item of manifest.inventory) {
    const bytes = Buffer.from(files[item.path]); check(item.bytes === bytes.length && item.sha256 === sha(bytes), 'inventory hash');
  }
  const documents = csv(files['document.csv'], docHeader); check(documents.length === 1, 'document cardinality');
  const d = documents[0];
  const fm = tree(csv(files['frontmatter.csv'], ['pointer', 'json_type', 'value_json']));
  check(jcs(fm.deal_id ?? null) === d[5] && jcs(fm.deal_name ?? null) === d[6], 'frontmatter identity');
  const extra = token(d[7]);
  check(extra && typeof extra === 'object' && !Array.isArray(extra) && ![...required, 'generated_at', 'generator', 'semantic_digest'].some(key => has(extra, key)), 'extra collision');
  const model = { ...extra, envelope_version: d[0], format_version: d[1], semantic_digest: d[4], frontmatter: fm, sections: object(), extensions: object(), superseded: object(), pipeline_log: [], custom_calculations: [], custom_scenarios: [] };
  for (const [index, key] of [[2, 'generated_at'], [3, 'generator']]) { const value = token(d[index]); if (value !== null) model[key] = value; }
  const records = csv(files['blocks.csv'], blockHeader);
  const refs = new Set(records.map(row => row[0])); check(refs.size === records.length, 'duplicate block ref');
  const values = new Map();
  for (const [ref, scope, ...row] of csv(files['block_values.csv'], valueHeader)) {
    check(refs.has(ref) && scopes.includes(scope), 'scope/ref');
    const key = JSON.stringify([ref, scope]); if (!values.has(key)) values.set(key, []); values.get(key).push(row);
  }
  const prose = new Map();
  for (const [ref, scope, blockRef, lexical] of csv(files['prose.csv'], proseHeader)) {
    check(refs.has(blockRef) && scope === 'block' && ref === `${blockRef}/prose` && !prose.has(blockRef), 'prose ref');
    const value = token(lexical); check(typeof value === 'string', 'prose string'); prose.set(blockRef, value);
  }
  for (const [ref, collection, sectionJson, variantJson, ordinal, _state, mode] of records) {
    const section = token(sectionJson);
    const variant = token(variantJson);
    check(typeof section === 'string' && (variant === null || typeof variant === 'string'), 'descriptor identity');
    const part = object();
    for (const scope of scopes) {
      const entries = values.get(JSON.stringify([ref, scope])); check(entries, 'missing scope');
      part[scope] = tree(entries); check(part[scope] && !Array.isArray(part[scope]) && typeof part[scope] === 'object', 'scope object');
    }
    check(!['annotation', 'content', 'prose'].some(key => has(part['block-extra'], key)) && !has(part.content, '_meta'), 'reserved overlap');
    const block = { ...part['block-extra'], annotation: part.annotation, content: { _meta: part.meta, ...part.content } };
    if (prose.has(ref)) block.prose = prose.get(ref);
    if (collection === 'extensions') {
      if (mode === 'single') { check(!has(model.extensions, section), 'duplicate extension'); model.extensions[section] = { mode, block }; }
      else {
        check(mode === 'variants', 'mode');
        if (!has(model.extensions, section)) model.extensions[section] = { mode, blocks: [] };
        const target = model.extensions[section]; check(target.mode === mode && ordinal === String(target.blocks.length), 'ordinal');
        target.blocks.push({ variant, block });
      }
    } else if (collection === 'sections') {
      if (ref === `/sections/${esc(section)}`) { check(!has(model.sections, section), 'duplicate section'); model.sections[section] = block; }
      else {
        check(typeof variant === 'string' && ref === `/sections/${esc(section)}/${esc(variant)}`, 'section pointer');
        if (!has(model.sections, section)) model.sections[section] = object();
        check(!has(model.sections[section], variant), 'duplicate section variant'); model.sections[section][variant] = block;
      }
    } else {
      check(collection === 'superseded' || arrays.includes(collection), 'collection');
      if (collection === 'superseded' && !has(model.superseded, section)) model.superseded[section] = [];
      const target = collection === 'superseded' ? model.superseded[section] : model[collection];
      check(ordinal === String(target.length), 'array ordinal'); target.push(block);
    }
  }
  same(descriptors(model), records, 'descriptor agreement');
  check(manifest.format_version === model.format_version && manifest.semantic_digest === model.semantic_digest, 'manifest document');
  return validate(model);
}
const lexical = text => {
  utf16(text);
  return JSON.stringify(text).replace(/[\u007f-\uffff]/g, ch => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);
};
export function decodeXml(text) {
  check(Buffer.byteLength(text) <= 1048576 && !text.includes('<!') && [...text].every(ch => ch.charCodeAt(0) <= 127), 'XML declaration/domain');
  check(XMLValidator.validate(text) === true, 'XML syntax');
  const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '', trimValues: false, parseTagValue: false, parseAttributeValue: false, ignoreDeclaration: true });
  const roots = parser.parse(text); check(roots.length === 1, 'XML root');
  function string(token) { const value = JSON.parse(token); check(typeof value === 'string' && lexical(value) === token, 'XML lexical spelling'); return value; }
  function read(node, member = false, depth = 0, root = false) {
    check(depth < 64 && has(node, member ? 'uw:member' : 'uw:value'), 'XML namespace/depth');
    const attrs = { ...node[':@'] };
    if (root) { check(attrs['xmlns:uw'] === 'urn:uwmd:unaccepted:rfc0089:json-lexical', 'XML namespace'); delete attrs['xmlns:uw']; }
    same(Object.keys(attrs).sort(), (member ? ['name-json', 'type'] : ['type']), 'XML attributes');
    const children = node[member ? 'uw:member' : 'uw:value'];
    if (attrs.type === 'object') {
      const result = object();
      for (const child of children) { check(!has(child, '#text'), 'XML mixed content'); const key = string(child[':@']?.['name-json']); check(!has(result, key), 'XML duplicate name'); result[key] = read(child, true, depth + 1); }
      return result;
    }
    if (attrs.type === 'array') return children.map(child => read(child, false, depth + 1));
    check(children.length <= 1 && children.every(child => has(child, '#text')), 'XML scalar children');
    const text = children[0]?.['#text'] ?? '';
    if (attrs.type === 'string') return string(text);
    const value = token(text);
    check((attrs.type === 'null' && value === null) || ((attrs.type === 'number' && typeof value === 'number') || (attrs.type === 'boolean' && typeof value === 'boolean')), 'XML scalar type');
    return value;
  }
  return validate(read(roots[0], false, 0, true));
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
export function decodeZip(bytes) {
  check(bytes.length >= 22 && bytes.length <= 1048576, 'ZIP bounds');
  const end = bytes.length - 22;
  check(bytes.readUInt32LE(end) === 0x06054b50 && bytes.readUInt32LE(end + 4) === 0 && bytes.readUInt16LE(end + 8) === 6 && bytes.readUInt16LE(end + 10) === 6 && bytes.readUInt16LE(end + 20) === 0, 'ZIP end/disks/count');
  let central = bytes.readUInt32LE(end + 16);
  check(central + bytes.readUInt32LE(end + 12) === end, 'ZIP central size');
  let local = 0;
  const files = object();
  for (const expectedName of names) {
    check(bytes.readUInt32LE(central) === 0x02014b50, 'ZIP central');
    check(bytes.readUInt16LE(central + 8) === 0 && bytes.readUInt16LE(central + 10) === 0, 'ZIP flags/method');
    const size = bytes.readUInt32LE(central + 24);
    check(size === bytes.readUInt32LE(central + 20) && size <= 1048576, 'ZIP expansion');
    const n = bytes.readUInt16LE(central + 28);
    check(bytes.readUInt16LE(central + 30) === 0 && bytes.readUInt16LE(central + 32) === 0 && bytes.readUInt16LE(central + 34) === 0 && bytes.readUInt32LE(central + 42) === local, 'ZIP extra/comment/disk/offset');
    check(bytes.readUInt16LE(central + 12) === 0 && bytes.readUInt16LE(central + 14) === 33 && bytes.readUInt32LE(central + 38) >>> 16 === 0o100644, 'ZIP metadata/symlink');
    const name = decodeUtf8(bytes.subarray(central + 46, central + 46 + n)); check(name === expectedName, 'ZIP names/order/path');
    check(bytes.readUInt32LE(local) === 0x04034b50 && bytes.readUInt16LE(local + 6) === 0 && bytes.readUInt16LE(local + 8) === 0 && bytes.readUInt16LE(local + 10) === 0 && bytes.readUInt16LE(local + 12) === 33 && bytes.readUInt16LE(local + 26) === n && bytes.readUInt16LE(local + 28) === 0, 'ZIP local metadata');
    check(decodeUtf8(bytes.subarray(local + 30, local + 30 + n)) === name, 'ZIP local name');
    const start = local + 30 + n;
    const payload = bytes.subarray(start, start + size);
    check(payload.length === size && bytes.readUInt32LE(local + 18) === size && bytes.readUInt32LE(local + 22) === size && bytes.readUInt32LE(local + 14) === bytes.readUInt32LE(central + 16) && crc32(payload) === bytes.readUInt32LE(central + 16), 'ZIP CRC/size');
    files[name] = decodeUtf8(payload); local = start + size; central += 46 + n;
  }
  check(central === end && local === bytes.readUInt32LE(end + 16), 'ZIP gap/trailing payload');
  return decodeCsv(files);
}
export function sourceAccounting(raw) {
  const text = decodeUtf8(raw);
  check(text.startsWith('---\n'), 'source frontmatter');
  const output = [];
  const fences = /^```json uw:section=([^\s]+)([^\n]*)\n([\s\S]*?)\n```(?:\n|$)/gm;
  for (const match of text.matchAll(fences)) {
    const section = match[1];
    const attributes = object();
    for (const item of match[2].trim().split(/ +/).filter(Boolean)) { const at = item.indexOf('='); check(at > 0, 'source attributes'); const key = item.slice(0, at); check(!has(attributes, key), 'duplicate source attribute'); attributes[key] = item.slice(at + 1); }
    const body = JSON.parse(match[3]);
    const state = body._meta.lifecycle.superseded ? 'superseded' : 'current';
    check(body._meta.section === section && (!has(attributes, 'superseded') || attributes.superseded === String(state === 'superseded')), 'source identity');
    output.push({ source_ordinal: output.length, section, variant: attributes.variant ?? null, state, source_body_sha256: sha(Buffer.from(`${match[3]}\n`)) });
  }
  check(output.length > 0, 'source blocks'); return output;
}
