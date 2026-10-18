"""Execute current all-convention graph evidence; no prior research replay."""
import argparse,gzip,hashlib,json,os,platform,subprocess,sys,tempfile
from pathlib import Path
from python_graph import evaluate
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];LAB=HERE.parent
sha=lambda b:hashlib.sha256(b).hexdigest()
def normalized(value):
    if isinstance(value,list):return list(map(normalized,value))
    if isinstance(value,dict):return {k:normalized(v) for k,v in value.items() if not(value.get('kind')=='nan' and k=='bits')}
    return value

def main(destination):
    if destination.exists():raise FileExistsError(destination)
    paths=list(HERE.glob('*.py'))+list(HERE.glob('*.mjs'))+[HERE/'inputs.json']
    for folder in ['python-fdlibm','pinned-fdlibm','financial-trajectories','cash-graphs','power-procedures']:
        paths.extend((LAB/folder).glob('*.py'));paths.extend((LAB/folder).glob('*.mjs'))
    paths.extend([LAB/'impact/hook.mjs',LAB/'impact/runtime.mjs',LAB/'pinned-fdlibm/constants.json'])
    paths.extend(ROOT/p for p in ['packages/uwmd-verify/src/cash-flow-series.ts','packages/uwmd-verify/src/calc/day-count.ts','packages/uwmd-verify/src/calc/quantize.ts'])
    paths.extend((ROOT/'packages/uwmd-verify/dist').rglob('*.js'))
    identities=lambda:{p.relative_to(ROOT).as_posix():sha(p.read_bytes()) for p in sorted(set(paths))}
    sources=identities();inputs=json.loads((HERE/'inputs.json').read_bytes())
    python_cases=[evaluate(c) for c in inputs['cases']]
    work=Path(tempfile.mkdtemp(prefix='uwmd-dated-conventions-'));commands=[]
    (work/'python.json').write_text(json.dumps(dict(python=sys.version,platform=platform.platform(),cases=python_cases),separators=(',',':'))+'\n',encoding='utf8')
    def execute(name,command,env=None):
        run=subprocess.run(command,cwd=ROOT,env=env,capture_output=True,timeout=180)
        (work/(name+'.stdout')).write_bytes(run.stdout);(work/(name+'.stderr')).write_bytes(run.stderr)
        commands.append(dict(id=name,command=[str(x).replace(str(ROOT),'<repo>').replace(str(work),'<scratch>') for x in command],exit=run.returncode))
        if run.returncode:raise RuntimeError(run.stderr.decode('utf8',errors='replace'))
    for mode in ['host','candidate']:execute('js_'+mode,['node',str(HERE/'run_js.mjs'),mode,str(work/('js_'+mode+'.json'))])
    js={mode:json.loads((work/('js_'+mode+'.json')).read_bytes()) for mode in ['host','candidate']}
    assert normalized(js['candidate']['cases'])==normalized(python_cases),'independent full graph mismatch'
    boundaries={}
    for mode in ['unmodified','baseline','candidate']:
        env={**os.environ,'TRAJECTORY_BOUNDARY_OUTPUT':str(work/(mode+'.json'))}
        command=['node']
        if mode!='unmodified':
            for name in ['events','transforms']:(work/(mode+'.'+name+'.jsonl')).write_bytes(b'')
            env.update(RESEARCH_REPO_ROOT=str(ROOT),RESEARCH_MODE=mode,RESEARCH_CANDIDATE=str(LAB/'pinned-fdlibm/kernel.mjs'),RESEARCH_EVENTS=str(work/(mode+'.events.jsonl')),RESEARCH_TRANSFORMS=str(work/(mode+'.transforms.jsonl')))
            command+=['--experimental-loader',(LAB/'impact/hook.mjs').as_uri()]
        execute(mode,command+[str(HERE/'boundary.mjs')],env)
        boundaries[mode]=json.loads((work/(mode+'.json')).read_bytes())
        graph=js['candidate' if mode=='candidate' else 'host']['cases']
        for actual,expected in zip(boundaries[mode]['rows'],graph):
            assert actual['id']==expected['id']
            fractions=[r['result'] for r in expected['trace'] if r['kind']=='operation' and r['context'].startswith('calendar/')]
            assert fractions==actual['fractions'],actual['id']+' date fractions'
            a,b=actual['result'],expected['result'];assert a['status']==b['status'],actual['id']
            if a['status']=='refused':assert a['code']==b['code'],actual['id']
            else:
                assert normalized(a['raw'])==normalized(b['raw']),actual['id']+' raw'
                if b['reporting']['status']=='reported':assert a['quantized']['bits']==b['reporting']['bits'],actual['id']+' quantized'
                else:assert a['quantization_refusal']=='CALC-TYPE-001'
    assert boundaries['unmodified']['rows']==boundaries['baseline']['rows']
    assert identities()==sources,'research touched production/source inputs'
    changes=[dict(id=a['id'],host=a['result'],candidate=b['result']) for a,b in zip(js['host']['cases'],js['candidate']['cases']) if normalized(a['result'])!=normalized(b['result'])]
    report=dict(scope='UNACCEPTED bounded all-convention financial evidence; no acceptance or complete accuracy claim',commit=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),tree=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],text=True).strip(),sources=sources,commands=commands,python=sys.version,platform=platform.platform(),node=js['candidate']['node'],v8=js['candidate']['v8'],cases=len(python_cases),candidate_rows=sum(len(c['trace']) for c in python_cases),changes=changes,comparison='Only NaN payload bits omitted from separate comparison; raw words remain in new execution outputs',artifacts=[])
    destination.mkdir()
    for f in sorted(work.iterdir()):
        data=f.read_bytes();packed=gzip.compress(data,mtime=0);name=f.name+'.gz';(destination/name).write_bytes(packed)
        report['artifacts'].append(dict(path=name,sha256=sha(packed),raw_sha256=sha(data),raw_bytes=len(data)))
    (destination/'manifest.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print(json.dumps({k:report[k] for k in ['cases','candidate_rows','changes','commit','tree','node','v8']}))
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',required=True,type=Path);main(p.parse_args().output)
