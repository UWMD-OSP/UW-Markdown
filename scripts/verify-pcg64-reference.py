#!/usr/bin/env python3
"""Reproduce the independent PCG64 oracle. Optional maintainer check, not npm dependency.

Requires NumPy 1.26.4. Default mode checks committed evidence; --write regenerates
it for review. Normal Vitest tests consume the JSON without Python or NumPy.
"""
import argparse
import hashlib
import json
from pathlib import Path

try:
    import numpy as np
except ModuleNotFoundError:
    raise SystemExit('This optional maintainer check requires NumPy 1.26.4; normal npm tests do not.') from None

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / 'packages/uwmd-core/src/calc/fixtures/pcg64-reference.json'
MODULUS = 1 << 128
# pcg-c's two uint64 halves, not constants imported from the TypeScript under test.
INCREMENT = (6364136223846793005 << 64) | 1442695040888963407
SEEDS = [0, 1, 42, 43, (1 << 53) - 1, (1 << 64) - 1,
         1 << 127, MODULUS - 1, MODULUS, MODULUS + 42, -1]
COUNT = 1024


def generator(seed):
    bitgen = np.random.PCG64(0)
    bitgen.state = {'bit_generator': 'PCG64',
                    'state': {'state': 0, 'inc': INCREMENT},
                    'has_uint32': 0, 'uinteger': 0}
    # pcg_oneseq_128_srandom_r: zero, step, add seed (uint128), step.
    # NumPy's compiled implementation performs both steps; we do not copy the
    # TypeScript multiplier, rotation, or nextUint64 implementation here.
    bitgen.random_raw()
    state = bitgen.state
    state['state']['state'] = (state['state']['state'] + seed) % MODULUS
    bitgen.state = state
    bitgen.random_raw()
    return bitgen


def evidence():
    if np.__version__ != '1.26.4':
        raise SystemExit(f'Use NumPy 1.26.4 for this pinned oracle; found {np.__version__}.')
    cases = []
    for seed in SEEDS:
        bitgen = generator(seed)
        values = [str(int(value)) for value in bitgen.random_raw(COUNT)]
        cases.append({'seed': str(seed), 'first_uint64': values[:16],
                      'draw_count': COUNT,
                      'uint64_sha256': hashlib.sha256(('\n'.join(values) + '\n').encode('ascii')).hexdigest(),
                      'first_doubles': np.random.Generator(generator(seed)).random(16).tolist()})
    return {'algorithm': 'pcg-xsl-rr-128-64', 'oracle': 'numpy.random.PCG64',
            'oracle_version': np.__version__,
            'upstream_revision': '83252d9c23df9c82ecb42210afed61a7b42402d7',
            'upstream_header': 'https://github.com/imneme/pcg-c/blob/83252d9c23df9c82ecb42210afed61a7b42402d7/include/pcg_variants.h',
            'increment': str(INCREMENT),
            'seeding': 'state=0; step; state+=uint128(seed); step',
            'digest_encoding': 'ASCII decimal uint64 per line, LF, including final LF',
            'cases': cases}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true', help='regenerate the oracle JSON for review')
    args = parser.parse_args()
    actual = evidence()
    if args.write:
        FIXTURE.parent.mkdir(parents=True, exist_ok=True)
        FIXTURE.write_text(json.dumps(actual, indent=2) + '\n', encoding='utf-8')
        print(f'Wrote {FIXTURE.relative_to(ROOT)}')
    else:
        expected = json.loads(FIXTURE.read_text(encoding='utf-8'))
        if actual != expected:
            raise SystemExit('FAIL: independent PCG64 evidence differs; do not update it without review.')
        print(f'PASS: {len(SEEDS)} seeds, {len(SEEDS) * COUNT:,} raw draws and {len(SEEDS) * 16} doubles match the pinned independent oracle.')


if __name__ == '__main__':
    main()
