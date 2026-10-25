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
  const a = r.resolve(address('/rows/2')), b = r.resolve(address('/rows/10'));
  expect(compareProFormaTargets(a.target, b.target, a.parts, b.parts)).toBeLessThan(0);
});
it('uses source block ordinals and source precision, and model paths with explicit precision', () => {
  const model = parseUWFile(source);
  const r = proFormaAddressResolver(model, true), target = r.resolve(address('/a~1b/~0x'));
  expect(target.target).toMatchObject({ block_address_kind: 'source', block_address: 0 });
  expect(r.precision(target)).toBe(4);
  const current = proFormaAddressResolver(model, false), mt = current.resolve(address('/a~1b/~0x'));
  expect(mt.target.block_address).toEqual(['sections', 'dcf', 'content']);
  expect(current.precision(mt)).toBeUndefined();
  expect(current.precision(mt, new Map([[mt.key, '0.7500']]))).toBe(4);
  for (const token of ['+0.75', '.75', '00.75', '0.7501', ' 0.75']) expect(current.precision(mt, new Map([[mt.key, token]]))).toBeUndefined();
});
