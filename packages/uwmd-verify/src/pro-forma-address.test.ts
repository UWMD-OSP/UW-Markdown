import { expect, it } from 'vitest';
import { parseUWFile } from './parser.js';
import { proFormaAddressResolver, compareProFormaTargets } from './pro-forma-address.js';
const source = '---\nuw_version: "3.0"\nasset_class: multifamily\n---\n\n```json uw:section=dcf source=manual\n{"0":5,"a/b":{"~x":0.7500},"rows":[0,1,2,3,4,5,6,7,8,9,10]}\n```\n';
const address = (pointer: string) => ({ section: 'dcf', variant: null, pointer });
it('decodes once against the actual tree and preserves typed indexes', () => {
  const r = proFormaAddressResolver(parseUWFile(source), true);
  expect(r.resolve(address('/0')).parts).toEqual(['0']);
  expect(r.resolve(address('/rows/0')).parts).toEqual(['rows', 0]);
  expect(r.resolve(address('/a~1b/~0x')).value).toBe(0.75);
  expect(() => r.resolve(address('/rows/01'))).toThrow();
  expect(() => r.resolve(address('/a~1b/~2x'))).toThrow();
  expect(() => r.resolve({ ...address(''), variant: 'default' })).toThrow();
  const a = r.resolve(address('/rows/2'));
  const b = r.resolve(address('/rows/10'));
  expect(compareProFormaTargets(a.target, b.target, a.parts, b.parts)).toBeLessThan(0);
});
it('uses source block ordinals and source precision, and model paths with explicit precision', () => {
  const model = parseUWFile(source);
  const r = proFormaAddressResolver(model, true);
  const target = r.resolve(address('/a~1b/~0x'));
  expect(target.target).toMatchObject({ block_address_kind: 'source', block_address: 0 });
  expect(r.precision(target)).toBe(4);
  expect(r.precision(target, new Map([[target.key, '0.75']]))).toBe(4);
  const current = proFormaAddressResolver(model, false);
  const mt = current.resolve(address('/a~1b/~0x'));
  expect(mt.target.block_address).toEqual(['sections', 'dcf', 'content']);
  expect(current.precision(mt)).toBeUndefined();
  expect(current.precision(mt, new Map([[mt.key, '0.7500']]))).toBe(4);
  for (const token of ['+0.75', '.75', '00.75', '0.7501', ' 0.75']) expect(current.precision(mt, new Map([[mt.key, token]]))).toBeUndefined();
});

it('keeps unlabelled, literal default and superseded physical blocks distinct', () => {
  const text = '---\nuw_version: "3.0"\nasset_class: office\n---\n' +
    '\n```json uw:section=cash_flow_series source=manual\n{"series":[{"amount":1}]}\n```\n' +
    '\n```json uw:section=cash_flow_series variant=default source=manual\n{"series":[{"amount":2}]}\n```\n';
  const r = proFormaAddressResolver(parseUWFile(text), true);
  expect(() => r.resolve({ section: 'cash_flow_series', variant: null, pointer: '/series/0/amount' })).toThrow();
  expect(r.resolve({ section: 'cash_flow_series', variant: 'default', pointer: '/series/0/amount' }).target.block_address).toBe(1);
});
it('decodes escaped map keys exactly once and refuses inherited or noncanonical array addresses', () => {
  const text = source.replace('"0":5', '"~1":7,"0":5');
  const r = proFormaAddressResolver(parseUWFile(text), true);
  expect(r.resolve(address('/~01')).value).toBe(7);
  for (const pointer of ['/toString','/rows/-','/rows/+1','/rows/1e0','/rows/1.0','/rows/9007199254740992']) expect(() => r.resolve(address(pointer))).toThrow();
});
