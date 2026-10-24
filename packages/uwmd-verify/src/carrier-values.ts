import { hasBlockShape } from './block-kind.js';
// RFC 0089 carrier primitives, promoted from the independently reviewed candidate.
// Dynamic trees remain internal: every carrier passes JSON admission and the
// Envelope schema before becoming a public UWDocumentEnvelope.
import { canonicalize } from './integrity-canonical.js';
import { sha256BytesHex } from './integrity.js';
import { assertUWEnvelope, stampEnvelopeDigest, verifyEnvelopeDigest } from './envelope.js';
import { assertJSONValue } from './json-admission.js';
export const VERSION = '2.0';
export const REPRESENTATION = '2.0.0';
export const NAMESPACE = 'https://uwmd.org/ns/document/2';
export function check(value: unknown, reason: string): asserts value { if (!value) throw new TypeError(reason); }
export const object = (value: any): value is Record<string, any> => value !== null && typeof value === 'object' && !Array.isArray(value);
export const has = (value: object, key: string) => Object.hasOwn(value, key);
export const put = (value: object, key: string, item: unknown) => Object.defineProperty(value, key, { value: item, enumerable: true, writable: true, configurable: true });
export const sha = async (bytes: Uint8Array) => `sha256:${await sha256BytesHex(bytes)}`;
export const jcs = canonicalize;
export const esc = (key: string) => key.replaceAll('~', '~0').replaceAll('/', '~1');
export const arrays = ['pipeline_log', 'custom_calculations', 'custom_scenarios'];
export function unicode(text: string): string { canonicalize(text); return text; }
export async function validateModel(model: any, stamped = false) {
  assertUWEnvelope(model);
  if (stamped) check((await verifyEnvelopeDigest(model)).valid, 'semantic digest mismatch');
  return model;
}
export async function stamp(model: any) {
  assertJSONValue(model); assertUWEnvelope(model);
  return stampEnvelopeDigest(model);
}
export interface CarrierBlock { ref: string; collection: string; section: string; variant: string | null; ordinal: number | null; state: string; mode: string; block: any; }
const order = (a: string | null, b: string | null) => a === null ? b === null ? 0 : -1 : b === null ? 1 : a < b ? -1 : a > b ? 1 : 0;
/** Recursive raw-token reader: duplicate decoded keys never enter an object. */
export function readJSON(text: string): any {
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
  function value(depth = 0): any {
    check(depth < 128, 'JSON depth limit'); space();
    if (text[at] === '"') return string();
    if (text[at] === '{') {
      at++; space(); const out: Record<string, any> = {};
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
      at++; space(); const out: any[] = [];
      if (text[at] === ']') { at++; return out; }
      for (;;) {
        out.push(value(depth + 1)); space();
        if (text[at] === ']') { at++; return out; }
        check(text[at++] === ',', 'JSON array separator');
      }
    }
    for (const [token, result] of [['true', true], ['false', false], ['null', null]] as const) {
      if (text.startsWith(token, at)) { at += token.length; return result; }
    }
    const match = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(at));
    check(match, 'JSON scalar syntax'); at += match[0].length;
    const result = Number(match[0]); check(Number.isFinite(result), 'nonfinite binary64'); return result;
  }
  const result = value(); space(); check(at === text.length, 'JSON trailing input'); return result;
}

export function descriptors(model: any) {
  const rows: CarrierBlock[] = [];
  const add = (ref: string, collection: string, section: string, variant: string | null, ordinal: number | null, state: string, mode: string, block: any) => {
    check(object(block) && object(block.annotation) && object(block.content), 'block shape');
    check(block.annotation.section === section && block.content._meta?.section === section, 'section identity');
    check(!has(block.annotation, 'variant') || typeof block.annotation.variant === 'string', 'annotation variant');
    rows.push({ ref, collection, section, variant, ordinal, state, mode, block });
  };
  for (const id of Object.keys(model.sections).sort()) {
    const entry = model.sections[id];
    if (hasBlockShape(entry)) add(`/sections/${esc(id)}`, 'sections', id, entry.annotation.variant ?? null, null, 'current', '', entry);
    else for (const key of Object.keys(entry).sort()) add(`/sections/${esc(id)}/${esc(key)}`, 'sections', id, key, null, 'current', '', entry[key]);
  }
  for (const key of arrays) model[key].forEach((block: any, index: number) => add(`/${key}/${index}`, key, block.annotation.section, null, index, 'current', '', block));
  for (const id of Object.keys(model.extensions).sort()) {
    const entry = model.extensions[id]; check(id.startsWith('x_'), 'extension section id');
    if (entry.mode === 'single') add(`/extensions/${esc(id)}/block`, 'extensions', id, entry.block.annotation.variant ?? null, null, 'current', 'single', entry.block);
    else {
      let previous: string | null = null; const seen = new Set();
      entry.blocks.forEach((record: any, index: number) => {
        const key = record.variant;
        check(key === (record.block.annotation.variant ?? null), 'exact nullable identity');
        check(!seen.has(key) && (index === 0 || order(previous, key) < 0), 'duplicate/noncanonical extension order');
        seen.add(key); previous = key;
        add(`/extensions/${esc(id)}/blocks/${index}/block`, 'extensions', id, key, index, 'current', 'variants', record.block);
      });
    }
  }
  for (const id of Object.keys(model.superseded).sort()) model.superseded[id].forEach((block: any, index: number) => add(`/superseded/${esc(id)}/${index}`, 'superseded', id, null, index, 'superseded', '', block));
  return rows;
}

