"""Read-only verification of actual native-browser evidence, not a browser rerun."""
import gzip,hashlib,json,zipfile
from html.parser import HTMLParser
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
class Result(HTMLParser):
    def __init__(self):super().__init__();self.inside=False;self.parts=[]
    def handle_starttag(self,tag,attrs):
        if tag=='pre' and dict(attrs).get('id')=='result':self.inside=True
    def handle_endtag(self,tag):
        if tag=='pre':self.inside=False
    def handle_data(self,data):
        if self.inside:self.parts.append(data)
def verify():
    sha=lambda b:hashlib.sha256(b).hexdigest();m=json.loads((HERE/'evidence/manifest.json').read_bytes());streams={}
    for a in m['artifacts']:
        packed=(HERE/'evidence'/a['path']).read_bytes();assert sha(packed)==a['sha256'];raw=gzip.decompress(packed)
        assert sha(raw)==a['raw_sha256'] and len(raw)==a['raw_bytes'];streams[a['path'][:-3]]=raw
    assert sha(streams['bundle.js'])==m['bundle_sha256']
    parser=Result();parser.feed(streams['native.stdout.html'].decode('utf8'));r=json.loads(''.join(parser.parts))
    assert r==json.loads(streams['result.json']) and r['status']=='complete' and r['host_transcendentals_disabled']
    archive=(ROOT/m['native_reference_archive']).read_bytes();assert sha(archive)==m['native_reference_sha256']
    with zipfile.ZipFile(ROOT/m['native_reference_archive']) as z:expected={x['id']:x for x in json.loads(z.read('results.json'))}
    inputs=(ROOT/'experiments/numerical-0088/native-reference/inputs.json').read_bytes();assert sha(inputs)==m['inputs_sha256']
    cases=[x for x in json.loads(inputs)['cases'] if x['op'] in ['pow','log','exp']]
    assert len(r['records'])==len(cases)==2163 and [x['id'] for x in r['records']]==[x['id'] for x in cases]
    for x in r['records']:
        e=expected[x['id']]
        if e['native_class']=='nan':assert x['kind']=='nan'
        else:assert x['bits']==e['native_bits'],x['id']
    assert any(p.endswith('packages/uwmd-verify/dist/browser.js') for p in m['source_hashes'])
    assert m['execution']['exit_code']==0
    print('PASS actualChrome2163 public primitive records: native procedure words/NaN classes, disabled host math and exact bundle/streams; no general browser claim.')
if __name__=='__main__':verify()
