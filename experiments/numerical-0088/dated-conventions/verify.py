"""Check new candidate research evidence without executing or repairing it."""
import gzip,hashlib,json
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
def verify():
    sha=lambda x:hashlib.sha256(x).hexdigest()
    m=json.loads((HERE/'evidence/manifest.json').read_bytes())
    for name,digest in m['sources'].items():
        assert sha((ROOT/name).read_bytes())==digest,name
    for a in m['artifacts']:
        packed=(HERE/'evidence'/a['path']).read_bytes();assert sha(packed)==a['sha256']
        data=gzip.decompress(packed);assert sha(data)==a['raw_sha256'] and len(data)==a['raw_bytes']
    assert m['cases']==48 and m['candidate_rows']==21969
    assert len(m['commands'])==5 and all(c['exit']==0 for c in m['commands'])
    print('PASS current48-input/21969-row candidate evidence and executed source closure; no old matrix rerun')
if __name__=='__main__':verify()
