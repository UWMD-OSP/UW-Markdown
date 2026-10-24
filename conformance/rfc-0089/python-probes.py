"""Production Python replay of fixed independent inputs; expectations unchanged."""
import json,sys,platform,pyexpat,subprocess
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'implementations/python'))
from uwmd_envelope import decode_xml,decode_csv,preimage
HERE=Path(__file__).resolve().parent
folder=Path(sys.argv[1]);folder.mkdir(parents=True,exist_ok=True)
results=[]
for name in ['closure-xml-cases.json','rereview-xml-cases.json']:
    for item in json.loads((HERE/'independent'/name).read_text(encoding='utf-8')):
        try:
            actual='equal' if preimage(decode_xml(item['text']))==item.get('preimage') else 'different'
        except (ValueError,TypeError,KeyError,Exception) as error:
            actual='refused'
        assert actual==item['expected'],(name,item['name'],item['expected'],actual)
        results.append(dict(case=item['name'],group=name,expected=item['expected'],actual=actual))
for item in json.loads((HERE/'independent/rereview-csv-cases.json').read_text(encoding='utf-8')):
    try:
        value=decode_csv(item['files']);actual='accepted'
        assert preimage(value)==item['preimage']
    except (ValueError,TypeError,KeyError) as error:
        reason=str(error);actual='overlap' if 'empty/nonempty overlap' in reason else 'grammar'
        assert 'semantic digest' not in reason
    assert actual==item['expected'],(item['name'],item['expected'],actual)
    results.append(dict(case=item['name'],group='csv',expected=item['expected'],actual=actual))
# Actual Python CLI sees the original BOM position as well as the function API.
for item in json.loads((HERE/'independent/closure-xml-cases.json').read_text(encoding='utf-8')):
    if item['name'] not in ['start-37f','start-10000','start-effff','two-start-bom','bom-after-space','second-declaration']:
        continue
    path=folder/'synthetic-xml-input.uw.xml';path.write_bytes(item['text'].encode('utf-8'))
    child=subprocess.run([sys.executable,'-B',str(HERE.parents[1]/'implementations/python/uwmd_envelope.py'),'xml',str(path)],capture_output=True)
    assert (child.returncode==0)==(item['expected']=='equal'),('actual Python CLI',item['name'],child.stderr)
    results.append(dict(case=item['name'],group='python-cli',expected=item['expected'],exit=child.returncode))
(folder/'python-fixed-probes.json').write_text(json.dumps(dict(python=platform.python_version(),expat=pyexpat.EXPAT_VERSION,platform=platform.platform(),results=results),indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(controls=len(results),python=platform.python_version(),expat=pyexpat.EXPAT_VERSION,status='pass')))
