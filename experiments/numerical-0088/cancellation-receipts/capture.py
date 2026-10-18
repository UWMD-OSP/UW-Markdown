"""Bounded actual receipts for two frozen cancellation inputs; no previous evidence writes."""
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


def protected():
    inputs = json.loads((HERE / 'inputs.json').read_bytes())
    paths = list(HERE.glob('*.py')) + list(HERE.glob('*.mjs')) + [HERE / 'inputs.json']
    paths += [LAB / path for path in inputs['references']]
    paths += [ROOT / inputs['fixture']]
    paths += [path for path in (ROOT / 'packages/uwmd-verify/src').rglob('*.ts') if not path.name.endswith('.test.ts')]
    paths += [ROOT / path for path in ('spec/UW_PROTOCOL.md', 'spec/UW_FORMAT_SPEC.md', 'spec/UW_RECEIPT.md')]
    for path, expected in inputs['references'].items(): assert sha((LAB / path).read_bytes()) == expected, path
    assert sha((ROOT / inputs['fixture']).read_bytes()) == inputs['fixture_sha256']
    return {path.relative_to(ROOT).as_posix(): sha(path.read_bytes()) for path in sorted(set(paths))}


def baseline_projection(record):
    return {'cases': [{**{key: value for key, value in item.items() if key != 'issuance'},
            'issuance': {key: value for key, value in item['issuance'].items() if key != 'primitive_range'}} for item in record['cases']],
            'rows': [{key: value for key, value in row.items() if key not in ('primitive_range', 'backend_calls')}
                | {'backend_calls': [{key: value for key, value in call.items() if key != 'primitive_bytes_at_call'} for call in row['backend_calls']]} for row in record['rows']]}


def capture(destination):
    if destination.exists(): raise FileExistsError('No overwrite: ' + str(destination))
    sources = protected()
    dist_paths = sorted((ROOT / 'packages/uwmd-verify/dist').rglob('*.js'))
    if not dist_paths: raise FileNotFoundError('Fresh own verifier dist required, no automatic install/build')
    dist = {path.relative_to(ROOT).as_posix(): sha(path.read_bytes()) for path in dist_paths}
    work = Path(tempfile.mkdtemp(prefix='uwmd-cancellation-receipts-'))
    print('Preserved scratch: ' + str(work), flush=True)
    commands = []
    records = {}
    for name, stage, mode, prior in [('host', 'host', 'unmodified', None), ('baseline', 'host', 'baseline', None),
                                    ('candidate', 'candidate', 'candidate', 'host'), ('reverse', 'reverse', 'unmodified', 'candidate')]:
        environment = {**os.environ}
        environment.pop('RESEARCH_MODE', None)
        command = ['node']
        if mode != 'unmodified':
            events = work / (name + '.events.jsonl'); events.write_bytes(b'')
            transforms = work / (name + '.transforms.jsonl'); transforms.write_bytes(b'')
            environment.update(RESEARCH_REPO_ROOT=str(ROOT), RESEARCH_MODE=mode, RESEARCH_CANDIDATE=str(LAB / 'pinned-fdlibm/kernel.mjs'), RESEARCH_EVENTS=str(events), RESEARCH_TRANSFORMS=str(transforms))
            command += ['--experimental-loader', (LAB / 'impact/hook.mjs').as_uri()]
        previous = work / (prior + '.json') if prior else None
        before = previous.read_bytes() if previous else None
        command += [str(HERE / 'probe.mjs'), stage, str(previous) if previous else '-', str(work / (name + '.json'))]
        result = subprocess.run(command, cwd=ROOT, env=environment, capture_output=True)
        (work / (name + '.stdout')).write_bytes(result.stdout)
        (work / (name + '.stderr')).write_bytes(result.stderr)
        commands.append({'name': name, 'argv': [part.replace(str(ROOT), '<repo>').replace(str(work), '<scratch>') for part in command], 'exit': result.returncode})
        if result.returncode: raise RuntimeError(name + ': ' + result.stderr.decode('utf-8', errors='replace'))
        if previous: assert previous.read_bytes() == before, 'Consumed actual predecessor artifact mutation'
        records[name] = json.loads((work / (name + '.json')).read_bytes())
    assert baseline_projection(records['host']) == baseline_projection(records['baseline']), 'Baseline instrumentation changed actual receipt behavior'
    assert [len(records[name]['rows']) for name in ('host', 'candidate', 'reverse')] == [1, 6, 5]
    for row in records['candidate']['cases']:
        assert row['issuance']['reported_word'] == row['frozen_reference']['candidate_reporting']['bits']
        assert row['issuance']['reported_word'] != row['frozen_reference']['mathematical_reporting']['bits']
    assert sources == protected(), 'Source/input/kernel/reference mutation'
    assert dist == {path.relative_to(ROOT).as_posix(): sha(path.read_bytes()) for path in dist_paths}, 'Compiled production mutation'
    pmt = records['host']['cases'][0]['issuance']
    pv = records['host']['cases'][1]['issuance']
    record = {'status': 'UNACCEPTED actual natural cancellation receipt/signature observations, no original authentication/activation',
        'checkout_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'checkout_tree': subprocess.check_output(['git', 'rev-parse', 'HEAD^{tree}'], cwd=ROOT, text=True).strip(),
        'python': sys.version, 'platform': platform.platform(), 'architecture': platform.machine(),
        'runtime': records['candidate']['runtime'], 'sources': sources, 'dist_before_and_after': dist, 'commands': commands,
        'host_observation': {'pmt_issuance': pmt['status'], 'pv_reported_word': pv['reported_word'],
            'host_pv_candidate_agree': pv['reported_word'] == records['candidate']['cases'][1]['issuance']['reported_word']},
        'primary_controls': 12, 'baseline_instrumentation_control_repeated': 1,
        'primary_backend_calls': sum(len(row['backend_calls']) for name in ('host', 'candidate', 'reverse') for row in records[name]['rows']),
        'limits': ['Only two exact frozen scalar inputs; mathematical results reused without regenerating the36-case reference.',
            'Host branches are actual current runtime outcomes; oldWindows0/refusal not forced on agreeing hosts.',
            'Every signed/version-edited artifact is newly synthetic; public test key establishes no producer trust.',
            'Same existing engine name plus explicit synthetic version metadata; no new production identity/selector/regime.',
            'No prior kernel/36case/4730 financial studies rerun, no numeric/spec/schema/corpus/version/receipt mutation.'], 'artifacts': []}
    destination.mkdir()
    for path in sorted(work.iterdir()):
        raw = path.read_bytes(); packed = gzip.compress(raw, mtime=0); name = path.name + '.gz'
        (destination / name).write_bytes(packed)
        record['artifacts'].append({'path': name, 'sha256': sha(packed), 'raw_sha256': sha(raw), 'raw_bytes': len(raw)})
    (destination / 'manifest.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({key: record[key] for key in ('primary_controls', 'primary_backend_calls', 'host_observation')}))


def check(destination):
    record = json.loads((destination / 'manifest.json').read_bytes())
    for path, expected in record['sources'].items(): assert sha((ROOT / path).read_bytes()) == expected, path
    for item in record['artifacts']:
        packed = (destination / item['path']).read_bytes()
        assert sha(packed) == item['sha256'], item['path']
        raw = gzip.decompress(packed)
        assert len(raw) == item['raw_bytes'] and sha(raw) == item['raw_sha256'], item['path']
    print('PASS immutable two-input receipt artifacts and exact current source closure; no API/math replay')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--capture', type=Path); group.add_argument('--check', type=Path)
    args = parser.parse_args()
    capture(args.capture) if args.capture else check(args.check)
