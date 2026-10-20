import { describe, expect, it } from 'vitest';
import { hasBlockShape } from './block-kind.js';

describe('internal block discriminator', () => {
  const block = () => ({ annotation: { section: 'operating_statement', variant: 'annotation', v: 1 }, content: { value: 1 } });
  it('recognizes parsed and Envelope blocks without relying on convenience keys', () => {
    expect(hasBlockShape(block())).toBe(true);
    expect(hasBlockShape({ ...block(), meta: {}, rawJson: '', arbitrary: { preserved: true } })).toBe(true);
    // Payload admission belongs to its existing error owner, not this discriminator.
    expect(hasBlockShape({ ...block(), content: [] })).toBe(true);
    expect(hasBlockShape({ ...block(), content: null })).toBe(true);
  });
  it.each(['annotation', 'content', 'meta', 'rawJson', 'prose', 'lineStart'])('does not reserve variant label %s', key => {
    expect(hasBlockShape({ [key]: block() })).toBe(false);
    expect(hasBlockShape({ [key]: block(), ordinary: block() })).toBe(false);
  });
  it('distinguishes annotation/content maps even with lawful extra block members', () => {
    expect(hasBlockShape({ annotation: { ...block(), section: 'spoof' }, content: block() })).toBe(false);
    expect(hasBlockShape({ annotation: block(), content: { ...block(), section: 'spoof' } })).toBe(false);
  });
  it('requires own wrapper identity without following prototypes', () => {
    expect(hasBlockShape(Object.create(block()))).toBe(false);
    expect(hasBlockShape({ annotation: Object.create({ section: 'property' }), content: {} })).toBe(false);
    for (const value of [null, undefined, [], false, 'annotation', { annotation: null, content: {} }]) expect(hasBlockShape(value)).toBe(false);
  });
});
