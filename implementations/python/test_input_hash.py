"""Independent RFC 0133 draft implementation controls; no TypeScript oracle."""
import asyncio
import copy
import json
from pathlib import Path
import unittest

from uwmd_reader import parse
from uwmd_validation import validate_document
from uwmd_envelope import project_source, validate, encode_xml, encode_csv, InputHashError

ROOT = Path(__file__).resolve().parents[2]
SOURCE = (ROOT / "conformance/documents/malformed/74-malformed-input-hash.uwx.md").read_text(encoding="utf-8")


def raw_hash(value):
    return SOURCE.replace('"sha256:abcd"', json.dumps(value)).encode("utf-8")


class InputHashTests(unittest.TestCase):
    def test_malformed_values_validation_and_all_carriers_keep_code_and_source(self):
        for value in ("sha256:abcd", "sha256:" + "A" * 64, 123, False, 0, {}, [], "\n", "sha256:" + "a" * 64 + "\n"):
            with self.subTest(value=value):
                raw = raw_hash(value)
                document = parse(raw)
                before = copy.deepcopy(document)
                result = asyncio.run(validate_document(document))
                findings = [i for i in result["issues"] if i["code"] == "INT-16"]
                self.assertEqual([(i["severity"], i["section"], i["field"]) for i in findings],
                    [("error", "property", "_meta.integrity.input_hash")])
                model = project_source(raw)
                for operation in (lambda m: validate(m, False), encode_xml, encode_csv):
                    with self.assertRaises(InputHashError) as raised:
                        operation(model)
                    self.assertEqual(raised.exception.code, "INT-16")
                self.assertEqual(document, before)

    def test_null_empty_and_exact_hash_controls(self):
        for value in (None, "", "sha256:" + "a" * 64):
            with self.subTest(value=value):
                raw = raw_hash(value)
                result = asyncio.run(validate_document(parse(raw)))
                self.assertFalse(any(i["code"] == "INT-16" for i in result["issues"]))
                validate(project_source(raw), False)

    def test_absence_preserves_admission(self):
        model = project_source(raw_hash(None))
        del model["sections"]["property"]["content"]["_meta"]["integrity"]
        validate(model, False)
