"""Build independent pinned C and compare every frozen raw word with JS candidate.

No source edits, dependency installation, financial solver or conformance claim.
C is a compiler-scoped corroboration, not a correct-rounding mathematical oracle.
"""
import argparse, hashlib, json, os, platform, shutil, subprocess, sys, tempfile
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
CANDIDATE=HERE.parent/'pinned-fdlibm'
PATCHES={
 'e_pow.c': [('(j<<(52-k))','uw_shl32(j,52-k)'),('(j<<(20-k))','uw_shl32(j,20-k)'),('(hx>>31)','uw_sar32(hx,31)'),('(n<<20)','uw_shl32(n,20)'),('(j>>20)','uw_sar32(j,20)')],
 'e_sqrt.c':[('(ix1>>(32-i))','(i==0?0:(ix1>>(32-i)))'),('m >>= 1;','m = uw_sar32(m,1);'),('(m <<20)','uw_shl32(m,20)')],
 'e_exp.c':[('(k<<20)','uw_shl32(k,20)'),('((k+1000)<<20)','uw_shl32(k+1000,20)')],
}

def sha(data): return hashlib.sha256(data).hexdigest()
def nan(word): return int(word,16)&0x7ff0000000000000==0x7ff0000000000000 and int(word,16)&0x000fffffffffffff!=0

