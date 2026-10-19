"""Exact registered completeness ownership in developing validate transport."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_reader import HEADER, block
from test_validation import ROOT, validate, well_formed
from uwmd_reader import parse
from uwmd_source_validation import inspect_source_roles
from uwmd_validation_provenance import metadata_assessment

FIELDS = (("section", "SECTION"), ("lifecycle.revision", "VERSION"),
          ("provenance.source", "SOURCE"), ("provenance.timestamp", "TIMESTAMP"),
          ("quality.confidence", "CONFIDENCE"))


def body():
    return parse(HEADER + well_formed("property", address="A", asset_class="multifamily",
                                     units=1, total_units=1)).source.blocks[0].parsed.value


def change(authored, path, *, null=False):
    parent = authored["_meta"]
    parts = path.split(".")
    for name in parts[:-1]:
        parent = parent[name]
    if null:
        parent[parts[-1]] = None
    else:
        del parent[parts[-1]]


class CompletenessOwnershipTests(unittest.TestCase):
    def assess(self, authored):
        # Serialize the authored member order directly: block() intentionally
        # places _meta first and cannot exercise the late-metadata control.
        raw = ("~~~json uw:section=property\n" + json.dumps(authored) + "\n~~~\n").encode()
        document = parse(HEADER + raw)
        before = copy.deepcopy(document)
        result = validate(document)
        self.assertEqual(document, before)
        for severity, key in (("error", "errors"), ("warning", "warnings"), ("info", "info")):
            self.assertEqual(result[key], [i for i in result["issues"] if i["severity"] == severity])
        return result

    def test_all_five_absent_leaves_keep_exact_warning_and_detached_local_evidence(self):
        for path, suffix in FIELDS:
            with self.subTest(path=path):
                authored = body(); change(authored, path)
                result = self.assess(authored)
                code, canonical = "META_FIELD_MISSING_" + suffix, "_meta." + path
                self.assertEqual([(i["code"], i["severity"], i["field"]) for i in result["issues"]],
                                 [(code, "warning", canonical)])
                self.assertEqual(result["overall_status"], "warnings")
                self.assertEqual(result["metadata_assessment"]["shape_findings"], [])
                handled = result["metadata_assessment"]["handled_shape_findings"]
                self.assertEqual([(f["field"], f["registered_code"], f["context"]["block_index"])
                                  for f in handled], [(canonical, code, 0)])
                self.assertEqual(handled[0]["disposition"], "represented_by_registered_completeness_warning")
                self.assertNotIn("severity", handled[0])

    def test_authored_null_and_other_invalid_values_are_not_absence(self):
        for path, suffix in FIELDS:
            for value in (None, False, [], {}):
                with self.subTest(path=path, value=value):
                    authored = body(); change(authored, path, null=True)
                    parent = authored["_meta"]
                    for name in path.split(".")[:-1]: parent = parent[name]
                    parent[path.split(".")[-1]] = value
                    result = self.assess(authored)
                    fields = [f["field"] for f in result["metadata_assessment"]["shape_findings"]]
                    if path == "section":
                        self.assertNotIn("_meta.section", fields)
                        self.assertEqual([(i["code"],i["field"]) for i in result["errors"]],
                                         [("META-01","_meta.section")])
                    elif path == "provenance.source":
                        # Format2.6 already assigns these authored type failures
                        # to SRC-01; this is not a completeness absence warning.
                        self.assertNotIn("_meta." + path, fields)
                        self.assertEqual([(i["code"], i["field"]) for i in result["errors"]],
                                         [("SRC-01", "_meta.provenance.source")])
                    else:
                        self.assertNotIn("_meta." + path, fields)
                        self.assertEqual([(i["code"], i["field"]) for i in result["errors"]],
                                         [("META-04", "_meta." + path)])
                    self.assertNotIn("META_FIELD_MISSING_" + suffix, [i["code"] for i in result["issues"]])

    def test_exact_physical_owner_does_not_consume_same_path_on_another_block(self):
        absent, null = body(), body()
        change(absent, "lifecycle.revision"); change(null, "lifecycle.revision", null=True)
        document = parse(HEADER + block("property", absent) + block("property", null))
        inventory = inspect_source_roles(document)
        path, code = "_meta.lifecycle.revision", "META_FIELD_MISSING_VERSION"
        for owners in ((), ((1, path, code),), ((0, path, "META_FIELD_MISSING_SOURCE"),),
                       ((True, path, code),), ((-1, path, code),)):
            result = metadata_assessment(document, inventory, missing_field_owners=owners)
            self.assertEqual([f["context"]["block_index"] for f in result["shape_findings"]], [0])
        result = validate(document)
        self.assertEqual(result["metadata_assessment"]["shape_findings"], [])
        self.assertEqual([(f["context"]["block_index"], f["registered_code"]) for f in
                         result["metadata_assessment"]["handled_shape_findings"]], [(0, code), (1, "META-04")])
        self.assertEqual([(i["code"], i["context"]["block_index"]) for i in result["errors"]],
                         [("META-04", 1)])

    def test_accepted_parent_and_independent_unallocated_shape_remain_separate(self):
        authored = body(); authored["_meta"]["quality"] = None
        result = self.assess(authored)
        self.assertEqual(result["metadata_assessment"]["shape_findings"], [])
        self.assertEqual([(i["code"],i["field"]) for i in result["errors"]],
                         [("META-01","_meta.quality")])
        authored = body(); change(authored, "section")
        result = self.assess({"payload_first": 1, **authored})
        self.assertEqual(result["metadata_assessment"]["shape_findings"], [])
        self.assertEqual([(i["code"],i["field"]) for i in result["errors"]], [("META-01","_meta")])
        authored = body(); change(authored, "lifecycle.revision")
        authored["_meta"]["section"] = "wrong"
        authored["_overrides"] = [{"path": "units", "confidence": "invalid"}]
        result = self.assess(authored)
        self.assertEqual([f["field"] for f in result["metadata_assessment"]["shape_findings"]],
                         ["_overrides[0].confidence"])
        self.assertEqual([(i["code"],i["field"]) for i in result["errors"]],
                         [("META-01","_meta.section")])

    def test_history_and_low_level_inventory_scope_are_unchanged(self):
        authored = body(); change(authored, "lifecycle.revision")
        active = parse(HEADER + block("property", authored))
        inventory = inspect_source_roles(active)
        self.assertEqual([f["field"] for f in inventory["shape_findings"]], ["_meta.lifecycle.revision"])
        self.assertEqual(metadata_assessment(active, inventory)["shape_findings"], inventory["shape_findings"])
        authored["_meta"]["lifecycle"]["superseded"] = True
        historical = parse(HEADER + block("property", authored, superseded=True))
        result = validate(historical)
        self.assertFalse(any(i["code"].startswith("META_FIELD_MISSING_") for i in result["issues"]))
        self.assertEqual(result["metadata_assessment"]["shape_findings"], [])

    def test_real_cli_all_five_warning_results_versus_invalid_authored_null(self):
        with tempfile.TemporaryDirectory(prefix="uwmd-completeness-cli-") as folder:
            path = Path(folder) / "input.uwx.md"
            for field, suffix in FIELDS:
                for null in (False, True):
                    with self.subTest(field=field, null=null):
                        authored = body(); change(authored, field, null=null)
                        raw = HEADER + block("property", authored); path.write_bytes(raw)
                        process = subprocess.run([sys.executable, "-B", str(ROOT / "implementations/python/uwmd.py"),
                            "validate", str(path), "--json"], capture_output=True, encoding="utf8", timeout=30)
                        result = json.loads(process.stdout)
                        self.assertEqual(process.stderr, "")
                        self.assertEqual(path.read_bytes(), raw)
                        self.assertEqual(process.returncode, int(null))
                        if null:
                            self.assertNotIn("error", result)
                            self.assertEqual(result["overall_status"], "errors")
                            owner = {"section": "META-01", "provenance.source": "SRC-01"}.get(field, "META-04")
                            self.assertEqual([i["code"] for i in result["errors"]], [owner])
                            self.assertEqual(result["metadata_assessment"]["shape_findings"], [])
                        else:
                            self.assertNotIn("error", result)
                            self.assertEqual(result["overall_status"], "warnings")
                            self.assertEqual([i["code"] for i in result["issues"]], ["META_FIELD_MISSING_" + suffix])
                            self.assertEqual((len(result["stage_readiness"]), len(result["coverage"])), (7, 15))


if __name__ == "__main__":
    unittest.main()
