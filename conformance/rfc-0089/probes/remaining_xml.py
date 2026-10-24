# Native production import-only adaptation; original controls retained privately.
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[3]/'implementations/python'))
"""Separate Python XML admission/reconstruction; no Node reader invocation."""
import json
import platform
import sys
from pathlib import Path
import xml.etree.ElementTree as ET
import xml.parsers.expat as expat
from uwmd_envelope import decode_xml, preimage

folder = Path(__file__).resolve().parents[3] / 'node_modules/.cache/rfc0089-production-evidence'
observations = []
for item in json.loads((folder / 'remaining-xml-cases.json').read_text(encoding='utf-8')):
    error = None
    try:
        result = decode_xml(item['text'])
        actual = 'equal' if preimage(result) == item.get('preimage') else 'different'
    except Exception as exc:
        actual = 'refused'
        error = str(exc)
    observations.append({'name': item['name'], 'expected': item['expected'], 'actual': actual, 'error': error, 'pass': actual == item['expected']})
report = {'platform': sys.platform, 'python': sys.version, 'python_version': platform.python_version(),
          'expat': expat.EXPAT_VERSION, 'elementtree': ET.VERSION, 'observations': observations,
          'boundary': 'CPython 3.12.3 and current 3.12 patch executed on Windows/Linux. No narrowing to Expat name tables; Fifth Edition QName admission implemented independently. No universal XML proof or execution of every Python patch claimed.'}
(folder / 'remaining-xml-python.json').write_text(json.dumps(report, ensure_ascii=True, indent=2), encoding='utf-8')
assert all(row['pass'] for row in observations), json.dumps([row for row in observations if not row['pass']], ensure_ascii=True)
print(json.dumps({'python': platform.python_version(), 'expat': expat.EXPAT_VERSION, 'passed': len(observations)}))
