// Isolated RFC 0089 candidate. No production export or capability claim.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { canonicalize } from '../../packages/uwmd-verify/dist/integrity-canonical.js';
import * as nativeEnvelope from '../../packages/uwmd-verify/dist/envelope.js';
import { parseUWFile, parsedPhysicalBlocks } from '../../packages/uwmd-verify/dist/parser.js';

export const VERSION = '2.0';
export const REPRESENTATION = '2.0.0';
export const NAMESPACE = 'https://uwmd.org/ns/document/2';
export const check = (value, reason) => { if (!value) throw new TypeError(reason); };
export const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const has = (value, key) => Object.hasOwn(value, key);
export const put = (value, key, item) => Object.defineProperty(value, key, {
  value: item, enumerable: true, writable: true, configurable: true,
});
export const sha = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
export const jcs = canonicalize;
export const esc = key => key.replaceAll('~', '~0').replaceAll('/', '~1');
export const order = (a, b) => a === null ? b === null ? 0 : -1 : b === null ? 1 : a < b ? -1 : a > b ? 1 : 0;
export const arrays = ['pipeline_log', 'custom_calculations', 'custom_scenarios'];

export function unicode(text) {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(++i);
      check(next >= 0xdc00 && next <= 0xdfff, 'unpaired Unicode surrogate');
    } else check(code < 0xdc00 || code > 0xdfff, 'unpaired Unicode surrogate');
  }
  return text;
}

/** Recursive raw-token reader: duplicate decoded keys never enter an object. */
export function readJSON(text) {
  let at = 0;
  const space = () => { while (/[\x20\t\r\n]/.test(text[at] ?? '\0')) at++; };
  const string = () => {
    const start = at++;
    for (; at < text.length; at++) {
      if (text[at] === '\\') at++;
      else if (text[at] === '"') return unicode(JSON.parse(text.slice(start, ++at)));
    }
    throw new TypeError('unterminated JSON string');
  };
  function value(depth = 0) {
    check(depth < 128, 'JSON depth limit'); space();
    if (text[at] === '"') return string();
    if (text[at] === '{') {
      at++; space(); const out = {};
      if (text[at] === '}') { at++; return out; }
      for (;;) {
        check(text[at] === '"', 'JSON object name');
        const key = string(); check(!has(out, key), 'duplicate decoded JSON name');
        space(); check(text[at++] === ':', 'JSON colon'); put(out, key, value(depth + 1)); space();
        if (text[at] === '}') { at++; return out; }
        check(text[at++] === ',', 'JSON object separator'); space();
      }
    }
    if (text[at] === '[') {
      at++; space(); const out = [];
      if (text[at] === ']') { at++; return out; }
      for (;;) {
        out.push(value(depth + 1)); space();
        if (text[at] === ']') { at++; return out; }
        check(text[at++] === ',', 'JSON array separator');
      }
    }
    for (const [token, result] of [['true', true], ['false', false], ['null', null]]) {
      if (text.startsWith(token, at)) { at += token.length; return result; }
    }
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(at));
    check(match, 'JSON scalar syntax'); at += match[0].length;
    const result = Number(match[0]); check(Number.isFinite(result), 'nonfinite binary64'); return result;
  }
  const result = value(); space(); check(at === text.length, 'JSON trailing input'); return result;
}

const schema = JSON.parse(readFileSync(new URL('../../spec/schemas/uw-document-envelope.schema.json', import.meta.url), 'utf8'));
schema.$id = 'https://uwmd.org/candidate/0089/envelope';
schema.title = 'Unaccepted complete Envelope candidate';
schema.properties.envelope_version.const = VERSION;
schema.$defs.extension = {
  oneOf: [
    { type: 'object', additionalProperties: false, required: ['mode', 'block'], properties: {
      mode: { const: 'single' }, block: { $ref: '#/$defs/block' },
    } },
    { type: 'object', additionalProperties: false, required: ['mode', 'blocks'], properties: {
      mode: { const: 'variants' }, blocks: { type: 'array', minItems: 1, items: {
        type: 'object', additionalProperties: false, required: ['variant', 'block'], properties: {
          variant: { type: ['string', 'null'] }, block: { $ref: '#/$defs/block' },
        },
      } },
    } },
  ],
};
schema.properties.extensions.additionalProperties = { $ref: '#/$defs/extension' };
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(JSON.parse(readFileSync(new URL('../../spec/schemas/uwmd-block.schema.json', import.meta.url), 'utf8')));
const shape = ajv.compile(schema);
export const candidateSchema = schema;

