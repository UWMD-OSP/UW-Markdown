"""Capture only the current authenticate-first state matrix; no old study replay."""
import argparse,gzip,hashlib,json,os,platform,subprocess,sys,tempfile
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
sha=lambda data:hashlib.sha256(data).hexdigest()
def main(destination):
    if destination.exists():raise FileExistsError(destination)
    paths=list(HERE.glob('*.mjs'))+list(HERE.glob('*.py'))
    paths+=list((ROOT/'packages/uwmd-verify/src').rglob('*.ts'))
    paths+=list((ROOT/'packages/uwmd-verify/dist').rglob('*.js'))
    paths+=[ROOT/'conformance/receipts/issue/01-uwx-multifamily/deal.uwx.md']
    identity=lambda:{p.relative_to(ROOT).as_posix():sha(p.read_bytes()) for p in sorted(paths)}
    before=identity();scratch=Path(tempfile.mkdtemp(prefix='uwmd-authenticate-first-'))
    env={**os.environ,'AUTH_FIRST_OBSERVATIONS':str(scratch/'observations.json'),'AUTH_FIRST_TRANSFORMS':str(scratch/'transforms.jsonl')}
    command=['node','--experimental-loader',str(HERE/'loader.mjs'),'--test-reporter=tap','--test',str(HERE/'proposal.test.mjs')]
    result=subprocess.run(command,cwd=ROOT,env=env,capture_output=True,timeout=180)
    (scratch/'stdout').write_bytes(result.stdout);(scratch/'stderr').write_bytes(result.stderr)
    if result.returncode:raise RuntimeError(result.stdout.decode('utf8',errors='replace')+result.stderr.decode('utf8',errors='replace'))
    observed=json.loads((scratch/'observations.json').read_bytes());assert len(observed['rows'])==26
    assert before==identity(),'source/runtime code changed during observation'
    transforms=[json.loads(line) for line in (scratch/'transforms.jsonl').read_text().splitlines()]
    assert transforms and all(t['signature_stage_moved_before_compute'] and t['authentication_recomputed_members_removed']==2 and not t['production_written'] for t in transforms)
    report=dict(scope='UNACCEPTED owner-directed procedure evidence; production verification unchanged',commit=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),tree=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],text=True).strip(),python=sys.version,platform=platform.platform(),runtime={k:observed[k] for k in ['node','v8','openssl']},command=[x.replace(str(ROOT),'<repo>') for x in command],exit=result.returncode,source_identities_before_and_after=before,methods=6,state_rows=len(observed['rows']),proposal_rows=sum(r['mode']=='proposal' for r in observed['rows']),backend_invocations=sum(r['backend_calls'] for r in observed['rows']),crypto_valid=sum(c.get('cryptographic_valid') is True for r in observed['rows'] for c in r['backend_checks']),crypto_invalid=sum(c.get('cryptographic_valid') is False for r in observed['rows'] for c in r['backend_checks']),artifacts=[])
    destination.mkdir()
    for path in sorted(scratch.iterdir()):
        data=path.read_bytes();packed=gzip.compress(data,mtime=0);name=path.name+'.gz';(destination/name).write_bytes(packed)
        report['artifacts'].append(dict(path=name,sha256=sha(packed),raw_sha256=sha(data),raw_bytes=len(data)))
    (destination/'manifest.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8',newline='\n')
    print(json.dumps({k:report[k] for k in ['commit','methods','state_rows','proposal_rows','backend_invocations','crypto_valid','crypto_invalid']}))
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',required=True,type=Path);main(p.parse_args().output)
