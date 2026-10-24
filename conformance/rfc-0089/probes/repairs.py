# Native production import-only adaptation; original controls retained privately.
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[3]/'implementations/python'))
"""Expanded boundary controls specified by the independent review and repair brief."""
import json
from pathlib import Path
import platform
import sys
from uwmd_envelope import project_source, preimage, validate, decode_csv, decode_xml

folder = Path(sys.argv[1])
cases = json.loads((folder / 'repair-cases.json').read_text(encoding='utf-8'))
observations = []
for item in cases['sources']:
    model = project_source(item['source'].encode('utf-8'))
    assert preimage(model) == item['preimage'], item['name']
    try:
        validate(model, False)
    except (ValueError, AssertionError, TypeError):
        assert not item['carrierAdmitted'], item['name']
    else:
        assert item['carrierAdmitted'], item['name']
    observations.append(dict(finding='F1', name=item['name'], source='accounted', carrier_admitted=item['carrierAdmitted']))
for item in cases['csv']:
    try:
        decode_csv(item['files'])
    except (ValueError, AssertionError, TypeError) as error:
        assert 'empty/nonempty overlap' in str(error), (item['name'], str(error))
    else:
        raise AssertionError(('accepted CSV overlap', item['name']))
    observations.append(dict(finding='F3', name=item['name'], refusal='empty/nonempty overlap'))
for item in cases['xml']:
    try:
        model = decode_xml(item['text'])
    except Exception as error:
        assert not item['accepted'], (item['name'], str(error))
        observations.append(dict(finding='F2', name=item['name'], accepted=False, error=str(error)))
    else:
        assert item['accepted'] and preimage(model) == item['preimage'], item['name']
        observations.append(dict(finding='F2', name=item['name'], accepted=True))
(folder / 'python-repairs.json').write_bytes((json.dumps(dict(platform=platform.system(), observations=observations), indent=2) + '\n').encode())
print(json.dumps(dict(cases=len(observations), status='pass')))