export function descriptors(model) {
  const rows = [];
  const add = (ref, collection, section, variant, ordinal, state, mode, block) => {
    check(object(block) && object(block.annotation) && object(block.content), 'block shape');
    check(block.annotation.section === section && block.content._meta?.section === section, 'section identity');
    check(!has(block.annotation, 'variant') || typeof block.annotation.variant === 'string', 'annotation variant');
    rows.push({ ref, collection, section, variant, ordinal, state, mode, block });
  };
  for (const id of Object.keys(model.sections).sort()) {
    const entry = model.sections[id];
    if (object(entry.annotation) && object(entry.content)) add(`/sections/${esc(id)}`, 'sections', id, entry.annotation.variant ?? null, null, 'current', '', entry);
    else for (const key of Object.keys(entry).sort()) add(`/sections/${esc(id)}/${esc(key)}`, 'sections', id, key, null, 'current', '', entry[key]);
  }
  for (const key of arrays) model[key].forEach((block, index) => add(`/${key}/${index}`, key, block.annotation.section, null, index, 'current', '', block));
  for (const id of Object.keys(model.extensions).sort()) {
    const entry = model.extensions[id]; check(id.startsWith('x_'), 'extension section id');
    if (entry.mode === 'single') add(`/extensions/${esc(id)}/block`, 'extensions', id, entry.block.annotation.variant ?? null, null, 'current', 'single', entry.block);
    else {
      let previous; const seen = new Set();
      entry.blocks.forEach((record, index) => {
        const key = record.variant;
        check(key === (record.block.annotation.variant ?? null), 'exact nullable identity');
        check(!seen.has(key) && (index === 0 || order(previous, key) < 0), 'duplicate/noncanonical extension order');
        seen.add(key); previous = key;
        add(`/extensions/${esc(id)}/blocks/${index}/block`, 'extensions', id, key, index, 'current', 'variants', record.block);
      });
    }
  }
  for (const id of Object.keys(model.superseded).sort()) model.superseded[id].forEach((block, index) => add(`/superseded/${esc(id)}/${index}`, 'superseded', id, null, index, 'superseded', '', block));
  return rows;
}

export function validateModel(model, stamped = false) {
  check(shape(model), `candidate shape: ${ajv.errorsText(shape.errors)}`);
  jcs(model); // Complete Unicode/finite-number admission, including unknown values.
  descriptors(model);
  for (const entry of Object.values(model.extensions)) {
    const blocks = entry.mode === 'single' ? [entry.block] : entry.blocks.map(record => record.block);
    for (const block of blocks) check(block.annotation.superseded !== true && block.content._meta.lifecycle?.superseded !== true, 'historical extension in active collection');
  }
  if (stamped) check(model.semantic_digest === digest(model), 'candidate semantic digest');
  return model;
}

export function semantic(model) {
  const { generated_at: _time, generator: _generator, semantic_digest: _digest, ...value } = model;
  return value;
}
export const preimage = model => jcs(semantic(model));
export const digest = model => sha(Buffer.from(preimage(model)));
export function stamp(model) { validateModel(model); return { ...model, semantic_digest: digest(model) }; }
const envelopeBlock = block => ({ annotation: block.annotation, content: block.content, ...(block.prose ? { prose: block.prose } : {}) });

