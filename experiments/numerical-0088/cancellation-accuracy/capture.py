"""Capture new bounded cancellation observations without rewriting any prior evidence."""
import argparse
import gzip
import hashlib
import json
import os
import platform
import subprocess
import sys
import tempfile
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
LAB = HERE.parent


def sha(data):
    return hashlib.sha256(data).hexdigest()


def identities():
    inputs = json.loads((HERE / 'inputs.json').read_bytes())
    paths = list(HERE.glob('*.py')) + list(HERE.glob('*.mjs')) + [HERE / 'inputs.json']
    paths += [LAB / path for path in inputs['references']]
    paths += [path for path in (ROOT / 'packages/uwmd-verify/src').rglob('*.ts') if not path.name.endswith('.test.ts')]
    paths += [ROOT / path for path in ('spec/UW_PROTOCOL.md', 'spec/UW_RECEIPT.md')]
    for path, expected in inputs['references'].items():
        assert sha((LAB / path).read_bytes()) == expected, path
    return {path.relative_to(ROOT).as_posix(): sha(path.read_bytes()) for path in sorted(set(paths))}


def normalize(value):
    if isinstance(value, list): return [normalize(item) for item in value]
    if isinstance(value, dict): return {key: normalize(item) for key, item in value.items() if not (value.get('kind') == 'nan' and key == 'bits')}
    return value


def compare(inputs, independent, observed):
    assert len(inputs['cases']) == len(independent['candidate']) == len(observed['graphs']) == len(observed['boundaries']) == 36
    for item, python, graph, boundary in zip(inputs['cases'], independent['candidate'], observed['graphs'], observed['boundaries']):
        assert item['id'] == python['id'] == graph['id'] == boundary['id']
        assert normalize(graph) == normalize({key: python[key] for key in ('id', 'raw', 'trace')}), item['id']
        assert normalize(boundary['raw']) == normalize(python['raw']), item['id']
        if python['reporting']['status'] == 'reported':
            assert boundary['quantized']['bits'] == python['reporting']['bits'], item['id']
            assert boundary['evaluated'] == {'ok': True, 'value': boundary['quantized']}, item['id']
        else:
            assert boundary['quantization_refusal'] == 'CALC-TYPE-001', item['id']
            assert boundary['evaluated'] == {'ok': False, 'code': 'CALC-TYPE-001'}, item['id']


