import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { toBits } from './pinned-fdlibm/words.js';
import { Pcg64, PRNG_ALGORITHM, inverseNormalCdf, sampleNormal } from './prng.js';

interface ReferenceCase {
  seed: string;
  first_uint64: string[];
  draw_count: number;
  uint64_sha256: string;
  first_doubles: number[];
}
const oracle = JSON.parse(readFileSync(new URL('./fixtures/pcg64-reference.json', import.meta.url), 'utf8')) as {
  algorithm: string;
  oracle: string;
  oracle_version: string;
  cases: ReferenceCase[];
};

describe('PCG64 independent reference vectors', () => {
  it('records the independent implementation and nonempty coverage', () => {
    expect(oracle.algorithm).toBe(PRNG_ALGORITHM);
    expect(oracle.oracle).toBe('numpy.random.PCG64');
    expect(oracle.oracle_version).toBe('1.26.4');
    expect(oracle.cases).toHaveLength(11);
  });

  it.each(oracle.cases)('matches the independent raw and double streams for seed $seed', reference => {
    const rng = new Pcg64(BigInt(reference.seed));
    const values = Array.from({ length: reference.draw_count }, () => rng.nextUint64().toString());
    expect(values.slice(0, reference.first_uint64.length)).toEqual(reference.first_uint64);
    const digest = createHash('sha256').update(`${values.join('\n')}\n`, 'ascii').digest('hex');
    expect(digest).toBe(reference.uint64_sha256);
    const doubleRng = new Pcg64(BigInt(reference.seed));
    expect(Array.from({ length: reference.first_doubles.length }, () => doubleRng.nextDouble())).toEqual(reference.first_doubles);
  });
});


describe('RFC 0088 normal-tail activation', () => {
  it('retains independently demonstrated lower/upper-tail words through actual sampling', () => {
    expect(toBits(inverseNormalCdf(0.001))).toBe('c008b8cbb6ee2822');
    expect(toBits(inverseNormalCdf(0.999))).toBe('4008b8cbb6ee2822');
    expect(toBits(sampleNormal(0.001, 42, 3))).toBe('40405d59cdb3587a');
    expect(toBits(sampleNormal(0.999, 42, 3))).toBe('4049a2a6324ca786');
    expect(() => inverseNormalCdf(0)).toThrow(RangeError);
  });
});
