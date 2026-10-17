"""Bounded candidate transport controls; no standard conformance claims."""
import copy
import hashlib
import json
from pathlib import Path
import unittest
from codec import decode_csv, decode_xml, decode_zip, encode_csv, encode_xml, encode_zip, stamped, Refusal
from inputs import models

HERE = Path(__file__).resolve().parent


class CodecStudy(unittest.TestCase):
    def test_complete_crosscodec_values(self):
        for name, source in models().items():
            expected = json.loads((HERE / "fixtures" / name / "model.json").read_text(encoding="utf8"))
            self.assertEqual(stamped(source), expected)
            files = {p.name: p.read_bytes().decode("utf8") for p in (HERE / "fixtures" / name / "csv").iterdir()}
            self.assertEqual(decode_csv(files), expected)
            self.assertEqual(decode_xml((HERE / "fixtures" / name / "document.xml").read_text(encoding="utf8")), expected)
            self.assertEqual(decode_zip((HERE / "fixtures" / name / "bundle.zip").read_bytes()), expected)
            self.assertEqual(encode_zip(files), (HERE / "fixtures" / name / "bundle.zip").read_bytes())

    def test_missing_and_reserved_extra_scope(self):
        files = encode_csv(stamped(models()["all-block-extras"]))
        for changed in [files["block_values.csv"].replace('"block-extra"', '"unknown-scope"'), files["block_values.csv"].replace('"/x_extra"', '"/annotation"')]:
            disposable = dict(files); disposable["block_values.csv"] = changed
            manifest = json.loads(disposable["manifest.json"])
            for item in manifest["inventory"]:
                raw = disposable[item["path"]].encode("utf8"); item["bytes"] = len(raw); item["sha256"] = hashlib.sha256(raw).hexdigest()
            disposable["manifest.json"] = json.dumps(manifest)
            with self.assertRaises(Refusal): decode_csv(disposable)

    def test_xml_no_sanitization_or_noncanonical_lexical(self):
        text = encode_xml(stamped(models()["xml-lexical-domain"]))
        for mutated in [text.replace('\\u0000', '\\u0001', 1), text.replace('\\ufffe', '\\uFFFE', 1), text.replace('type="string"', 'type="unknown"', 1), text.replace('<?xml', '<!DOCTYPE value><' + '?xml', 1)]:
            with self.assertRaises((Refusal, ValueError)): decode_xml(mutated)

    def test_zip_security_profile(self):
        raw = encode_zip(encode_csv(stamped(models()["all-block-extras"])))
        mutations = [raw + b'X', raw[:6] + bytes([1]) + raw[7:], raw[:8] + bytes([8]) + raw[9:], raw[:45] + bytes([raw[45] ^ 1]) + raw[46:]]
        for changed in mutations:
            with self.assertRaises((Refusal, ValueError, RuntimeError, NotImplementedError)): decode_zip(changed)

    def test_nullable_identity_distinct_and_duplicate_refusal(self):
        model = stamped(models()["all-block-extras"])
        identities = [record["variant"] for record in model["extensions"]["x_review"]["blocks"]]
        self.assertEqual(identities, [None, "default"])
        model["extensions"]["x_review"]["blocks"][1] = copy.deepcopy(model["extensions"]["x_review"]["blocks"][0])
        with self.assertRaises(Refusal): stamped(model)


if __name__ == "__main__": unittest.main()
