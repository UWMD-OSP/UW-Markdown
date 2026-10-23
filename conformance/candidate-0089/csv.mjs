import { zipSync } from 'fflate';
import * as zipReader from '../../packages/uwmd-verify/dist/zip-safety.js';
import { check, object, put, readJSON, jcs, sha, esc, arrays, descriptors, validateModel, stamp, VERSION, REPRESENTATION } from './model.mjs';

export const DOC = ['envelope_version', 'format_version', 'generated_at_json', 'generator_json', 'semantic_digest', 'deal_id_json', 'deal_name_json', 'extra_json', 'empty_collections_json'];
export const BLOCK = ['block_ref', 'collection', 'section_json', 'variant_json', 'ordinal', 'state', 'extension_mode'];
export const VALUE = ['block_ref', 'scope', 'pointer', 'json_type', 'value_json'];
export const PROSE = ['prose_ref', 'scope', 'block_ref', 'prose_json'];
export const FLAT = ['pointer', 'json_type', 'value_json'];
const REQUIRED = ['document.csv', 'frontmatter.csv', 'blocks.csv', 'block_values.csv', 'prose.csv'];
const SCOPES = ['annotation', 'meta', 'content', 'block-extra'];
const RESERVED = ['envelope_version', 'format_version', 'generated_at', 'generator', 'semantic_digest', 'frontmatter', 'sections', ...arrays, 'extensions', 'superseded'];
export const utf8 = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
export const writeCSV = rows => `${rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')}\r\n`;

export function readCSV(text, header) {
  const rows = []; let row = []; let cell = ''; let at = 0; let quoted = false; let closed = false;
  while (at < text.length) {
    const c = text[at++];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (text[at] === '"') { cell += '"'; at++; }
      else { quoted = false; closed = true; }
      continue;
    }
    if (c === '"') { check(cell === '' && !closed, 'CSV quote'); quoted = true; continue; }
    if (c === ',' || c === '\r' || c === '\n') {
      check(c !== '\r' || text[at++] === '\n', 'CSV CRLF'); row.push(cell); cell = ''; closed = false;
      if (c !== ',') { rows.push(row); row = []; }
      continue;
    }
    check(!closed, 'CSV text after quoted cell'); cell += c;
  }
  check(!quoted, 'CSV unterminated quoted cell');
  if (cell !== '' || closed || row.length) { row.push(cell); rows.push(row); }
  check(jcs(rows[0]) === jcs(header) && rows.every(item => item.length === header.length), 'CSV header/width');
  return rows.slice(1);
}

function parts(pointer) {
  if (pointer === '') return [];
  check(pointer.startsWith('/'), 'CSV pointer');
  return pointer.slice(1).split('/').map(segment => {
    check(!/~(?![01])/.test(segment), 'CSV pointer escape');
    const key = segment.replaceAll('~1', '/').replaceAll('~0', '~');
    check(esc(key) === segment, 'CSV pointer alias'); return key;
  });
}
function at(value, keys) {
  for (const key of keys) { check(value !== undefined && Object.hasOwn(value, key), 'CSV missing path'); value = value[key]; }
  return value;
}
const kind = value => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
export function flatten(value, pointer = '') {
  const type = kind(value);
  const rows = [[pointer, type, jcs(type === 'object' ? {} : type === 'array' ? [] : value)]];
  if (type === 'array') value.forEach((child, index) => rows.push(...flatten(child, `${pointer}/${index}`)));
  if (type === 'object') for (const key of Object.keys(value).sort()) rows.push(...flatten(value[key], `${pointer}/${esc(key)}`));
  return rows;
}
export function unflatten(rows) {
  const nodes = new Map();
  for (const [pointer, type, token] of rows) {
    const keys = parts(pointer); const id = jcs(keys);
    check(!nodes.has(id), 'CSV duplicate decoded path');
    const value = readJSON(token); check(kind(value) === type, 'CSV node type');
    check((type !== 'object' && type !== 'array') || Object.keys(value).length === 0, 'CSV hidden container values');
    nodes.set(id, { keys, type, value });
  }
  let visited = 0;
  function build(keys) {
    const node = nodes.get(jcs(keys)); check(node, 'CSV missing parent/root'); visited++;
    const children = [...nodes.values()].filter(item => item.keys.length === keys.length + 1 && item.keys.slice(0, -1).every((key, index) => key === keys[index]));
    if (node.type !== 'object' && node.type !== 'array') { check(children.length === 0, 'CSV scalar children'); return node.value; }
    const out = node.type === 'array' ? [] : {};
    if (node.type === 'array') children.sort((a, b) => Number(a.keys.at(-1)) - Number(b.keys.at(-1)));
    children.forEach((child, index) => {
      const key = child.keys.at(-1);
      if (node.type === 'array') { check(key === String(index), 'CSV array index gap/alias'); out.push(build(child.keys)); }
      else put(out, key, build(child.keys));
    });
    return out;
  }
  const value = build([]); check(visited === nodes.size, 'CSV orphan node'); return value;
}

