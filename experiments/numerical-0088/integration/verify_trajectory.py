"""Verify immutable historical trajectories across one explicit accepted-main identity change."""
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent


def sha(data):
    return hashlib.sha256(data).hexdigest()


def verify_sources(record, transition, read):
    changes = transition['transitions']
    assert set(changes) == {'spec/UW_PROTOCOL.md'}, 'only the reviewed Protocol transition is admitted'
    assert record['checkout_commit'] == transition['historical_checkout_commit']
    assert record['checkout_tree'] == transition['historical_checkout_tree']
    for path, historical in record['sources'].items():
        if path in changes:
            assert historical == changes[path]['historical_sha256'], 'historical Protocol identity'
            expected = changes[path]['accepted_main_sha256']
        else:
            expected = historical
        assert sha(read(path)) == expected, 'unreviewed current source identity: ' + path
    assert set(changes) <= set(record['sources'])


def verify():
    transition = json.loads((HERE / 'accepted-main-afcc.json').read_bytes())
    assert transition['format'] == 'rfc0088-frozen-trajectory-integration-v1'
    manifest = ROOT / transition['historical_manifest_path']
    frozen = manifest.read_bytes()
    assert sha(frozen) == transition['historical_manifest_sha256'], 'immutable historical manifest bytes'
    record = json.loads(frozen)
    verify_sources(record, transition, lambda path: (ROOT / path).read_bytes())
    for item in record['artifacts']:
        packed = (manifest.parent / item['path']).read_bytes()
        assert sha(packed) == item['sha256'], item['path']
        raw = gzip.decompress(packed)
        assert len(raw) == item['raw_bytes'] and sha(raw) == item['raw_sha256'], item['path']
    print('PASS 21 immutable historical trajectory artifacts; exact accepted-afcc Protocol transition; all other sources exact; no graph replay')


if __name__ == '__main__':
    verify()
