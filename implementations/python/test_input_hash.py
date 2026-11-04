"""Independent accepted RFC 0133 controls; no TypeScript oracle."""
import asyncio
import copy
import json
from pathlib import Path
import unittest
import subprocess
import sys
import tempfile

from uwmd_reader import parse
from uwmd_validation import validate_document
from uwmd_envelope import project_source, validate, encode_xml, encode_csv, encode_zip, stamp, InputHashError

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


    def test_actual_carrier_cli_initializes_preflight_before_admission(self):
        model = project_source(raw_hash("sha256:" + "a" * 64))
        carriers = {
            "json": json.dumps(stamp(model)).encode("utf-8"),
            "xml": encode_xml(model).encode("utf-8"),
            "zip": encode_zip(model),
        }
        entry = ROOT / "implementations/python/uwmd_envelope.py"
        with tempfile.TemporaryDirectory(prefix="uwmd-hash-cli-") as folder:
            path = Path(folder) / "carrier.input"
            for command, content in carriers.items():
                with self.subTest(command=command):
                    path.write_bytes(content)
                    child = subprocess.run([sys.executable, "-B", str(entry), command, str(path)],
                        cwd=folder, capture_output=True, timeout=30)
                    self.assertEqual(child.returncode, 0, child.stderr)
                    self.assertEqual(child.stderr, b"")
                    self.assertEqual(json.loads(child.stdout)["model"]["sections"]["property"]["content"]["_meta"]["integrity"]["input_hash"], "sha256:" + "a" * 64)
                    self.assertEqual(path.read_bytes(), content)
            malformed = stamp(model)
            malformed["sections"]["property"]["content"]["_meta"]["integrity"]["input_hash"] = 0
            content = json.dumps(malformed).encode("utf-8")
            path.write_bytes(content)
            child = subprocess.run([sys.executable, "-B", str(entry), "json", str(path)],
                cwd=folder, capture_output=True, timeout=30)
            self.assertEqual(child.returncode, 1)
            self.assertEqual(child.stderr, b"")
            self.assertIn("INT-16", json.loads(child.stdout)["error"])
            self.assertEqual(path.read_bytes(), content)


    def test_hash_pass_follows_metadata_admission_and_precedes_actor_findings(self):
        document = parse(raw_hash("sha256:abcd"))
        meta = document.source.blocks[0].parsed.value["_meta"]
        meta["quality"]["flags"] = 0
        meta["provenance"]["source"] = "bad_actor"
        meta["provenance"]["resolution"] = "market_data_accepted"
        issues = asyncio.run(validate_document(document))["issues"]
        codes = [issue["code"] for issue in issues]
        for code in ("META-05", "META-06", "INT-16", "SRC-01"):
            self.assertIn(code, codes)
        self.assertLess(codes.index("META-06"), codes.index("INT-16"))
        self.assertLess(codes.index("INT-16"), codes.index("SRC-01"))