function emptySlots(model) {
  return Object.keys(model.superseded).filter(id => model.superseded[id].length === 0)
    .map(id => ({ path: `/superseded/${esc(id)}`, kind: 'array' })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
export function encodeCSV(input) {
  const model = stamp(input);
  const rows = descriptors(model);
  const extra = Object.fromEntries(Object.entries(model).filter(([key]) => !RESERVED.includes(key)));
  const files = {};
  files['document.csv'] = writeCSV([DOC, [model.envelope_version, model.format_version,
    jcs(model.generated_at ?? null), jcs(model.generator ?? null), model.semantic_digest,
    jcs(model.frontmatter.deal_id), jcs(model.frontmatter.deal_name), jcs(extra), jcs(emptySlots(model))]]);
  files['frontmatter.csv'] = writeCSV([FLAT, ...flatten(model.frontmatter)]);
  files['blocks.csv'] = writeCSV([BLOCK, ...rows.map(row => [row.ref, row.collection, jcs(row.section), jcs(row.variant), row.ordinal ?? '', row.state, row.mode])]);
  const values = [VALUE]; const prose = [PROSE];
  for (const row of rows) {
    const { _meta, ...content } = row.block.content;
    const extra = Object.fromEntries(Object.entries(row.block).filter(([key]) => !['annotation', 'content', 'prose'].includes(key)));
    const scopes = { annotation: row.block.annotation, meta: _meta, content, 'block-extra': extra };
    for (const scope of SCOPES) for (const value of flatten(scopes[scope])) values.push([row.ref, scope, ...value]);
    if (Object.hasOwn(row.block, 'prose')) prose.push([`${row.ref}/prose`, 'block', row.ref, jcs(row.block.prose)]);
  }
  files['block_values.csv'] = writeCSV(values); files['prose.csv'] = writeCSV(prose);
  const manifest = { bundle_version: REPRESENTATION, envelope_version: VERSION, format_version: model.format_version,
    canonicalization_version: VERSION, semantic_digest: model.semantic_digest, normalized_value_encoding: 'canonical-json', csv_dialect: 'rfc4180',
    files: Object.keys(files).sort().map(path => ({ path, media_type: 'text/csv; charset=utf-8', sha256: sha(Buffer.from(files[path])), bytes: Buffer.byteLength(files[path]), fidelity: 'model' })), views: [] };
  files['manifest.json'] = JSON.stringify(manifest);
  return files;
}

export function decodeCSV(input) {
  const files = Object.fromEntries(Object.entries(input).map(([path, value]) => [path, typeof value === 'string' ? Buffer.from(value) : value]));
  check(Object.keys(files).length <= 100 && Object.keys(files).every(zipReader.isSafeZipPath), 'CSV file/path limit');
  const manifest = readJSON(utf8(files['manifest.json']));
  check(manifest.bundle_version === REPRESENTATION && manifest.envelope_version === VERSION && manifest.canonicalization_version === VERSION, 'CSV supported regime');
  check(manifest.normalized_value_encoding === 'canonical-json' && manifest.csv_dialect === 'rfc4180' && Array.isArray(manifest.views), 'CSV manifest encoding');
  const listed = new Set();
  for (const entry of manifest.files) {
    check(typeof entry.path === 'string' && !listed.has(entry.path), 'CSV inventory duplicate'); listed.add(entry.path);
    const bytes = files[entry.path]; check(bytes && bytes.length === entry.bytes, 'CSV raw byte count');
    check(sha(bytes) === entry.sha256, 'CSV raw byte hash');
    if (!REQUIRED.includes(entry.path)) check(entry.fidelity === 'view' && manifest.views.some(view => view.path === entry.path), 'CSV unbound model file');
    else check(entry.fidelity === 'model', 'CSV model/view substitution');
  }
  check(REQUIRED.every(path => listed.has(path)) && Object.keys(files).every(path => path === 'manifest.json' || listed.has(path)), 'CSV inventory membership');
  const decoded = Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path, utf8(bytes)]));
  const table = (path, header) => readCSV(decoded[path], header);
  const documents = table('document.csv', DOC); check(documents.length === 1, 'CSV document cardinality');
  const doc = documents[0]; const extra = readJSON(doc[7]);
  check(object(extra) && Object.keys(extra).every(key => !RESERVED.includes(key)), 'CSV outer overlap');
  const model = { ...extra, envelope_version: doc[0], format_version: doc[1], semantic_digest: doc[4], frontmatter: unflatten(table('frontmatter.csv', FLAT)),
    sections: {}, pipeline_log: [], custom_calculations: [], custom_scenarios: [], extensions: {}, superseded: {} };
  const generated = readJSON(doc[2]); const generator = readJSON(doc[3]);
  if (generated !== null) model.generated_at = generated;
  if (generator !== null) model.generator = generator;
  check(jcs(readJSON(doc[5])) === jcs(model.frontmatter.deal_id) && jcs(readJSON(doc[6])) === jcs(model.frontmatter.deal_name), 'CSV frontmatter echoes');
  const empty = readJSON(doc[8]); check(Array.isArray(empty), 'CSV empty slots');
  let previous = '';
  for (const record of empty) {
    check(object(record) && Object.keys(record).sort().join(',') === 'kind,path' && record.path > previous, 'CSV empty descriptor order/shape'); previous = record.path;
    const path = parts(record.path); check(path.length === 2 && ['sections', 'superseded'].includes(path[0]), 'CSV empty descriptor location');
    check(record.kind === (path[0] === 'sections' ? 'object' : 'array'), 'CSV empty descriptor kind');
    put(model[path[0]], path[1], record.kind === 'array' ? [] : {});
  }
  const valueRows = new Map();
  for (const [ref, scope, ...value] of table('block_values.csv', VALUE)) {
    check(SCOPES.includes(scope), 'CSV unknown scope'); parts(ref);
    const key = `${ref}\0${scope}`; if (!valueRows.has(key)) valueRows.set(key, []); valueRows.get(key).push(value);
  }
  const prose = new Map();
  for (const [ref, scope, block, token] of table('prose.csv', PROSE)) {
    check(scope === 'block' && ref === `${block}/prose` && !prose.has(block), 'CSV prose descriptor');
    const value = readJSON(token); check(typeof value === 'string', 'CSV prose type'); prose.set(block, value);
  }
  const seen = new Set(); const received = [];
  const append = (parent, index, block) => { check(String(parent.length) === index, 'CSV block ordinal gap/alias'); parent.push(block); };
  for (const row of table('blocks.csv', BLOCK)) {
    const [ref, collection, sectionToken, variantToken, ordinal, state, mode] = row;
    check(!seen.has(ref), 'CSV duplicate block'); seen.add(ref);
    const section = readJSON(sectionToken); const variant = readJSON(variantToken);
    check(typeof section === 'string' && (variant === null || typeof variant === 'string'), 'CSV identity types');
    const values = {};
    for (const scope of SCOPES) {
      const key = `${ref}\0${scope}`; check(valueRows.has(key), 'CSV missing scope');
      values[scope] = unflatten(valueRows.get(key)); valueRows.delete(key);
      check(object(values[scope]), 'CSV scope root type');
    }
    check(!Object.hasOwn(values.content, '_meta') && !['annotation', 'content', 'prose'].some(key => Object.hasOwn(values['block-extra'], key)), 'CSV block reserved overlap');
    const block = { ...values['block-extra'], annotation: values.annotation, content: { _meta: values.meta, ...values.content } };
    if (prose.has(ref)) { block.prose = prose.get(ref); prose.delete(ref); }
    const path = parts(ref);
    check(state === (collection === 'superseded' ? 'superseded' : 'current'), 'CSV state');
    if (collection !== 'extensions') check(mode === '', 'CSV extension mode outside extensions');
    if (collection === 'sections') {
      check(ordinal === '' && path[0] === collection && path[1] === section && [2, 3].includes(path.length), 'CSV section descriptor');
      if (path.length === 2) { check(!Object.hasOwn(model.sections, section), 'CSV section overlap'); put(model.sections, section, block); }
      else {
        check(path[2] === variant, 'CSV section variant');
        if (!Object.hasOwn(model.sections, section)) put(model.sections, section, {});
        check(object(model.sections[section]) && !Object.hasOwn(model.sections[section], 'annotation') && !Object.hasOwn(model.sections[section], variant), 'CSV section collision');
        put(model.sections[section], variant, block);
      }
    } else if (arrays.includes(collection)) {
      check(path.join('/') === `${collection}/${ordinal}` && variant === null, 'CSV append descriptor'); append(model[collection], ordinal, block);
    } else if (collection === 'superseded') {
      check(path.length === 3 && path[0] === collection && path[1] === section && path[2] === ordinal && variant === null, 'CSV history descriptor');
      if (!Object.hasOwn(model.superseded, section)) put(model.superseded, section, []);
      check(!empty.some(record => record.path === `/superseded/${esc(section)}`), 'CSV empty/nonempty overlap'); append(model.superseded[section], ordinal, block);
    } else {
      check(collection === 'extensions' && path[0] === collection && path[1] === section, 'CSV collection');
      if (mode === 'single') {
        check(path.length === 3 && path[2] === 'block' && ordinal === '' && !Object.hasOwn(model.extensions, section), 'CSV single descriptor');
        check(variant === (block.annotation.variant ?? null), 'CSV single identity'); put(model.extensions, section, { mode, block });
      } else {
        check(mode === 'variants' && path.length === 5 && path[2] === 'blocks' && path[3] === ordinal && path[4] === 'block', 'CSV variants descriptor');
        if (!Object.hasOwn(model.extensions, section)) put(model.extensions, section, { mode, blocks: [] });
        check(model.extensions[section].mode === mode, 'CSV extension mode collision'); append(model.extensions[section].blocks, ordinal, { variant, block });
      }
    }
    received.push(row);
  }
  check(valueRows.size === 0 && prose.size === 0, 'CSV unused rows');
  validateModel(model, true);
  const expected = descriptors(model).map(row => [row.ref, row.collection, jcs(row.section), jcs(row.variant), String(row.ordinal ?? ''), row.state, row.mode]);
  // Descriptor order is canonical; metadata cannot alias another reconstructed address.
  check(jcs(received) === jcs(expected), 'CSV descriptor agreement/order');
  check(manifest.semantic_digest === model.semantic_digest && manifest.format_version === model.format_version, 'CSV manifest/model identity');
  return model;
}

export function encodeZIP(model, level = 6) {
  const files = encodeCSV(model);
  return zipSync(Object.fromEntries(Object.keys(files).sort().map(path => [path, [Buffer.from(files[path]), { level, mtime: new Date('1980-01-02T00:00:00Z') }]])));
}
export function decodeZIP(bytes, options = {}) {
  const files = zipReader.extractZipSafely(bytes, options, (code, message) => { throw new TypeError(`${code}: ${message}`); });
  return decodeCSV(files);
}
