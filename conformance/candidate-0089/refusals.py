"""Check identical invalid bytes with the separate Python implementation."""
import base64
import json
from pathlib import Path
import platform
import re
import sys
from independent import load_json, decode_xml, decode_csv, decode_zip, validate

folder = Path(sys.argv[1])
cases = json.loads((folder / 'refusal-cases.json').read_text(encoding='utf-8'))
observations = []
for item in cases:
    try:
        value = item['value']
        actual = (load_json(value) if item['kind'] == 'json' else decode_xml(value)
                  if item['kind'] == 'xml' else decode_csv(value) if item['kind'] == 'csv'
                  else decode_zip(base64.b64decode(value), item.get('options')))
    except (ValueError, TypeError, AssertionError) as error:
        assert item['layer'] != 'accepted', (item['name'], str(error))
        assert re.search(item['pattern'], str(error), re.I), (item['name'], item['layer'], str(error))
        observations.append(dict(name=item['name'], layer=item['layer'], refusal=str(error)))
    else:
        assert item['layer'] == 'accepted', ('unexpected acceptance', item['name'])
        validate(actual)
        observations.append(dict(name=item['name'], layer='accepted'))
(folder / 'python-refusals.json').write_text(json.dumps(dict(platform=platform.system(), observations=observations), indent=2), encoding='utf-8')
print(json.dumps(dict(cases=len(observations), status='pass')))
