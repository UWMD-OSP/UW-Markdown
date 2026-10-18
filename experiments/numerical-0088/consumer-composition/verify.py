"""Read-only validation of the current bounded consumer capture; no old replay."""
import gzip,hashlib,json
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
def verify():
    sha=lambda b:hashlib.sha256(b).hexdigest();m=json.loads((HERE/'evidence/manifest.json').read_bytes())
    for path,digest in m['source_identities_before_and_after'].items():assert sha((ROOT/path).read_bytes())==digest,path
    for a in m['artifacts']:
        packed=(HERE/'evidence'/a['path']).read_bytes();assert sha(packed)==a['sha256'];raw=gzip.decompress(packed);assert sha(raw)==a['raw_sha256'] and len(raw)==a['raw_bytes']
    assert len(m['commands'])==4 and all(c['exit']==0 for c in m['commands'])
    assert m['case_counts']==dict(capital=9,waterfall=11,normal=15,recovery=8) and m['seeded_normal_samples']==64
    assert m['consumer_site_counts']=={'capital-stack.js':1,'waterfall.js':3,'calc/prng.js':2,'validator.js':1}
    print('PASS current44-case/64-sample seven-consumer artifacts andsourceclosure; no matrix reexecution')
if __name__=='__main__':verify()
