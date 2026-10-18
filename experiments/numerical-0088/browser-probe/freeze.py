"""Freeze already executed browser streams; does not execute a browser."""
import argparse,gzip,hashlib,json
from pathlib import Path
from verify import Result
p=argparse.ArgumentParser();p.add_argument('scratch',type=Path);args=p.parse_args()
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];scratch=args.scratch
sha=lambda b:hashlib.sha256(b).hexdigest()
parser=Result();parser.feed((scratch/'native.stdout.html').read_text(encoding='utf8'))
result=json.loads(''.join(parser.parts));assert result['status']=='complete' and len(result['records'])==2163
(scratch/'result.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8',newline='\n')
m=json.loads((scratch/'bundle-provenance.json').read_text(encoding='utf8'))
m['native_reference_archive']='experiments/numerical-0088/native-reference/evidence/run-38993665625/native-research-ubuntu-latest-gcc-false.zip'
m['native_reference_sha256']=sha((ROOT/m['native_reference_archive']).read_bytes())
m['inputs_sha256']=sha((ROOT/'experiments/numerical-0088/native-reference/inputs.json').read_bytes())
m['artifacts']=[];evidence=HERE/'evidence';evidence.mkdir(exist_ok=True)
for name in ['bundle.js','index.html','native.stdout.html','native.stderr.log','result.json']:
    raw=(scratch/name).read_bytes();packed=gzip.compress(raw,mtime=0);(evidence/(name+'.gz')).write_bytes(packed)
    m['artifacts'].append(dict(path=name+'.gz',raw_sha256=sha(raw),raw_bytes=len(raw),sha256=sha(packed)))
m['execution']=dict(command=['chrome.exe','--headless=new','--disable-gpu','--disable-extensions','--disable-background-networking','--no-first-run','--no-default-browser-check','--user-data-dir=<new-disposable-profile>','--dump-dom','file:///<probe>/index.html'],exit_code=0,cases=2163,host_transcendentals_disabled=True,user_agent=result['user_agent'])
(evidence/'manifest.json').write_text(json.dumps(m,indent=2)+'\n',encoding='utf8',newline='\n')
print('Frozen exact final browser bundle/streams; run verify.py independently.')
