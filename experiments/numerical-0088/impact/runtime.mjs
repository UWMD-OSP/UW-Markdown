// Research only: never imported by production source or written into dist.
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const candidate = await import(pathToFileURL(process.env.RESEARCH_CANDIDATE).href);
const output = process.env.RESEARCH_EVENTS;
const mode = process.env.RESEARCH_MODE;
let sequence = 0;
export function typed(value, ancestors = new Set()) {
  if (typeof value === 'number') {
    const buffer = new ArrayBuffer(8); const view = new DataView(buffer);
    view.setFloat64(0, value, false);
    return { type: 'binary64', word: view.getBigUint64(0, false).toString(16).padStart(16, '0'),
      value: Number.isFinite(value) ? String(value) : Number.isNaN(value) ? 'NaN' : value > 0 ? '+Infinity' : '-Infinity' };
  }
  if (typeof value === 'bigint') return { type: 'bigint', value: String(value) };
  if (value === undefined) return { type: 'undefined' };
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'function') return { type: 'function', name: value.name };
  if (typeof value === 'symbol') return { type: 'symbol', value: String(value) };
  if (ancestors.has(value)) return { type: 'cycle' };
  ancestors.add(value);
  let result;
  if (value instanceof Error) {
    result = { type: 'error', name: value.name, message: value.message, ...Object.fromEntries(
      Object.keys(value).sort().map(key => [key, typed(value[key], ancestors)])) };
  } else if (value instanceof Map) result = { type: 'map', entries: [...value].map(([k,v]) => [typed(k,ancestors),typed(v,ancestors)]) };
  else if (value instanceof Set) result = { type: 'set', values: [...value].map(v => typed(v,ancestors)) };
  else if (Array.isArray(value)) result = value.map(v => typed(v,ancestors));
  else result = Object.fromEntries(Object.keys(value).sort().map(key => [key,typed(value[key],ancestors)]));
  ancestors.delete(value);
  return result;
}
function emit(event) { appendFileSync(output, `${JSON.stringify({ sequence: sequence++, ...event })}\n`); }
function operation(op, args, site) {
  let result;
  try {
    result = mode === 'candidate' ? candidate[op](...args)
      : op === 'pow' ? args[0] ** args[1] : Math[op](...args);
  } catch (error) {
    emit({ kind: 'primitive', op, site, args: typed(args), error: typed(error) });
    throw error;
  }
  emit({ kind: 'primitive', op, site, args: typed(args), result: typed(result) });
  return result;
}
export const pow = (a,b,site) => operation('pow',[a,b],site);
export const log = (a,site) => operation('log',[a],site);
export const exp = (a,site) => operation('exp',[a],site);
export function capture(record, getters, site, ...args) {
  const snapshot = {}; const errors = [];
  for (const [name,get] of Object.entries(getters)) {
    try { snapshot[name] = typed(get()); }
    catch(error) {
      if (error instanceof ReferenceError) snapshot[name] = { type: 'not-initialized' };
      else errors.push({ name, error: typed(error) });
    }
  }
  emit({ kind: 'case', suite: args[0], scenario: args[1], status: args[2], message: args[3] ?? null,
    site, snapshot, capture_errors: errors });
  return record(...args);
}

// Standalone emit is a status-only forwarding closure declared before the actual
// values exist. Capture at the caller, then execute the original emit once.
export function captureStandalone(emitCase, getters, site, prefix, ...args) {
  return capture((_suite,_scenario,status,message)=>emitCase(args[0],status,message),
    getters,site,'standalone',`${prefix}${args[0]}`,args[1],args[2]);
}