def recorded_path(argument, build):
    return str(argument).replace(str(build),'<build>').replace(str(ROOT),'<repo>')

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--cc',default='cc');p.add_argument('--output',type=Path,required=True);p.add_argument('--sanitize',action='store_true');a=p.parse_args()
    a.output.mkdir(parents=True,exist_ok=True)
    manifest=json.loads((CANDIDATE/'sources.json').read_text())
    entries=manifest.get('files',manifest.get('sources'))
    if entries is None: raise ValueError('Unknown source manifest shape')
    verified={}
    for row in entries:
        path=CANDIDATE/'upstream'/row['file'];data=path.read_bytes()
        if sha(data)!=row['sha256']: raise ValueError('Source identity mismatch: '+str(path))
        verified[row['file']]=sha(data)
    cases=json.loads((HERE/'inputs.json').read_text())['cases']
    report={'scope':'compiler-scoped independent C versus full raw JS candidate; no CR or financial conformance claim',
      'platform':platform.platform(),'machine':platform.machine(),'python':sys.version,'compiler':subprocess.check_output([a.cc,'--version'],text=True).strip(),
      'source_hashes':verified,'input_sha256':sha((HERE/'inputs.json').read_bytes()),'patches':PATCHES,'sanitize':a.sanitize}
    report['checkout_commit']=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    report['checkout_tree']=subprocess.check_output(['git','rev-parse','HEAD^{tree}'],cwd=ROOT,text=True).strip()
    report['node']=json.loads(subprocess.check_output(['node','-p',
      'JSON.stringify({node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch})'],cwd=ROOT,text=True))
    report['github']={key:os.environ.get(key) for key in ('GITHUB_SHA','GITHUB_HEAD_REF','GITHUB_BASE_REF','RESEARCH_HEAD_SHA')}
    report['runner_image']={key:os.environ.get(key) for key in ('ImageOS','ImageVersion','RUNNER_OS','RUNNER_ARCH')}
    report['driver_sources']={name:sha((HERE/name).read_bytes()) for name in ('compare.py','reference.c','word-adapter.h')}
    report['candidate_sources']={name:sha((CANDIDATE/name).read_bytes()) for name in ('kernel.mjs','words.mjs','constants.mjs','run.mjs')}
    report['path_notation']={'<repo>':'checkout root; absolute path omitted','<build>':'temporary compilation directory; absolute path omitted'}
    with tempfile.TemporaryDirectory(prefix='uwmd-fdlibm-reference-') as folder:
        work=Path(folder)
        report['adapted_sources']={}
        for row in entries:
            text=(CANDIDATE/'upstream'/row['file']).read_text(encoding='ascii')
            for old,new in PATCHES.get(row['file'],[]):
                if text.count(old)<1: raise ValueError('Missing exact native adapter site: '+old)
                text=text.replace(old,new)
            (work/row['file']).write_text(text,encoding='ascii',newline='\n')
            report['adapted_sources'][row['file']]=sha((work/row['file']).read_bytes())
        flags=['-std=c11','-O2','-fno-fast-math','-ffp-contract=off','-fno-builtin','-fwrapv','-fno-strict-aliasing','-D__LITTLE_ENDIAN',
          '-Dsqrt=__ieee754_sqrt','-Dscalbn=uw_scalbn','-Dcopysign=uw_copysign','-Dfabs=uw_fabs','-include',str(HERE/'word-adapter.h')]
        if a.sanitize: flags+=['-fsanitize=undefined','-fno-sanitize-recover=undefined']
        executable=work/'reference'
        command=[a.cc,*flags,*[str(work/r['file']) for r in entries if r['file'].endswith('.c')],str(HERE/'reference.c'),'-lm','-o',str(executable)]
        compile_run=subprocess.run(command,capture_output=True,text=True,timeout=120)
        (a.output/'compiler.stdout.log').write_text(compile_run.stdout,encoding='utf-8');(a.output/'compiler.stderr.log').write_text(compile_run.stderr,encoding='utf-8')
        report['flags']=[recorded_path(flag,work) for flag in flags];report['compile_exit']=compile_run.returncode
        report['compile_command']=[recorded_path(argument,work) for argument in command]
        if compile_run.returncode: raise RuntimeError('Native compile failed; inspect compiler.stderr.log')
        report['compiled_binary_sha256']=sha(executable.read_bytes())
        report['native_command']=['<build>/reference']
        report['javascript_command']=['node',recorded_path(CANDIDATE/'run.mjs',work)]
        native_input=''.join(f"{c['op']} {c['x']} {c['y']} {c['n']}\n" for c in cases)
        native=subprocess.run([str(executable)],input=native_input,text=True,capture_output=True,timeout=120)
        js=subprocess.run(['node',str(CANDIDATE/'run.mjs')],input=''.join(json.dumps(c)+'\n' for c in cases),text=True,capture_output=True,timeout=120)
        (a.output/'native.stderr.log').write_text(native.stderr,encoding='utf-8');(a.output/'js.stderr.log').write_text(js.stderr,encoding='utf-8')
        report['native_exit']=native.returncode;report['js_exit']=js.returncode
        if native.returncode or js.returncode: raise RuntimeError(f'Execution failure native={native.returncode},js={js.returncode}')
        native_words=native.stdout.splitlines();js_rows=[json.loads(x) for x in js.stdout.splitlines()]
        if len(native_words)!=len(cases) or len(js_rows)!=len(cases): raise ValueError('Incomplete native/JS case coverage')
        differences=[];results=[]
        for c,cword,jrow in zip(cases,native_words,js_rows):
            if jrow['id']!=c['id'] or jrow['op']!=c['op']: raise ValueError('JS identity/order mismatch')
            equal=(nan(cword) and jrow['kind']=='nan') or (not nan(cword) and cword==jrow['bits'])
            row={'id':c['id'],'op':c['op'],'native_bits':None if nan(cword) else cword,'native_class':'nan' if nan(cword) else 'binary64',
              'js_bits':None if jrow['kind']=='nan' else jrow['bits'],'equal':equal}
            results.append(row)
            if not equal: differences.append(row)
        report['cases']=len(cases);report['differences']=differences;report['results_sha256']=sha((json.dumps(results,sort_keys=True)+'\n').encode())
        (a.output/'results.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
        (a.output/'provenance.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
        print(json.dumps({'cases':len(cases),'differences':len(differences),'compiler':report['compiler'].splitlines()[0],'sanitize':a.sanitize}))
        return 1 if differences else 0

if __name__=='__main__': raise SystemExit(main())
