"""Existing Format2.6 SRC-01 ownership, not a new admission vocabulary."""
import copy
from dataclasses import replace
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_reader import HEADER, block
from test_validation import ROOT, validate
from test_validation_completeness import body
from uwmd_reader import parse
from uwmd_source_validation import inspect_source_roles
from uwmd_validation_provenance import metadata_assessment

FIELD = "_meta.provenance.source"


def document(value):
    authored = body(); authored["_meta"]["provenance"]["source"] = value
    return parse(HEADER + block("property", authored))


class SourceOwnershipTests(unittest.TestCase):
    def test_every_nonstring_keeps_exact_src01_without_duplicate_local_refusal(self):
        for value in (None, False, True, 0, 1.5, [], {}, ["manual"], {"source": "manual"}):
            with self.subTest(value=value):
                parsed = document(value); before = copy.deepcopy(parsed)
                inventory = inspect_source_roles(parsed)
                result = validate(parsed)
                self.assertEqual([(i["code"], i["severity"], i["field"]) for i in result["issues"]],
                                 [("SRC-01", "error", FIELD)])
                self.assertEqual(result["issues"], inventory["issues"])
                self.assertEqual(result["errors"], result["issues"])
                self.assertEqual((result["warnings"], result["info"]), ([], []))
                self.assertEqual(result["metadata_assessment"]["shape_findings"], [])
                handled = result["metadata_assessment"]["handled_shape_findings"]
                self.assertEqual([(f["field"], f["registered_code"], f["disposition"]) for f in handled],
                    [(FIELD, "SRC-01", "represented_by_registered_source_type_error")])
                self.assertEqual(parsed, before)
                self.assertEqual(inspect_source_roles(parsed), inventory)

    def test_valid_and_invalid_strings_keep_existing_grammar_and_resolution_owners(self):
        for value, code in (("manual", None), ("document/om.pdf", None),
                            ("", "SRC-01"), (" manual", "SRC-01"),
                            ("other/id", "SRC-01"), ("user_input", "SRC-02")):
            with self.subTest(value=value):
                result = validate(document(value))
                self.assertEqual([i["code"] for i in result["issues"]], [code] if code else [])
                self.assertEqual(result["metadata_assessment"]["shape_findings"], [])
                self.assertNotIn("handled_shape_findings", result["metadata_assessment"])
        authored = body(); authored["_meta"]["provenance"]["resolution"] = False
        result = validate(parse(HEADER + block("property", authored)))
        self.assertEqual([(i["code"], i["field"]) for i in result["issues"]],
                         [("SRC-03", "_meta.provenance.resolution")])

    def test_actual_error_identity_severity_field_and_section_are_required(self):
        parsed = document(None); inventory = inspect_source_roles(parsed)
        for key, value in (("code", "SRC-02"), ("severity", "warning"),
                           ("field", "_meta.provenance.timestamp"), ("section", "other")):
            changed = copy.deepcopy(inventory); changed["issues"][0][key] = value
            self.assertEqual([f["field"] for f in metadata_assessment(parsed, changed)["shape_findings"]], [FIELD])
        for index in (True, -1, 1):
            changed = copy.deepcopy(inventory); changed["issues"][0]["context"]["block_index"] = index
            self.assertEqual([f["field"] for f in metadata_assessment(parsed, changed)["shape_findings"]], [FIELD])
        changed = copy.deepcopy(inventory); changed["issues"] = []
        self.assertEqual(metadata_assessment(parsed, changed)["shape_findings"], inventory["shape_findings"])

    def test_source_owner_proof_never_admits_a_nonobject_constructed_payload(self):
        parsed = document(None)
        inventory = inspect_source_roles(parsed)
        # Proof-only forged inventory bypasses earlier object-domain traversal.
        # This does not assert that general validation admits malformed models.
        inventory["blocks"] = []
        for value in (None, False, 0, "payload", []):
            with self.subTest(value=value):
                original = parsed.source.blocks[0]
                changed_block = replace(original, parsed=replace(original.parsed, value=value))
                changed = replace(parsed, source=replace(parsed.source, blocks=(changed_block,)))
                result = metadata_assessment(changed, inventory)
                self.assertEqual(result["shape_findings"], inventory["shape_findings"])
                self.assertNotIn("handled_shape_findings", result)

    def test_independent_unallocated_conditions_survive_the_registered_owner(self):
        authored = body(); authored["_meta"]["provenance"].update(source=0, timestamp="invalid")
        authored["_meta"]["quality"] = None
        authored["_overrides"] = [{"path": "units", "confidence": "invalid"}]
        authored = {"payload_first": 1, **authored}
        raw = ("~~~json uw:section=property\n" + json.dumps(authored) + "\n~~~\n").encode()
        parsed = parse(HEADER + raw); inventory = inspect_source_roles(parsed)
        without_owner = copy.deepcopy(inventory); without_owner["issues"] = []
        local = metadata_assessment(parsed, without_owner)["shape_findings"]
        result = validate(parsed)
        self.assertEqual(result["metadata_assessment"]["shape_findings"],
                         [f for f in local if f["field"] != FIELD])
        self.assertEqual({f["field"] for f in result["metadata_assessment"]["shape_findings"]},
                         {"_meta", "_meta.quality", "_meta.provenance.timestamp", "_overrides[0].confidence"})
        self.assertEqual([i["code"] for i in result["errors"]], ["SRC-01"])

    def test_other_block_leaf_and_history_populations_are_not_redirected(self):
        bad, good = body(), body(); bad["_meta"]["provenance"]["source"] = []
        good["_meta"]["provenance"]["timestamp"] = False
        parsed = parse(HEADER + block("property", bad) + block("property", good))
        result = validate(parsed)
        self.assertEqual([(f["context"]["block_index"], f["field"]) for f in
                         result["metadata_assessment"]["shape_findings"]], [(1, "_meta.provenance.timestamp")])
        self.assertEqual([(f["context"]["block_index"], f["registered_code"]) for f in
                         result["metadata_assessment"]["handled_shape_findings"]], [(0, "SRC-01")])
        good = body(); good["_overrides"] = [{"path": "units", "source": []}]
        result = validate(parse(HEADER + block("property", good)))
        self.assertEqual([(i["code"], i["field"]) for i in result["issues"]],
                         [("SRC-01", "_overrides[0].source")])
        self.assertNotIn("handled_shape_findings", result["metadata_assessment"])
        bad["_meta"]["lifecycle"]["superseded"] = True
        historical = parse(HEADER + block("property", bad, superseded=True))
        self.assertFalse(any(i["code"].startswith("SRC-") for i in validate(historical)["issues"]))

    def test_real_cli_uses_existing_src_error_and_retains_independent_partial_boundary(self):
        with tempfile.TemporaryDirectory(prefix="uwmd-src-owner-cli-") as folder:
            path = Path(folder) / "input.uwx.md"
            for value, quality_bad, expected in (("manual", False, None),
                    (0, False, "SRC-01"), ("user_input", False, "SRC-02"), (None, True, "SRC-01")):
                authored = body(); authored["_meta"]["provenance"]["source"] = value
                if quality_bad: authored["_meta"]["quality"] = None
                raw = HEADER + block("property", authored); path.write_bytes(raw)
                process = subprocess.run([sys.executable, "-B", str(ROOT / "implementations/python/uwmd.py"),
                    "validate", str(path), "--json"], capture_output=True, encoding="utf8", timeout=30)
                result = json.loads(process.stdout)
                self.assertEqual((process.returncode, process.stderr), (int(expected is not None), ""))
                self.assertEqual(path.read_bytes(), raw)
                structural = result["partial_validation_result"] if quality_bad else result
                self.assertEqual([i["code"] for i in structural["errors"]], [expected] if expected else [])
                if quality_bad:
                    self.assertNotIn("code", result["error"])
                    self.assertEqual([f["field"] for f in result["metadata_assessment"]["shape_findings"]], ["_meta.quality"])
                else:
                    self.assertNotIn("error", result)
                    self.assertEqual((len(result["stage_readiness"]), len(result["coverage"])), (7, 15))


if __name__ == "__main__":
    unittest.main()