/** Complete source projection, with exact occurrence accounting separate from selection. */
export function projectSource(source) {
  const parsed = typeof source === 'string' ? parseUWFile(source) : source;
  const physical = parsed.candidatePhysicalBlocks ?? parsedPhysicalBlocks(parsed);
  check(physical.length || !Object.keys(parsed.extensions).length, 'missing physical source evidence');
  const known = ['annotation', 'meta', 'content', 'prose', 'rawJson', 'lineStart', 'lineEnd'];
  check(physical.every(block => Object.keys(block).every(key => known.includes(key))), 'unknown parsed block member cannot borrow source attribution');
  const base = nativeEnvelope.toUWEnvelope(parsed, { generatedAt: '2000-01-01T00:00:00Z', generator: 'candidate' });
  const extensions = {};
  const superseded = { ...base.superseded };
  const extIds = new Set(physical.filter(block => block.annotation.section.startsWith('x_')).map(block => block.annotation.section));
  const occurrences = [];
  for (const id of extIds) {
    const blocks = physical.filter(block => block.annotation.section === id);
    check(jcs(base.extensions[id]) === jcs(envelopeBlock(blocks.at(-1))), 'parsed extension differs from retained source evidence');
    const historical = block => block.annotation.superseded === true || block.meta?.lifecycle?.superseded === true;
    const active = blocks.filter(block => !historical(block));
    const roles = active.some(block => has(block.content, '_role'));
    const variants = roles && active.some(block => has(block.annotation, 'variant'));
    const history = [];
    const selected = new Map();
    for (const block of blocks) {
      if (historical(block)) { history.push(block); continue; }
      const key = variants ? block.annotation.variant ?? null : null;
      if (selected.has(key)) history.push(selected.get(key));
      selected.set(key, block);
    }
    if (selected.size) {
      if (variants) put(extensions, id, { mode: 'variants', blocks: [...selected].sort(([a], [b]) => order(a, b)).map(([variant, block]) => ({ variant, block: envelopeBlock(block) })) });
      else put(extensions, id, { mode: 'single', block: envelopeBlock(selected.get(null)) });
    }
    if (history.length) put(superseded, id, history.map(envelopeBlock));
    for (const block of [...selected.values(), ...history]) occurrences.push(block.content);
  }
  check(Object.keys(base.extensions).every(id => extIds.has(id)), 'unaccounted parsed extension');
  for (const entry of Object.values(parsed.sections)) {
    if (object(entry.annotation) && object(entry.content)) occurrences.push(entry.content);
    else for (const block of Object.values(entry)) occurrences.push(block.content);
  }
  for (const key of arrays) for (const block of parsed[key]) occurrences.push(block.content);
  for (const [id, blocks] of Object.entries(parsed.superseded)) {
    if (!extIds.has(id)) for (const block of blocks) occurrences.push(block.content);
  }
  check(occurrences.length === physical.length && physical.every(block => occurrences.filter(value => value === block.content).length === 1), 'physical occurrence accounting');
  const model = { ...base, envelope_version: VERSION, extensions, superseded };
  validateModel(model);
  return { model, physical_count: physical.length, accounted_count: occurrences.length };
}

export function portable(model) {
  const block = input => {
    const { _meta, _notes: _notes, ...content } = input.content;
    return { ...(has(input.content, '_meta') ? { meta: _meta } : {}), content };
  };
  const result = {};
  for (const [id, entry] of Object.entries(model.extensions)) put(result, id, entry.mode === 'single'
    ? { mode: 'single', block: block(entry.block) }
    : { mode: 'variants', blocks: entry.blocks.map(record => ({ variant: record.variant, block: block(record.block) })) });
  return result;
}

export function toMarkdown(model) {
  validateModel(model);
  const lines = ['---'];
  for (const [key, value] of Object.entries(model.frontmatter)) {
    check(!object(value) && !Array.isArray(value) && !/[\s:]/.test(key), 'Markdown frontmatter not representable');
    lines.push(`${key}: ${JSON.stringify(value)}`);
  }
  lines.push('---', '');
  for (const { block } of descriptors(model)) {
    const annotation = Object.entries(block.annotation).filter(([key]) => key !== 'section');
    check(annotation.every(([, value]) => !/\s/.test(String(value))), 'Markdown annotation not representable');
    if (block.prose) lines.push(block.prose);
    lines.push(`\`\`\`json uw:section=${block.annotation.section}${annotation.map(([key, value]) => ` ${key}=${value}`).join('')}`,
      JSON.stringify(block.content), '\`\`\`', '');
  }
  const source = lines.join('\n');
  check(preimage(projectSource(source).model) === preimage(model), 'Markdown reprojection would change the complete model');
  return source;
}
