"""Run both directions against committed expectations; never refresh an oracle."""
import copy
import io
import json
from pathlib import Path
import platform
import sys
import zipfile
sys.path.insert(0,str(Path(__file__).resolve().parents[2] / 'implementations/python'))
from uwmd_envelope import (validate, load_json, project_source, dump, digest, preimage,
                         encode_xml, decode_xml, encode_csv, decode_csv, encode_zip, decode_zip)

HERE = Path(__file__).resolve().parent
folder = Path(sys.argv[1])
packet = json.loads((HERE / 'cases.json').read_text(encoding='utf-8'))
observations = []
for item in packet['source_cases'] + packet['direct_models']:
    name = item['name']
    expected = copy.deepcopy(item['expected_model'])
    if 'source' in item:
        actual = project_source(item['source'].encode('utf-8'), generator='candidate')
        assert dump(actual) == dump(expected), ('independent source model', name)
    assert preimage(expected) == item['expected_preimage'], ('frozen preimage', name)
    assert digest(expected) == item['expected_digest'], ('frozen digest', name)
    expected['semantic_digest'] = item['expected_digest']
    target = folder / name
    node_json = validate(load_json((target / 'node.json').read_text(encoding='utf-8')))
    node_xml = decode_xml((target / 'node.xml').read_text(encoding='utf-8'))
    node_csv = decode_csv(json.loads((target / 'node-csv.json').read_text(encoding='utf-8')))
    node_store = decode_zip((target / 'node-store.zip').read_bytes())
    node_deflate = decode_zip((target / 'node-deflate.zip').read_bytes())
    for actual in (node_json, node_xml, node_csv, node_store, node_deflate):
        assert dump(actual) == dump(expected), ('complete model', name)
        assert preimage(actual) == item['expected_preimage'], ('complete subject', name)
    (target / 'python.json').write_text(dump(expected), encoding='utf-8')
    (target / 'python.xml').write_text(encode_xml(expected), encoding='utf-8')
    (target / 'python-csv.json').write_text(json.dumps(encode_csv(expected), ensure_ascii=True), encoding='utf-8')
    (target / 'python-store.zip').write_bytes(encode_zip(expected, zipfile.ZIP_STORED))
    (target / 'python-deflate.zip').write_bytes(encode_zip(expected, zipfile.ZIP_DEFLATED))
    class Streaming(io.BytesIO):
        def seekable(self):
            return False

        def seek(self, *_args):
            raise io.UnsupportedOperation('streaming writer')
    stream = Streaming()
    with zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for path, text in encode_csv(expected).items():
            archive.writestr(path, text.encode('utf-8'))
    streamed = stream.getvalue()
    assert dump(decode_zip(streamed)) == dump(expected), ('streaming descriptors', name)
    (target / 'python-streaming.zip').write_bytes(streamed)
    observations.append({'case': name, 'source': 'pass' if 'source' in item else 'not_applicable',
                         'node_to_python': ['json', 'xml', 'csv', 'store', 'deflate'],
                         'complete_model': 'pass', 'frozen_preimage': 'pass'})
result = {'python': platform.python_version(), 'platform': platform.system(), 'observations': observations,
          'independent_review': 'not claimed by this execution'}
(folder / 'python-results.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'cases': len(observations), 'carriers_per_case': 5, 'status': 'pass'}))