def capture(destination):
    if destination.exists(): raise FileExistsError('No overwrite: ' + str(destination))
    sources = identities()
    dist_paths = sorted((ROOT / 'packages/uwmd-verify/dist').rglob('*.js'))
    if not dist_paths: raise FileNotFoundError('Own fresh verifier dist required; no install or automatic build')
    dist = {path.relative_to(ROOT).as_posix(): sha(path.read_bytes()) for path in dist_paths}
    work = Path(tempfile.mkdtemp(prefix='uwmd-cancellation-accuracy-'))
    print('Preserved scratch: ' + str(work), flush=True)
    commands = []
    def run(name, command, environment=None):
        result = subprocess.run(command, cwd=ROOT, env=environment, capture_output=True)
        (work / (name + '.stdout')).write_bytes(result.stdout)
        (work / (name + '.stderr')).write_bytes(result.stderr)
        commands.append({'name': name, 'argv': [str(arg).replace(str(ROOT), '<repo>').replace(str(work), '<scratch>') for arg in command], 'exit': result.returncode})
        if result.returncode: raise RuntimeError(name + ': ' + result.stderr.decode('utf-8', errors='replace'))
    run('python', [sys.executable, '-B', str(HERE / 'python_graph.py'), str(work / 'python.json')])
    observations = {}
    for mode in ('unmodified', 'baseline', 'candidate'):
        environment = {**os.environ}
        environment.pop('RESEARCH_MODE', None)
        command = ['node']
        if mode != 'unmodified':
            events = work / (mode + '.events.jsonl'); events.write_bytes(b'')
            transforms = work / (mode + '.transforms.jsonl'); transforms.write_bytes(b'')
            environment.update(RESEARCH_REPO_ROOT=str(ROOT), RESEARCH_MODE=mode, RESEARCH_CANDIDATE=str(LAB / 'pinned-fdlibm/kernel.mjs'), RESEARCH_EVENTS=str(events), RESEARCH_TRANSFORMS=str(transforms))
            command += ['--experimental-loader', (LAB / 'impact/hook.mjs').as_uri()]
        command += [str(HERE / 'run.mjs'), str(work / (mode + '.json'))]
        run(mode, command, environment)
        observations[mode] = json.loads((work / (mode + '.json')).read_bytes())
    inputs = json.loads((HERE / 'inputs.json').read_bytes())
    independent = json.loads((work / 'python.json').read_bytes())
    compare(inputs, independent, observations['candidate'])
    assert normalize(observations['unmodified']['boundaries']) == normalize(observations['baseline']['boundaries']), 'baseline loader changed results'
    assert sources == identities(), 'source/input/kernel/reference mutation'
    assert dist == {path.relative_to(ROOT).as_posix(): sha(path.read_bytes()) for path in dist_paths}, 'production dist mutation'
    references = {row['id']: row for row in independent['references']}
    differences = []
    for actual in independent['candidate']:
        ref = references[actual['id']]
        if actual['raw'] != ref['whole_formula_rn'] or actual['reporting'] != ref['whole_formula_reporting']:
            differences.append({'id': actual['id'], 'candidate_raw': actual['raw'], 'whole_formula_rn': ref['whole_formula_rn'],
                'candidate_reporting': actual['reporting'], 'whole_formula_reporting': ref['whole_formula_reporting'],
                'ideal_power_graph': ref['ideal_power_ordered_graph']['raw'], 'relative_real_error': actual['relative_real_error']})
    record = {'status': 'UNACCEPTED bounded cancellation accuracy/refusal observations, no new graph/guarantee',
        'checkout_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'checkout_tree': subprocess.check_output(['git', 'rev-parse', 'HEAD^{tree}'], cwd=ROOT, text=True).strip(),
        'sources': sources, 'dist_before_and_after': dist, 'commands': commands,
        'python': {key: independent[key] for key in ('python', 'platform', 'architecture')},
        'node': {key: observations['candidate'][key] for key in ('node', 'v8')},
        'cases': 36, 'candidate_trace_rows': sum(len(row['trace']) for row in independent['candidate']),
        'differences_from_whole_real_formula': differences,
        'limits': ['Exact real formulas assume only listed rate words, unit scalar inputs and integer n1/n360.', 'Ideal primitive counterfactual is exact rational RN of the already-rounded base power, not an executed MPFR adapter.', 'Candidate result/reporting is compared to exact-real RN then VIII.5, not claimed correct rounding of the whole formula.', 'No prior broad studies rerun, no receipt/solver/source/schema/corpus/version mutation, no acceptance or universal bound.'], 'artifacts': []}
    destination.mkdir()
    for path in sorted(work.iterdir()):
        raw = path.read_bytes(); packed = gzip.compress(raw, mtime=0); name = path.name + '.gz'
        (destination / name).write_bytes(packed)
        record['artifacts'].append({'path': name, 'sha256': sha(packed), 'raw_bytes': len(raw), 'raw_sha256': sha(raw)})
    (destination / 'manifest.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({key: record[key] for key in ('cases', 'candidate_trace_rows')}) + '; whole-formula differences=' + str(len(differences)))


def check(destination):
    record = json.loads((destination / 'manifest.json').read_bytes())
    for path, expected in record['sources'].items(): assert sha((ROOT / path).read_bytes()) == expected, path
    for item in record['artifacts']:
        packed = (destination / item['path']).read_bytes()
        assert sha(packed) == item['sha256'], item['path']
        raw = gzip.decompress(packed)
        assert len(raw) == item['raw_bytes'] and sha(raw) == item['raw_sha256'], item['path']
    independent = json.loads(gzip.decompress((destination / 'python.json.gz').read_bytes()))
    observed = json.loads(gzip.decompress((destination / 'candidate.json.gz').read_bytes()))
    compare(json.loads((HERE / 'inputs.json').read_bytes()), independent, observed)
    print('PASS exact frozen source/raw artifacts,36candidate traces and actual boundary/reporting comparisons; no numeric replay')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--capture', type=Path); group.add_argument('--check', type=Path)
    args = parser.parse_args()
    capture(args.capture) if args.capture else check(args.check)
