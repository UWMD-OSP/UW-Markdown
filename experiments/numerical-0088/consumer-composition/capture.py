"""Current seven-consumer proof only; no raw-kernel or prior matrix replay."""
import argparse,gzip,hashlib,json,os,platform,subprocess,sys,tempfile
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];LAB=HERE.parent
sha=lambda b:hashlib.sha256(b).hexdigest()
def normalized(value):
    if isinstance(value,list):return list(map(normalized,value))
    if isinstance(value,dict):return {k:normalized(v) for k,v in value.items() if not(value.get('kind')=='nan' and k=='bits')}
    return value

def main(destination):
    if destination.exists():raise FileExistsError(destination)
    inputs=json.loads((HERE/'inputs.json').read_bytes())
    for name,digest in inputs['origins'].items():assert sha((ROOT/name).read_bytes())==digest,name
    paths=list(HERE.glob('*.py'))+list(HERE.glob('*.mjs'))+[HERE/'inputs.json']
    for name in ['dated-conventions/python_graph.py','financial-trajectories/python_graph.py','cash-graphs/cash_reference.py','power-procedures/reference.py','python-fdlibm/kernel.py','pinned-fdlibm/constants.json','impact/hook.mjs','impact/runtime.mjs']:paths.append(LAB/name)
    paths.extend(ROOT/name for name in inputs['origins'])
    paths.extend((ROOT/'packages/uwmd-verify/src').rglob('*.ts'));paths.extend((ROOT/'packages/uwmd-verify/dist').rglob('*.js'))
    identity=lambda:{p.relative_to(ROOT).as_posix():sha(p.read_bytes()) for p in sorted(set(paths))}
    before=identity();work=Path(tempfile.mkdtemp(prefix='uwmd-seven-consumers-'));commands=[]
    def execute(name,args,env=None):
        run=subprocess.run(args,cwd=ROOT,env=env,capture_output=True,timeout=240)
        (work/(name+'.stdout')).write_bytes(run.stdout);(work/(name+'.stderr')).write_bytes(run.stderr)
        commands.append(dict(id=name,argv=[str(x).replace(str(ROOT),'<repo>').replace(str(work),'<scratch>') for x in args],exit=run.returncode))
        if run.returncode:raise RuntimeError(name+':'+run.stderr.decode('utf8',errors='replace'))
    execute('python',[sys.executable,'-B',str(HERE/'reference.py'),str(work/'python.json')])
    observed={}
    for mode in ('unmodified','baseline','candidate'):
        env={**os.environ};env.pop('RESEARCH_MODE',None);args=['node']
        if mode!='unmodified':
            for what in ('events','transforms'):(work/(mode+'.'+what+'.jsonl')).write_bytes(b'')
            env.update(RESEARCH_REPO_ROOT=str(ROOT),RESEARCH_MODE=mode,RESEARCH_CANDIDATE=str(HERE/'candidate-entry.mjs'),RESEARCH_EVENTS=str(work/(mode+'.events.jsonl')),RESEARCH_TRANSFORMS=str(work/(mode+'.transforms.jsonl')))
            args+=['--experimental-loader',(LAB/'impact/hook.mjs').as_uri()]
        execute(mode,args+[str(HERE/'boundary.mjs'),str(work/(mode+'.json'))],env)
        observed[mode]=json.loads((work/(mode+'.json')).read_bytes())
    python=json.loads((work/'python.json').read_bytes())
    expected=normalized(python['comparison']);actual=normalized(observed['candidate']['comparison'])
    if expected!=actual:
        def differences(a,b,path=''):
            if isinstance(a,dict) and isinstance(b,dict):return sum((differences(a.get(k),b.get(k),path+'/'+k) for k in a.keys()|b.keys()),[])
            if isinstance(a,list) and isinstance(b,list):return sum((differences(x,y,path+'/'+str(i)) for i,(x,y) in enumerate(zip(a,b))),[]) if len(a)==len(b) else [(path,'length',len(a),len(b))]
            return [] if a==b else [(path,a,b)]
        raise AssertionError(json.dumps(differences(expected,actual)[:20]))
    assert normalized(observed['unmodified']['comparison'])==normalized(observed['baseline']['comparison']),'instrumentation changed current behavior'
    assert identity()==before,'source/input/compiled mutation'
    events=[json.loads(line) for line in (work/'candidate.events.jsonl').read_text().splitlines()]
    sites={}
    for event in events:
        if event.get('kind')!='primitive':continue
        site=event['site'];path=site.split(':')[0]
        if any(path.endswith(end) for end in ('capital-stack.js','waterfall.js','calc/prng.js','validator.js')):sites[site]=sites.get(site,0)+1
    counts={end:sum(end in site for site in sites) for end in ('capital-stack.js','waterfall.js','calc/prng.js','validator.js')}
    assert counts=={'capital-stack.js':1,'waterfall.js':3,'calc/prng.js':2,'validator.js':1},counts
    changes={}
    for family in ('capital','waterfall','normal','recovery'):
        changes[family]=[dict(id=a['id'],host=a,candidate=b) for a,b in zip(observed['unmodified']['comparison'][family],observed['candidate']['comparison'][family]) if normalized(a)!=normalized(b)]
    changes['stochastic']=normalized(observed['unmodified']['comparison']['stochastic'])!=normalized(observed['candidate']['comparison']['stochastic'])
    report=dict(scope='UNACCEPTED bounded independent final-result/refusal/reporting evidence for seven current consumers',commit=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),tree=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],text=True).strip(),python=sys.version,platform=platform.platform(),runtime={k:observed['candidate'][k] for k in ('node','v8')},commands=commands,source_identities_before_and_after=before,case_counts={name:len(inputs[name]) for name in ('capital','waterfall','normal','recovery')},seeded_normal_samples=inputs['stochastic']['samples'],covered_seven_sites=sites,consumer_site_counts=counts,changes=changes,artifacts=[])
    destination.mkdir()
    for path in sorted(work.iterdir()):
        data=path.read_bytes();packed=gzip.compress(data,mtime=0);name=path.name+'.gz';(destination/name).write_bytes(packed)
        report['artifacts'].append(dict(path=name,sha256=sha(packed),raw_sha256=sha(data),raw_bytes=len(data)))
    (destination/'manifest.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8',newline='\n')
    print(json.dumps({k:report[k] for k in ['commit','case_counts','seeded_normal_samples','consumer_site_counts']}))
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);main(p.parse_args().output)
