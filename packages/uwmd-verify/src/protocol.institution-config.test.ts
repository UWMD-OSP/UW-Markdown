import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import type { InstitutionConfig } from './types.js';
import type { ProtocolError } from './protocol.js';

const ajv = new Ajv2020.default({ strict: true, validateFormats: false });
const schema = (name: string) => JSON.parse(readFileSync(resolve(process.cwd(), `../../spec/schemas/${name}.schema.json`), 'utf8'));
const configSchema = schema('institution-config');
const admit = ajv.compile(configSchema);
const errorSchema = schema('protocol-error');
const admitError = ajv.compile(errorSchema);

describe('RFC0097 public wire and operation-error boundaries', () => {
  it.each([
    [{}, true], [{ validation_overrides: {} }, true],
    [{ validation_overrides: { dscr_warning_below: -1, ltv_warning_above: 0, debt_yield_warning_below: 1.5 } }, true],
    [{ institution_id: null, opaque: [true, 'x'], validation_overrides: { unrelated: { retained: true } } }, true],
    [null, false], [[], false], [true, false],
    [{ thresholds: {} }, false], [{ thresholds: null, validation_overrides: {} }, false],
    [{ validation_overrides: null }, false], [{ validation_overrides: [] }, false],
    [{ validation_overrides: { dscr_warning_below: null } }, false],
    [{ validation_overrides: { ltv_warning_above: false } }, false],
    [{ validation_overrides: { debt_yield_warning_below: '0.09' } }, false],
    [{ validation_overrides: { dscr_warning_below: Number.POSITIVE_INFINITY } }, false],
  ])('asserts only the accepted minimum wire shape %j', (input, valid) => {
    expect(admit(input)).toBe(valid);
  });
  it('leaves opaque data unassessed and requires separate byte/profile admission', () => {
    expect(admit({ opaque: Number.POSITIVE_INFINITY })).toBe(true);
    expect(admit({ opaque: '\ud800' })).toBe(true);
    expect(configSchema.description).toContain('runtime checks');
    // Schema shape acceptance is not whole-input profile admission. Runtime
    // byte/duplicate/Unicode controls separately reject malformed selected JSON.
  });
  it('pins exported flat type without requiring unrelated metadata', () => {
    const valid: InstitutionConfig = { validation_overrides: { dscr_warning_below: 0, opaque: [] }, institution_id: null };
    const empty: InstitutionConfig = {};
    // @ts-expect-error root nested thresholds is not an admitted wire alias
    const nested: InstitutionConfig = { thresholds: {} };
    // @ts-expect-error recognized wire leaves are numbers, never coerced strings
    const stringLeaf: InstitutionConfig = { validation_overrides: { ltv_warning_above: '0.7' } };
    expect(admit(valid)).toBe(true); expect(admit(empty)).toBe(true);
    expect(admit(nested)).toBe(false); expect(admit(stringLeaf)).toBe(false);
  });
  it.each([
    ['VAL-INSTITUTION-CONFIG-UNREADABLE', 'Selected institution config could not be read.', undefined],
    ['VAL-INSTITUTION-CONFIG-MALFORMED', 'Selected institution config is malformed.', 'validation_overrides.ltv_warning_above'],
  ])('uses existing ProtocolError shape for %s', (code, message, pointer) => {
    const error: ProtocolError = { category: 'validate', code: code!, message: message!, ...(pointer === undefined ? {} : { pointer }) };
    expect(admitError(error)).toBe(true);
    expect(admitError({ ...error, overall_status: 'clean' })).toBe(false);
    expect(errorSchema.properties.pointer.description).toContain('selected institution config');
  });
});
