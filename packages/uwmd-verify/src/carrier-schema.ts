// Bounded executable mirror of the Envelope/block schema vocabulary.
// Full carrier admission only: source commitments deliberately do not call this.
import { carrierSchemas } from './carrier-schema-data.js';
type Schema = Record<string, any>;
const schemas = carrierSchemas as Schema[];
const record = (v: any) => v !== null && typeof v === 'object' && !Array.isArray(v);
const equal = (a: any, b: any): boolean => a === b || a !== null && b !== null && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b) && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.hasOwn(b, k) && equal(a[k], b[k]));
function dateTime(v: string): boolean {
  const parts = v.split(/t|\s/i);
  if (parts.length !== 2) return false;
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(parts[0]);
  const time = /^(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)(z|([+-])(\d{2})(?::?(\d{2}))?)$/i.exec(parts[1]);
  if (!date || !time) return false;
  const y = +date[1];
  const m = +date[2];
  const d = +date[3];
  const days = [0,31,y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
  if (m < 1 || m > 12 || d < 1 || d > days[m]) return false;
  const h = +time[1];
  const min = +time[2];
  const sec = +time[3];
  const zoneH = +(time[6] ?? 0);
  const zoneM = +(time[7] ?? 0);
  if (zoneH > 23 || zoneM > 59) return false;
  if (h <= 23 && min <= 59 && sec < 60) return true;
  const sign = time[5] === '-' ? -1 : 1;
  const utcMin = min - zoneM * sign;
  const utcH = h - zoneH * sign - (utcMin < 0 ? 1 : 0);
  return (utcH === 23 || utcH === -1) && (utcMin === 59 || utcMin === -1) && sec < 61;
}
function accepts(value: any, schema: Schema | boolean, root: Schema): boolean {
  if (typeof schema === 'boolean') return schema;
  if (schema.$ref) {
    const [id, fragment = ''] = schema.$ref.split('#');
    const target = id ? schemas.find(item => item.$id === id)! : root;
    const resolved = fragment.split('/').slice(1).reduce((node: Schema, part: string) => node[part.replaceAll('~1','/').replaceAll('~0','~')], target);
    if (!accepts(value, resolved, target)) return false;
  }
  if (Object.hasOwn(schema, 'const') && !equal(value, schema.const)) return false;
  if (schema.enum && !schema.enum.some((item: any) => equal(value, item))) return false;
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type: string) => type === 'object' ? record(value) : type === 'array' ? Array.isArray(value) : type === 'null' ? value === null : type === 'integer' ? Number.isInteger(value) : (type === 'string' && typeof value === 'string' || type === 'number' && typeof value === 'number' || type === 'boolean' && typeof value === 'boolean'))) return false;
  }
  if (schema.allOf && !schema.allOf.every((s: Schema) => accepts(value,s,root))) return false;
  if (schema.anyOf && !schema.anyOf.some((s: Schema) => accepts(value,s,root))) return false;
  if (schema.oneOf && schema.oneOf.filter((s: Schema) => accepts(value,s,root)).length !== 1) return false;
  if (schema.not && accepts(value,schema.not,root)) return false;
  if (schema.if) {
    const branch = accepts(value,schema.if,root) ? schema.then : schema.else;
    if (branch && !accepts(value,branch,root)) return false;
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && [...value].length < schema.minLength) return false;
    if (schema.pattern && !new RegExp(schema.pattern,'u').test(value)) return false;
    if (schema.format === 'date-time' && !dateTime(value)) return false;
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) return false;
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) return false;
    if (schema.items && !value.every(item => accepts(item,schema.items,root))) return false;
    if (schema.contains && !value.some(item => accepts(item,schema.contains,root))) return false;
  }
  if (record(value)) {
    if (schema.required?.some((k: string) => !Object.hasOwn(value,k))) return false;
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) return false;
    for (const key of Object.keys(value)) {
      const member = schema.properties && Object.hasOwn(schema.properties,key) ? schema.properties[key] : undefined;
      if (member !== undefined ? !accepts(value[key], member, root) : schema.additionalProperties !== undefined && !accepts(value[key], schema.additionalProperties, root)) return false;
    }
  }
  return true;
}
export function admitsCarrierSchema(value: unknown): boolean { return accepts(value,schemas[0],schemas[0]); }
