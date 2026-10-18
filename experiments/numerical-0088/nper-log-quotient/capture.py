"""Freeze14 new NPER log-quotient controls; no prior experiment replay or overwrite."""
import argparse
import gzip
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
LAB = HERE.parent


def sha(data): return hashlib.sha256(data).hexdigest()


def normalized(value):
    if isinstance(value, list): return [normalized(item) for item in value]
    if isinstance(value, dict): return {key: normalized(item) for key, item in value.items() if not (value.get('kind') == 'nan' and key == 'bits')}
    return value


def identities():
    inputs = json.loads((HERE / 'inputs.json').read_bytes())
    paths = list(HERE.glob('*.py')) + list(HERE.glob('*.mjs')) + [HERE / 'inputs.json']
    paths += [LAB / path for path in inputs['references']]
    paths += [path for path in (ROOT / 'packages/uwmd-verify/src').rglob('*.ts') if not path.name.endswith('.test.ts')]
    paths += [ROOT / path for path in ('spec/UW_PROTOCOL.md', 'spec/UW_FORMAT_SPEC.md')]
    for path, expected in inputs['references'].items(): assert sha((LAB / path).read_bytes()) == expected, path
    return {path.relative_to(ROOT).as_posix(): sha(path.read_bytes()) for path in sorted(set(paths))}


def compare(independent, actual):
    assert len(independent['candidate']) == len(actual['graphs']) == len(actual['boundaries']) == 14
    for python, js, boundary in zip(independent['candidate'], actual['graphs'], actual['boundaries']):
        assert python['id'] == js['id'] == boundary['id']
        expected = python['result']
        projection = {**python, 'result': {key: value for key, value in expected.items() if key != 'reporting'}}
        assert normalized(projection) == normalized(js), python['id']
        assert expected['status'] == boundary['result']['status'], python['id']
        if expected['status'] == 'refused':
            assert expected['code'] == boundary['result']['code'] == boundary['evaluated']['code'], python['id']
            assert boundary['evaluated']['ok'] is False
        else:
            assert normalized(expected['raw']) == normalized(boundary['result']['raw']), python['id']
            if expected['reporting']['status'] == 'reported':
                assert expected['reporting']['bits'] == boundary['result']['quantized']['bits'], python['id']
                assert boundary['evaluated'] == {'ok': True, 'value': boundary['result']['quantized']}, python['id']
            else:
                assert boundary['result']['quantization_refusal'] == boundary['evaluated']['code'] == 'CALC-TYPE-001', python['id']
                assert boundary['evaluated']['ok'] is False


