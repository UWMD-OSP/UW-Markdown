# Production Python import/path adaptation; consumes original fixed inputs without rewriting them.
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[4]/'implementations/python'))
folder = Path(__file__).resolve().parents[4] / 'node_modules/.cache/rfc0089-production-evidence'
import uwmd_envelope as candidate
out=[]
for item in json.loads((Path(__file__).resolve().parents[2] / 'independent/rereview-xml-cases.json').read_text(encoding='utf-8')):
    error=None
    try:
        value=candidate.decode_xml(item['text'])
        actual='equal' if candidate.preimage(value)==item.get('preimage') else 'different'
    except Exception as exc:
        actual='refused'
        error=str(exc)
    out.append(dict(name='xml-'+item['name'],expected=item['expected'],actual=actual,error=error,passed=actual==item['expected']))
for item in json.loads((Path(__file__).resolve().parents[2] / 'independent/rereview-csv-cases.json').read_text(encoding='utf-8')):
    error=None
    try:
        value=candidate.decode_csv(item['files'])
        actual='accepted'
    except Exception as exc:
        error=str(exc)
        actual='overlap' if 'empty/nonempty overlap' in error else 'grammar' if any(t in error for t in ('pointer','empty location','empty descriptor order')) else 'other-refusal'
    out.append(dict(name='csv-'+item['name'],expected=item['expected'],actual=actual,error=error,passed=actual==item['expected']))
(folder / 'rereview-python-results.json').write_text(json.dumps(dict(platform=sys.platform,python=sys.version,probes=out),ensure_ascii=True,indent=2),encoding='utf-8')
print(json.dumps(dict(count=len(out),passing=sum(i['passed'] for i in out),failures=[i for i in out if not i['passed']]),ensure_ascii=True,indent=2))
