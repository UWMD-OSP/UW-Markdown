"""Negative controls mutate in-memory identity inputs, never frozen evidence."""
import copy
import json
import unittest
from verify_trajectory import ROOT, HERE, verify_sources


class IdentityControls(unittest.TestCase):
    def setUp(self):
        self.transition = json.loads((HERE / 'accepted-main-afcc.json').read_bytes())
        self.record = json.loads((ROOT / self.transition['historical_manifest_path']).read_bytes())
        self.sources = {path: (ROOT / path).read_bytes() for path in self.record['sources']}

    def test_exact_current_sources(self):
        verify_sources(self.record, self.transition, self.sources.__getitem__)

    def test_any_unreviewed_numerical_helper_change_refuses(self):
        for path in self.sources:
            changed = dict(self.sources)
            changed[path] += b' '
            with self.subTest(path=path), self.assertRaises(AssertionError):
                verify_sources(self.record, self.transition, changed.__getitem__)

    def test_wrong_historical_protocol_and_added_transition_refuse(self):
        changed = copy.deepcopy(self.transition)
        changed['transitions']['spec/UW_PROTOCOL.md']['historical_sha256'] = '0' * 64
        with self.assertRaises(AssertionError):
            verify_sources(self.record, changed, self.sources.__getitem__)
        changed = copy.deepcopy(self.transition)
        changed['transitions']['packages/uwmd-verify/src/calc/builtins.ts'] = {}
        with self.assertRaises(AssertionError):
            verify_sources(self.record, changed, self.sources.__getitem__)


if __name__ == '__main__':
    unittest.main()