def capture(destination):
    if destination.exists(): raise FileExistsError('No overwrite: ' + str(destination))
    sources = identities()
    paths = sorted((ROOT / 'packages/uwmd-verify/dist').rglob('*.js'))
    if not paths: raise FileNotFoundError('Own fresh dist required; no automatic build/install')
    dist = {path.relative_to(ROOT).as_posix(): sha(path.read_bytes()) for path in paths}
    work = Path(tempfile.mkdtemp(prefix='uwmd-nper-log-quotient-'))
    print('Preserved scratch: ' + str(work), flush=True)
    commands = []
    def run(name, command, env=None):
        result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True)
        (work / (name + '.stdout')).write_bytes(result.stdout); (work / (name + '.stderr')).write_bytes(result.stderr)
        commands.append({'name': name, 'argv': [str(arg).replace(str(ROOT), '<repo>').replace(str(work), '<scratch>') for arg in command], 'exit': result.returncode})
        if result.returncode: raise RuntimeError(name + ': ' + result.stderr.decode('utf-8', errors='replace'))
    run('python', [sys.executable, '-B', str(HERE / 'python_graph.py'), str(work / 'python.json')])
    observations = {}
    for mode in ('unmodified', 'baseline', 'candidate'):
        env = {**os.environ}; env.pop('RESEARCH_MODE', None)
        command = ['node']
        if mode != 'unmodified':
            events = work / (mode + '.events.jsonl'); events.write_bytes(b'')
            transforms = work / (mode + '.transforms.jsonl'); transforms.write_bytes(b'')
            env.update(RESEARCH_REPO_ROOT=str(ROOT), RESEARCH_MODE=mode, RESEARCH_CANDIDATE=str(LAB / 'pinned-fdlibm/kernel.mjs'), RESEARCH_EVENTS=str(events), RESEARCH_TRANSFORMS=str(transforms))
            command += ['--experimental-loader', (LAB / 'impact/hook.mjs').as_uri()]
        command += [str(HERE / 'run.mjs'), str(work / (mode + '.json'))]
        run(mode, command, env)
        observations[mode] = json.loads((work / (mode + '.json')).read_bytes())
    independent = json.loads((work / 'python.json').read_bytes())
    compare(independent, observations['candidate'])
    assert normalized(observations['unmodified']['boundaries']) == normalized(observations['baseline']['boundaries']), 'baseline changed current behavior'
    assert sources == identities(), 'source/input/kernel/reference mutation'
    assert dist == {path.relative_to(ROOT).as_posix(): sha(path.read_bytes()) for path in paths}, 'dist mutation'
    record = {'status': 'UNACCEPTED bounded complete NPER log-consumer/domain observations; no normative graph/accuracy/refusal choice',
        'checkout_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'checkout_tree': subprocess.check_output(['git', 'rev-parse', 'HEAD^{tree}'], cwd=ROOT, text=True).strip(),
        'sources': sources, 'dist_before_and_after': dist, 'commands': commands,
        'python': {key: independent[key] for key in ('python', 'platform', 'architecture')},
        'node': {key: observations['candidate'][key] for key in ('node', 'v8')}, 'cases': 14,
        'candidate_trace_rows': sum(len(case['trace']) for case in independent['candidate']),
        'mathematical_statuses': [{'id': row['id'], 'status': row['mathematical']['status']} for row in independent['references']],
        'host_candidate_changes': [{'id': host['id'], 'host': host, 'candidate': candidate} for host, candidate in zip(observations['unmodified']['boundaries'], observations['candidate']['boundaries']) if normalized(host) != normalized(candidate)],
        'limits': ['Exact-input real log quotient and ideal log of already-rounded arguments are distinct references.', 'Oracle has bounded80/128/256term log proof and63step midpoint search; no production resource guarantee.',
            'Original NaN words remain raw; class-only normalization is used only in cross-language comparisons.', 'No old kernel/178/36/4730/receipt/corpus studies repeated, no source/financial/schema/version/acceptance change.'], 'artifacts': []}
    destination.mkdir()
    for path in sorted(work.iterdir()):
        data = path.read_bytes(); packed = gzip.compress(data, mtime=0); name = path.name + '.gz'
        (destination / name).write_bytes(packed)
        record['artifacts'].append({'path': name, 'sha256': sha(packed), 'raw_sha256': sha(data), 'raw_bytes': len(data)})
    (destination / 'manifest.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({'cases': 14, 'trace_rows': record['candidate_trace_rows'], 'host_candidate_changes': len(record['host_candidate_changes'])}))


def check(destination):
    record = json.loads((destination / 'manifest.json').read_bytes())
    for path, expected in record['sources'].items(): assert sha((ROOT / path).read_bytes()) == expected, path
    for item in record['artifacts']:
        packed = (destination / item['path']).read_bytes(); assert sha(packed) == item['sha256'], item['path']
        data = gzip.decompress(packed); assert len(data) == item['raw_bytes'] and sha(data) == item['raw_sha256'], item['path']
    independent = json.loads(gzip.decompress((destination / 'python.json.gz').read_bytes()))
    observed = json.loads(gzip.decompress((destination / 'candidate.json.gz').read_bytes()))
    compare(independent, observed)
    print('PASS immutable14case NPER sources/raw artifacts/Python-JS complete traces/actual boundary/reporting; no numeric replay')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--capture', type=Path); group.add_argument('--check', type=Path)
    args = parser.parse_args()
    capture(args.capture) if args.capture else check(args.check)
