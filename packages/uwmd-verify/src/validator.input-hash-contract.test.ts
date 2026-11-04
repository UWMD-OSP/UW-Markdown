// RFC 0133 contract gates. Runtime refusal regressions land in the ordered implementation PR.
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { BUILTIN_REMEDIATIONS, validatorCodeFamily } from './protocol.js';

const schema = JSON.parse(readFileSync(new URL('../../../spec/schemas/uwmd-block.schema.json', import.meta.url), 'utf8'));
const domain = schema.$defs.UWMeta.properties.integrity.properties.input_hash;
const ajv = new Ajv.default({ strict: false });
addFormats.default(ajv);
const admits = ajv.compile(domain);
describe('RFC 0133 accepted input-hash contract', () => {
  it.each([null, '', `sha256:${'a'.repeat(64)}`, `sha256:${'0'.repeat(64)}`])('admits %j', value => expect(admits(value)).toBe(true));
  it.each([0, false, {}, [], 'sha256:abcd', `sha256:${'A'.repeat(64)}`, `sha256:${'a'.repeat(64)}\n`, '\n'])('refuses malformed syntax %j', value => expect(admits(value)).toBe(false));
  it('assigns error-severity INT-16 to validation while preserving the META-05 owner', () => {
    expect(validatorCodeFamily('INT-16')?.capabilities).toEqual(['validate']);
    expect(BUILTIN_REMEDIATIONS.find(item => item.code === 'INT-16')?.severity).toBe('error');
    expect(validatorCodeFamily('META-05')?.capabilities).toEqual(['validate']);
  });
});
