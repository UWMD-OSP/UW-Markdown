"""Bounded real-crypto composed receipt capture; no production or old-evidence writes."""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
LAB = HERE.parent


def sha(data):
    return hashlib.sha256(data).hexdigest()


def hashes(paths):
    return {p.relative_to(ROOT).as_posix(): sha(p.read_bytes()) for p in sorted(paths)}


def protected():
    sources = [p for p in (ROOT / 'packages/uwmd-verify/src').rglob('*.ts') if not p.name.endswith('.test.ts')]
    sources += [ROOT / p for p in ('spec/UW_RECEIPT.md', 'spec/UW_PROTOCOL.md', 'spec/UW_FORMAT_SPEC.md')]
    sources += list(HERE.glob('*.mjs')) + list(HERE.glob('*.py')) + [HERE / 'inputs.json']
    sources += [LAB / p for p in ('pinned-fdlibm/kernel.mjs', 'pinned-fdlibm/words.mjs', 'pinned-fdlibm/constants.mjs', 'pinned-fdlibm/constants.json', 'impact/hook.mjs', 'impact/runtime.mjs')]
    refs = json.loads((HERE / 'inputs.json').read_bytes())['references']
    sources += [LAB / path for path in refs]
    sources += [ROOT / 'conformance/receipts/issue/01-uwx-multifamily/deal.uwx.md']
    return hashes(set(sources))


def capture(destination):
    if destination.exists():
        raise FileExistsError('No observation overwrite: ' + str(destination))
    sources = protected()
    paths = list((ROOT / 'packages/uwmd-verify/dist').rglob('*.js'))
    if not paths:
        raise FileNotFoundError('Fresh own verifier dist is required; no dependency installation is performed')
    dist = hashes(paths)
    work = Path(tempfile.mkdtemp(prefix='uwmd-composed-receipt-'))
    print('Preserved scratch: ' + str(work), flush=True)
    commands = []
    observations = {}
    for mode in ('unmodified', 'baseline', 'candidate'):
        out = work / (mode + '.json')
        environment = {**os.environ, 'RECEIPT_AUTH_OUTPUT': str(out)}
        environment.pop('RESEARCH_MODE', None)
        command = ['node']
        if mode != 'unmodified':
            events = work / (mode + '.events.jsonl')
            transforms = work / (mode + '.transforms.jsonl')
            events.write_bytes(b''); transforms.write_bytes(b'')
            environment.update(RESEARCH_REPO_ROOT=str(ROOT), RESEARCH_MODE=mode,
                RESEARCH_CANDIDATE=str(LAB / 'pinned-fdlibm/kernel.mjs'), RESEARCH_EVENTS=str(events), RESEARCH_TRANSFORMS=str(transforms))
            command += ['--experimental-loader', (LAB / 'impact/hook.mjs').as_uri()]
        command += [str(HERE / 'probe.mjs')]
        result = subprocess.run(command, cwd=ROOT, env=environment, capture_output=True)
        (work / (mode + '.stdout')).write_bytes(result.stdout)
        (work / (mode + '.stderr')).write_bytes(result.stderr)
        commands.append(dict(mode=mode, argv=[part.replace(str(ROOT), '<repo>').replace(str(work), '<scratch>') for part in command], exit=result.returncode))
        if result.returncode:
            raise RuntimeError(mode + ': ' + result.stderr.decode('utf-8', errors='replace'))
        observations[mode] = json.loads(out.read_bytes())
    first, instrumented, candidate = (observations[m] for m in ('unmodified', 'baseline', 'candidate'))
    assert first['issued_receipt'] == instrumented['issued_receipt'], 'Baseline loader changed actual issuance'
    assert first['issued_receipt'] == candidate['issued_receipt'], 'Selected finite receipt differs; report before proceeding'
    for a,b in zip(first['rows'], instrumented['rows']):
        assert a['receipt'] == b['receipt'] and a['result'] == b['result'] and len(a['backend_calls']) == len(b['backend_calls'])
    assert len(first['rows']) == len(instrumented['rows']) == 2
    assert len(candidate['rows']) == 19
    assert sources == protected(), 'Protected source/input/evidence/helper mutation'
    assert dist == hashes(paths), 'Production dist mutation'
    record = dict(status='UNACCEPTED composed actual API/signature observations; no normative procedure/accuracy/trust claim',
        checkout_commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
        checkout_tree=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=ROOT,text=True).strip(),
        python=sys.version, platform=platform.platform(), architecture=platform.machine(),
        runtime=candidate['runtime'], sources=sources, production_dist_before_and_after=dist,
        commands=commands, original_reference_files_unchanged=True, actual_candidate_controls=len(candidate['rows']),
        finite_baseline_loader_unmodified_equivalent=True, finite_candidate_receipt_equal_to_unmodified=True,
        input_sha256=sha((HERE/'inputs.json').read_bytes()), raw_artifacts=[])
    destination.mkdir()
    for path in sorted(work.iterdir()):
        raw=path.read_bytes(); packed=gzip.compress(raw,mtime=0); name=path.name+'.gz'
        (destination/name).write_bytes(packed)
        record['raw_artifacts'].append(dict(path=name,sha256=sha(packed),raw_sha256=sha(raw),raw_bytes=len(raw)))
    (destination/'manifest.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(dict(controls=19,artifacts=len(record['raw_artifacts']),head=record['checkout_commit'])))


def verify(destination):
    record=json.loads((destination/'manifest.json').read_bytes())
    for item in record['raw_artifacts']:
        packed=(destination/item['path']).read_bytes()
        assert sha(packed)==item['sha256'],item['path']
        raw=gzip.decompress(packed)
        assert len(raw)==item['raw_bytes'] and sha(raw)==item['raw_sha256'],item['path']
    for path,expected in record['sources'].items():
        assert sha((ROOT/path).read_bytes())==expected,path
    print('PASS exact current capture source closure and full raw compressed artifacts; no receipt calls replayed')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--capture',type=Path);group.add_argument('--check',type=Path)
    args=parser.parse_args()
    capture(args.capture) if args.capture else verify(args.check)
