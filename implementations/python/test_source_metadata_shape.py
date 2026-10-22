"""Accepted RFC0093 inventory/source controls with no WIP validate dependency."""
import copy
from dataclasses import replace
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_reader import HEADER
from test_source_validation import payload
from uwmd import main
from uwmd_reader import parse
from uwmd_source_validation import (
    inspect_source_roles, _inspect_source_roles_source, _array_index_name)

ROOT = Path(__file__).resolve().parents[2]
OMITTED = object()


def body():
    return payload()


def fence(value, *, section="property", annotation=""):
    return (("```json uw:section=" + section + annotation + "\n")
            + json.dumps(value, ensure_ascii=True) + "\n```\n").encode()


def shapes(report):
    return [(i["context"]["block_index"], i["field"]) for i in report["issues"]
            if i["code"] == "META-01" and i["field"] in
            ("_meta", "_meta.section", "_meta.quality")]


class SourceMetadataShapeTests(unittest.TestCase):
    def source(self, raw):
        before = bytes(raw)
        report = _inspect_source_roles_source(raw)
        self.assertEqual(raw, before)
        return report

    def test_source_lexical_and_model_nonindex_order_are_distinct(self):
        for key, is_index in (("0", True), ("1", True), ("4294967294", True),
                              ("00", False), ("-0", False), ("01", False),
                              ("4294967295", False), ("1.0", False),
                              ("١", False), ("9007199254740991", False)):
            with self.subTest(key=key):
                self.assertEqual(_array_index_name(key), is_index)
                value = {key: 1, **body()}
                raw = HEADER + fence(value)
                self.assertEqual(shapes(self.source(raw)), [(0, "_meta")])
                document = parse(raw); before = copy.deepcopy(document)
                self.assertEqual(shapes(inspect_source_roles(document)),
                                 [] if is_index else [(0, "_meta")])
                self.assertEqual(document, before)
                # Following a first _meta never creates lexical lateness.
                value = body(); value[key] = 1
                self.assertEqual(shapes(self.source(HEADER + fence(value))), [])
        self.assertFalse(_array_index_name(True))

    def test_complete_shape_pass_precedes_all_actors_then_flags_and_sources(self):
        first = {"value": 1, **body()}
        first["_meta"]["section"] = "wrong"
        first["_meta"]["quality"] = None
        first["_meta"]["provenance"].update(actor="", source="bad")
        first["_meta"]["lifecycle"]["superseded"] = None
        rejected = body(); rejected["_meta"]["provenance"] = None
        last = body(); last["_meta"]["section"] = "wrong"
        del last["_meta"]["provenance"]["actor"]
        last["_meta"]["quality"]["human_review_required"] = None
        raw = HEADER + fence(first) + fence(rejected) + fence(last)
        report = self.source(raw)
        self.assertEqual([(i["code"], i["context"]["block_index"], i["field"])
                          for i in report["issues"]], [
            ("META-01", 1, "_meta"),
            ("META-01", 0, "_meta"), ("META-01", 0, "_meta.section"),
            ("META-01", 0, "_meta.quality"), ("META-01", 2, "_meta.section"),
            ("META-01", 0, "_meta.provenance.actor"), ("META-01", 2, "_meta.provenance.actor"),
            ("META-03", 0, "_meta.lifecycle.superseded"),
            ("META-02", 2, "_meta.quality.human_review_required"),
            ("SRC-01", 0, "_meta.provenance.source")])

    def test_existing_parent_rejection_prevents_only_its_own_cascades(self):
        for alter in ("section_id", "_meta", "provenance", "lifecycle"):
            value = {"before": 1, **body()}
            value["_meta"]["section"] = "wrong"; value["_meta"]["quality"] = None
            if alter == "section_id": value["section_id"] = "property"
            elif alter == "_meta": value["_meta"] = None
            else: value["_meta"][alter] = []
            report = self.source(HEADER + fence(value))
            self.assertEqual([(i["code"], i["field"]) for i in report["issues"]],
                             [("META-01", "_meta")])
            self.assertFalse(any(f["field"] in ("_meta.section", "_meta.quality")
                                 for f in report["shape_findings"]))

    def test_every_retained_population_and_exact_reference_deduplication(self):
        raw = HEADER
        for section, annotation in (("property", ""), ("property", " superseded=true"),
                                    ("property", " variant=default"), ("property", " variant=named"),
                                    ("pipeline_log", ""), ("x_extension", "")):
            value = body(); value["_meta"]["section"] = section
            value["_meta"]["quality"] = None
            raw += fence(value, section=section, annotation=annotation)
        report = self.source(raw)
        self.assertEqual(shapes(report), [(i, "_meta.quality") for i in range(6)])
        document = parse(HEADER + fence(body()) + fence(body()))
        first, second = document.source.blocks
        first.parsed.value["_meta"]["quality"] = None
        second.parsed.value["_meta"]["quality"] = None
        document = replace(document, source=replace(document.source, blocks=(first, second, first)))
        self.assertEqual(shapes(inspect_source_roles(document)),
                         [(0, "_meta.quality"), (1, "_meta.quality")])

    def test_current_model_reorders_replaces_and_annotates_without_raw_reparse(self):
        raw = HEADER + fence({"0": 1, **body()})
        document = parse(raw)
        self.assertEqual(shapes(inspect_source_roles(document)), [])
        original = document.source.blocks[0]
        value = original.parsed.value
        meta = value.pop("_meta"); value["payload"] = 2; value["_meta"] = meta
        self.assertEqual(shapes(inspect_source_roles(document)), [(0, "_meta")])
        original = replace(original, section="x_changed")
        document = replace(document, source=replace(document.source, blocks=(original,)))
        before = copy.deepcopy(document)
        self.assertEqual(shapes(inspect_source_roles(document)),
                         [(0, "_meta"), (0, "_meta.section")])
        self.assertEqual(document, before)
        self.assertEqual(document.source.raw, raw)
        # A replacement model block is canonical even if its span/raw is stale.
        replacement = parse(HEADER + fence(body())).source.blocks[0]
        replacement.parsed.value["_meta"]["quality"] = None
        document = replace(document, source=replace(document.source, blocks=(replacement,)))
        self.assertEqual(shapes(inspect_source_roles(document)), [(0, "_meta.quality")])
        self.assertEqual(document.source.raw, raw)


    def test_present_section_exact_types_and_matching_unknown_annotation(self):
        for section in (None, "", False, 0, [], {}, "Property", " property", "x_other"):
            value = body(); value["_meta"]["section"] = section
            self.assertEqual(shapes(self.source(HEADER + fence(value))), [(0, "_meta.section")])
        value = body(); del value["_meta"]["section"]
        self.assertEqual(shapes(self.source(HEADER + fence(value))), [])
        value = body(); value["_meta"]["section"] = "x_unknown"
        self.assertEqual(shapes(self.source(HEADER + fence(value, section="x_unknown"))), [])

    def test_quality_container_predicate_never_suppresses_actor_or_lifecycle(self):
        for quality in (OMITTED, None, False, 0, "", [], [False]):
            value = body()
            if quality is OMITTED: del value["_meta"]["quality"]
            else: value["_meta"]["quality"] = quality
            del value["_meta"]["provenance"]["actor"]
            value["_meta"]["lifecycle"]["superseded"] = None
            report = self.source(HEADER + fence(value))
            self.assertEqual([(i["code"], i["field"]) for i in report["issues"]], [
                ("META-01", "_meta.quality"), ("META-01", "_meta.provenance.actor"),
                ("META-03", "_meta.lifecycle.superseded")])
        value = body(); value["_meta"]["quality"] = {}
        self.assertEqual([(i["code"], i["field"]) for i in self.source(HEADER + fence(value))["issues"]],
                         [("META-02", "_meta.quality.human_review_required")])

    def test_decoded_meta_and_nested_unknown_payload_keep_exact_scope(self):
        raw = HEADER + fence(body()).replace(b'"_meta"', b'"\\u005fmeta"', 1)
        self.assertEqual(shapes(self.source(raw)), [])
        value = body(); value["content"] = {"_meta": {"section": "nested"}}
        self.assertEqual(shapes(self.source(HEADER + fence(value))), [])
        self.assertEqual(shapes(self.source(HEADER + fence({"content": {"_meta": body()["_meta"]}}))), [])

    def test_real_inventory_cli_uses_source_order_and_keeps_discovery_parse_only(self):
        with tempfile.TemporaryDirectory(prefix="uwmd-source-shape-0093-") as folder:
            path = Path(folder) / "input.uwx.md"
            for value, expected in ((body(), []), ({"0": 1, **body()}, ["_meta"])):
                raw = HEADER + fence(value); path.write_bytes(raw)
                process = subprocess.run([sys.executable, "-B", str(ROOT / "implementations/python/uwmd.py"),
                    "inspect-source-roles", str(path), "--json"],
                    capture_output=True, encoding="utf-8", timeout=60)
                report = json.loads(process.stdout)
                self.assertEqual(process.stderr, "")
                self.assertEqual(process.returncode, int(bool(expected)))
                self.assertEqual([field for _, field in shapes(report)], expected)
                self.assertEqual(path.read_bytes(), raw)
        self.assertEqual(main(["manifest"])[0]["capabilities"], ["parse", "calc-evaluate", "validate"])


if __name__ == "__main__":
    unittest.main()
