"""Capture isolated full trajectories, or verify existing evidence read-only."""
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
from python_graph import evaluate, reporting, raw
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
LAB = HERE.parent


def sha(data):
    return hashlib.sha256(data).hexdigest()


def normalized(value):
    if isinstance(value, dict):
        # Original bits stay in raw artifacts; only this comparison is class-only.
        return {key: normalized(item) for key, item in value.items() if not (value.get('kind') == 'nan' and key == 'bits')}
    if isinstance(value, list): return [normalized(item) for item in value]
    return value


def source_identities():
    paths = list(HERE.glob('*.py')) + list(HERE.glob('*.mjs')) + [HERE / 'inputs.json']
    paths += [LAB / p for p in ('python-fdlibm/kernel.py', 'python-fdlibm/evidence-inputs.json', 'pinned-fdlibm/kernel.mjs', 'pinned-fdlibm/words.mjs', 'pinned-fdlibm/constants.mjs', 'pinned-fdlibm/constants.json', 'cash-graphs/cash_reference.py', 'power-procedures/reference.py', 'impact/hook.mjs', 'impact/runtime.mjs', 'astra-review/observations.json', 'astra-review/integration-identities.json', 'impact/financial-evidence/manifest.json', 'impact/financial-evidence/baseline.financial.json', 'impact/financial-evidence/candidate.financial.json')]
    paths += [ROOT / p for p in ('packages/uwmd-verify/src/calc/builtins.ts', 'packages/uwmd-verify/src/calc/quantize.ts', 'packages/uwmd-verify/src/cash-flow-series.ts', 'packages/uwmd-verify/src/calc/day-count.ts', 'packages/uwmd-verify/src/receipts.ts', 'spec/UW_PROTOCOL.md', 'spec/UW_RECEIPT.md')]
    return {p.relative_to(ROOT).as_posix(): sha(p.read_bytes()) for p in sorted(paths)}


def compare_boundary(cases, boundary):
    assert len(cases) == len(boundary['rows'])
    for graph, actual in zip(cases, boundary['rows']):
        assert (graph['id'], graph['op']) == (actual['id'], actual['op'])
        expected, observed = graph['result'], actual['result']
        assert expected['status'] == observed['status'], graph['id']
        if expected['status'] == 'refused': assert expected['code'] == observed['code'], graph['id']
        else:
            assert normalized(expected['raw']) == normalized(observed['raw']), (graph['id'], expected, observed)
            if expected['reporting']['status'] == 'reported': assert expected['reporting']['bits'] == observed['quantized']['bits'], graph['id']
            else: assert observed['quantization_refusal'] == 'CALC-TYPE-001', graph['id']


