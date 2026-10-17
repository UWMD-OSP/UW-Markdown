"""Fail-closed controls for the measured two-message oracle adaptation."""
import copy
import gzip
import unittest
import cross_runtime as replay

class CrossRuntimeControls(unittest.TestCase):
    def sample(self, version="v20.20.2"):
        data, stdout = replay.expected(version)
        data.pop("created_at"); data.pop("executed_git_head")
        data["runtime"]["node"] = version
        return data, gzip.decompress((replay.HERE/"evidence/node.stdin.json.gz").read_bytes()), stdout, (replay.HERE/"evidence/node.stderr.txt").read_bytes()

    def test_both_measured_profiles_and_actual_reference(self):
        for version in replay.PROFILES:
            with self.subTest(version=version): replay.compare(*self.sample(version))
        replay.check_reference()

    def test_material_behavior_mutants_refuse(self):
        original, stdin, stdout, stderr = self.sample()
        changes = [
            lambda d: d["behavior"]["rows"][32]["node"]["historical"].update(accepted=True),
            lambda d: d["behavior"]["rows"][32]["node"]["historical"].update(error_name="TypeError"),
            lambda d: d["behavior"]["rows"][32]["node"]["historical"].update(raw_crypto_verify_calls=1),
            lambda d: d["behavior"]["rows"][0]["node"]["strict"].update(semantic_digest="sha256:changed"),
            lambda d: d["behavior"]["artifacts"]["all-block-extras"].update(sig="changed"),
            lambda d: d["behavior"]["rows"][2]["node"]["strict"].update(error_message="unproven wording"),
            lambda d: d["behavior"]["rows"][32]["node"]["historical"].update(error_message="unknown syntax message"),
            lambda d: d["behavior"]["rows"].pop(),
        ]
        for index, change in enumerate(changes):
            with self.subTest(mutant=index):
                data = copy.deepcopy(original); change(data)
                with self.assertRaises(AssertionError): replay.compare(data, stdin, stdout, stderr)

    def test_source_dependency_and_raw_mutants_refuse(self):
        original, stdin, stdout, stderr = self.sample()
        for name in ("source_sha256", "node_dependency_sha256", "raw"):
            with self.subTest(field=name):
                data = copy.deepcopy(original)
                data[name][next(iter(data[name]))] = "changed"
                with self.assertRaises(AssertionError): replay.compare(data, stdin, stdout, stderr)
        for streams in ((stdin+b" ", stdout, stderr), (stdin, stdout+b" ", stderr), (stdin, stdout, b"changed")):
            with self.subTest(stderr=streams[2]):
                with self.assertRaises(AssertionError): replay.compare(original, *streams)

    def test_wrong_profile_and_unmeasured_runtime_refuse(self):
        for version in ("v24.14.1", "v20.20.3"):
            data, stdin, stdout, stderr = self.sample()
            data["runtime"]["node"] = version
            with self.subTest(version=version):
                with self.assertRaises(AssertionError): replay.compare(data, stdin, stdout, stderr)

if __name__ == "__main__":
    unittest.main()