def capture(destination):
    if destination.exists(): raise FileExistsError('No observation overwrite: ' + str(destination))
    raw.require_binary64()
    sources = source_identities()
    dist_paths = sorted((ROOT / 'packages/uwmd-verify/dist').rglob('*.js'))
    dist = {p.relative_to(ROOT).as_posix(): sha(p.read_bytes()) for p in dist_paths}
    inputs = json.loads((HERE / 'inputs.json').read_bytes())
    python_cases = [evaluate(case) for case in inputs['cases']]
    python_reporting = [{'id': item['id'], **reporting(item['bits'], item['places'])} for item in inputs['reporting_controls']]
    python_result = {'python': sys.version, 'platform': platform.platform(), 'machine': platform.machine(), 'cases': python_cases, 'reporting': python_reporting}
    temporary = tempfile.mkdtemp(prefix='uwmd-trajectory-capture-')
    print('Preserved trajectory scratch: ' + temporary)
    work = Path(temporary)
    (work / 'python.json').write_text(json.dumps(python_result, separators=(',', ':')) + '\n', encoding='utf-8')
    commands = []
    def execute(name, command, environment=None):
        run = subprocess.run(command, cwd=ROOT, env=environment, capture_output=True)
        (work / (name + '.stdout')).write_bytes(run.stdout)
        (work / (name + '.stderr')).write_bytes(run.stderr)
        commands.append({'name': name, 'command': [str(v).replace(str(work), '<scratch>').replace(str(ROOT), '<repo>') for v in command], 'exit': run.returncode})
        if run.returncode: raise RuntimeError(name + ': ' + run.stderr.decode('utf-8', errors='replace'))
    for mode in ('host', 'candidate'):
        execute('js_' + mode, ['node', str(HERE / 'run_js.mjs'), mode, str(work / ('js_' + mode + '.json'))])
    boundaries = {}
    for mode in ('unmodified', 'baseline', 'candidate'):
        path = work / ('boundary_' + mode + '.json')
        environment = {**os.environ, 'TRAJECTORY_BOUNDARY_OUTPUT': str(path)}
        command = ['node']
        if mode != 'unmodified':
            event = work / (mode + '.events.jsonl'); event.write_bytes(b'')
            transform = work / (mode + '.transforms.jsonl'); transform.write_bytes(b'')
            environment.update(RESEARCH_REPO_ROOT=str(ROOT), RESEARCH_MODE=mode, RESEARCH_CANDIDATE=str(LAB / 'pinned-fdlibm/kernel.mjs'), RESEARCH_EVENTS=str(event), RESEARCH_TRANSFORMS=str(transform))
            command += ['--experimental-loader', (LAB / 'impact/hook.mjs').as_uri()]
        command += [str(HERE / 'boundary.mjs')]
        execute('boundary_' + mode, command, environment)
        boundaries[mode] = json.loads(path.read_bytes())
    host = json.loads((work / 'js_host.json').read_bytes())
    candidate = json.loads((work / 'js_candidate.json').read_bytes())
    assert normalized(python_cases) == normalized(candidate['cases']), 'Python/JS full candidate trajectories differ'
    assert python_reporting == candidate['reporting'] == host['reporting'], 'independent quantization controls differ'
    compare_boundary(host['cases'], boundaries['unmodified'])
    compare_boundary(host['cases'], boundaries['baseline'])
    compare_boundary(candidate['cases'], boundaries['candidate'])
    assert boundaries['unmodified']['rows'] == boundaries['baseline']['rows'], 'baseline instrumentation changed actual output'
    for boundary in boundaries.values():
        assert [{'id': x['id'], 'bits': x['value']['bits']} for x in boundary['reporting']] == [{'id': x['id'], 'bits': x['bits']} for x in python_reporting]
    assert sources == source_identities(), 'protected source/evidence/helper mutation'
    assert dist == {p.relative_to(ROOT).as_posix(): sha(p.read_bytes()) for p in dist_paths}, 'production dist mutation'
    changes = [{'id': a['id'], 'host_result': a['result'], 'candidate_result': b['result'], 'host_rows': len(a['trace']), 'candidate_rows': len(b['trace'])} for a, b in zip(host['cases'], candidate['cases']) if normalized(a['result']) != normalized(b['result'])]
    summary = {'status': 'UNACCEPTED complete bounded financial trajectory observations, not conformance', 'checkout_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(), 'checkout_tree': subprocess.check_output(['git', 'rev-parse', 'HEAD^{tree}'], cwd=ROOT, text=True).strip(), 'sources': sources, 'dist_before_and_after': dist, 'commands': commands, 'python_runtime': {k: python_result[k] for k in ('python', 'platform', 'machine')}, 'node_runtime': {k: candidate[k] for k in ('node', 'v8')}, 'cases': len(python_cases), 'candidate_rows': sum(len(c['trace']) for c in python_cases), 'normalized_candidate_sha256': sha(json.dumps(normalized(python_cases), sort_keys=True, separators=(',', ':')).encode()), 'changes': changes, 'artifacts': [], 'receipt_scope': 'Existing exact actual receipt API RCP-03/RCP-07/backend evidence is source-pinned and reused; no new receipt verification regime or new issuance executed.'}
    # Portable comparison projection is stored separately; raw rows remain intact.
    (work / 'candidate-normalized.json').write_text(json.dumps(normalized(python_cases), separators=(',', ':')) + '\n', encoding='utf-8')
    destination.mkdir()
    for source in sorted(work.iterdir()):
        data = source.read_bytes(); packed = gzip.compress(data, mtime=0)
        name = source.name + '.gz'
        (destination / name).write_bytes(packed)
        summary['artifacts'].append({'path': name, 'sha256': sha(packed), 'raw_sha256': sha(data), 'raw_bytes': len(data)})
    (destination / 'manifest.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: summary[k] for k in ('cases', 'candidate_rows', 'normalized_candidate_sha256', 'changes')}))


def verify(destination):
    record = json.loads((destination / 'manifest.json').read_bytes())
    for path, expected in record['sources'].items(): assert sha((ROOT / path).read_bytes()) == expected, path
    for item in record['artifacts']:
        data = (destination / item['path']).read_bytes()
        assert sha(data) == item['sha256']
        unpacked = gzip.decompress(data)
        assert len(unpacked) == item['raw_bytes'] and sha(unpacked) == item['raw_sha256']
    print('PASS full raw trajectory artifacts, normalized projection and exact source closure; no experiments rerun')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capture', type=Path)
    parser.add_argument('--check', type=Path)
    args = parser.parse_args()
    if bool(args.capture) == bool(args.check): parser.error('choose exactly one of --capture NEWDIR or --check DIR')
    capture(args.capture) if args.capture else verify(args.check)
