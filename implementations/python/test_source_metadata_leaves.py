"""Accepted RFC0094 source predicates, independent of developing validate."""
import copy
from dataclasses import replace
import json
import math
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_reader import HEADER
from test_source_validation import payload, fence, OMITTED
from uwmd_reader import parse
from uwmd_source_validation import (inspect_source_roles, _inspect_source_roles_source,
    _metadata_leaf_predicates, _timestamp_t1b)

ROOT = Path(__file__).resolve().parents[2]
FIELDS = ("_meta.quality.confidence", "_meta.lifecycle.revision", "_meta.provenance.timestamp")


def leaves(result):
    return [issue for issue in result["issues"] if issue["code"] == "META-04"]


class SourceMetadataLeafTests(unittest.TestCase):
    def inspect(self, body):
        raw = HEADER + fence(body)
        document = parse(raw); before = copy.deepcopy(document)
        report = inspect_source_roles(document)
        self.assertEqual(document, before)
        self.assertEqual(document.source.raw, raw)
        for issue in leaves(report):
            self.assertEqual(issue["severity"], "error")
            self.assertNotIn("category", issue)
        return report

    def test_all_accepted_appendix_b_timestamps_through_source_and_independent_predicate(self):
        text = (ROOT / "docs/rfcs/0094-present-invalid-metadata-leaves.md").read_text(encoding="utf-8")
        appendix = text.split("## AppendixB:", 1)[1]
        vectors = []
        for row in appendix.splitlines():
            cells = [cell.strip() for cell in row.split("|")]
            if len(cells) == 5 and cells[2].startswith("`"):
                vectors.append((cells[1], json.loads(cells[2].strip("`")), cells[3] == "admit"))
        self.assertEqual(len(vectors), 60)
        self.assertEqual(sum(valid for _, _, valid in vectors), 11)
        for name, timestamp, valid in vectors:
            with self.subTest(name=name):
                self.assertEqual(_timestamp_t1b(timestamp), valid)
                value = payload(); value["_meta"]["provenance"]["timestamp"] = timestamp
                report = _inspect_source_roles_source(HEADER + fence(value))
                self.assertEqual([issue["field"] for issue in leaves(report)], [] if valid else [FIELDS[2]])

    def test_present_confidence_closed_strings_and_absence(self):
        for value in (None, False, True, 0, 1, 1.5, "", "High", " high", "low ", "verified", [], {}, ["high"]):
            with self.subTest(value=value):
                body = payload(); body["_meta"]["quality"]["confidence"] = value
                self.assertEqual([i["field"] for i in leaves(self.inspect(body))], [FIELDS[0]])
        for value in ("high", "medium", "low", OMITTED):
            body = payload()
            if value is OMITTED:
                del body["_meta"]["quality"]["confidence"]
            else:
                body["_meta"]["quality"]["confidence"] = value
            self.assertEqual(leaves(self.inspect(body)), [])

    def test_revision_json_integer_without_bool_coercion_safe_integer_or_chain_limit(self):
        for value in (None, True, False, 0, -0.0, -1, .5, "1", "", [], {}, [1]):
            with self.subTest(value=value):
                body = payload(); body["_meta"]["lifecycle"]["revision"] = value
                self.assertEqual([i["field"] for i in leaves(self.inspect(body))], [FIELDS[1]])
        for value in (1, 1.0, 1e0, 2, 9007199254740992.0, 1e100, 1e308, OMITTED):
            body = payload()
            if value is OMITTED:
                del body["_meta"]["lifecycle"]["revision"]
            else:
                body["_meta"]["lifecycle"]["revision"] = value
            self.assertEqual(leaves(self.inspect(body)), [])
        document = parse(HEADER + fence(payload()))
        for value in (math.nan, math.inf, -math.inf):
            document.source.blocks[0].parsed.value["_meta"]["lifecycle"]["revision"] = value
            self.assertEqual([i["field"] for i in leaves(inspect_source_roles(document))], [FIELDS[1]])

    def test_absence_and_old_parent_shape_suppress_only_owned_descendants(self):
        for value in ({"value": 1}, {"_meta": None}, {"_meta": []}, {"_meta": {}},
                      {"_meta": {"provenance": None, "lifecycle": {}}},
                      {"_meta": {"provenance": {}, "lifecycle": False}},
                      {"section_id": "property", **payload()}):
            self.assertEqual(leaves(self.inspect(value)), [])
        for quality in (OMITTED, None, False, [], "bad"):
            body = payload()
            if quality is OMITTED:
                del body["_meta"]["quality"]
            else:
                body["_meta"]["quality"] = quality
            body["_meta"]["lifecycle"]["revision"] = None
            body["_meta"]["provenance"]["timestamp"] = None
            self.assertEqual([i["field"] for i in leaves(self.inspect(body))], [FIELDS[1], FIELDS[2]])
        body = payload()
        for group, name in (("quality", "confidence"), ("lifecycle", "revision"), ("provenance", "timestamp")):
            del body["_meta"][group][name]
        self.assertEqual(leaves(self.inspect(body)), [])

    def test_complete_leaf_pass_follows_all_shapes_actors_flags_before_role_source(self):
        first = {"before": 1, **payload(_role="bad")}
        first["_meta"]["section"] = "wrong"
        first["_meta"]["provenance"].update(actor="", source="bad", timestamp="bad")
        first["_meta"]["quality"].update(confidence=None, human_review_required=None)
        first["_meta"]["lifecycle"].update(revision=0, superseded=None)
        rejected = payload(); rejected["_meta"]["provenance"] = None
        last = payload()
        last["_meta"]["quality"]["confidence"] = False
        last["_meta"]["lifecycle"]["revision"] = 0
        last["_meta"]["provenance"]["timestamp"] = "bad"
        document = parse(HEADER + fence(first) + fence(rejected) + fence(last))
        result = _inspect_source_roles_source(document.source.raw)
        self.assertEqual([(i["code"], i["context"]["block_index"], i["field"]) for i in result["issues"]], [
            ("META-01", 1, "_meta"), ("META-01", 0, "_meta"), ("META-01", 0, "_meta.section"),
            ("META-01", 0, "_meta.provenance.actor"), ("META-02", 0, "_meta.quality.human_review_required"),
            ("META-03", 0, "_meta.lifecycle.superseded"),
            *[("META-04", index, field) for index in (0, 2) for field in FIELDS],
            ("ROLE-01", 0, "_role"), ("SRC-01", 0, "_meta.provenance.source")])

    def test_all_physical_populations_and_equal_distinct_vs_identical_references(self):
        sections = (("property", None, False), ("property", None, False),
                    ("property", "one", False), ("property", "two", False),
                    ("pipeline_log", None, False), ("custom_calculations", None, False),
                    ("custom_scenarios", None, False), ("x_extra", "a", False),
                    ("x_extra", "b", False), ("property", "old", True))
        raw = HEADER
        for section, variant, history in sections:
            body = payload(); body["_meta"]["section"] = section
            body["_meta"]["quality"]["confidence"] = None
            raw += fence(body, section=section, variant=variant, superseded=history)
        report = _inspect_source_roles_source(raw)
        self.assertEqual([i["context"]["block_index"] for i in leaves(report)], list(range(len(sections))))
        document = parse(HEADER + fence(body, section="property"))
        shared = document.source.blocks[0]
        document = replace(document, source=replace(document.source,
            blocks=(shared, shared, copy.deepcopy(shared))))
        self.assertEqual([i["context"]["block_index"] for i in leaves(inspect_source_roles(document))], [0, 2])

    def test_current_model_mutations_replacements_and_fresh_source_authority(self):
        original = HEADER + fence(payload())
        document = parse(original)
        current = document.source.blocks[0].parsed.value
        current["_meta"]["quality"]["confidence"] = False
        current["_meta"]["lifecycle"]["revision"] = 0
        current["_meta"]["provenance"]["timestamp"] = "bad"
        self.assertEqual([i["field"] for i in leaves(inspect_source_roles(document))], list(FIELDS))
        self.assertEqual(leaves(_inspect_source_roles_source(original)), [])
        self.assertEqual(document.source.raw, original)
        replacement = replace(document.source.blocks[0], parsed=replace(document.source.blocks[0].parsed, value=payload()))
        document = replace(document, source=replace(document.source, blocks=(replacement,)))
        self.assertEqual(leaves(inspect_source_roles(document)), [])

    def test_closed_predicates_do_not_allocate_conditional_optional_or_annotation_errors(self):
        body = payload()
        body["_meta"]["provenance"].update(resolution="inherited_assumption", agent_id=3)
        body["_meta"]["quality"].update(partial="yes", flags=False)
        body["_overrides"] = [{"path": False, "confidence": "bad"}]
        report = self.inspect(body)
        self.assertEqual(leaves(report), [])
        self.assertTrue(report["shape_findings"])
        self.assertEqual(_metadata_leaf_predicates(body), ())

    def test_actual_source_cli_keeps_original_bytes_and_parse_only_discovery(self):
        body = payload(); body["_meta"]["provenance"]["timestamp"] = "2026-01-01t00:00:00Z"
        with tempfile.TemporaryDirectory(prefix="uwmd-meta04-source-") as temporary:
            path = Path(temporary) / "source.uwx.md"; original = HEADER + fence(body); path.write_bytes(original)
            process = subprocess.run([sys.executable, "-B", str(ROOT / "implementations/python/uwmd.py"),
                "inspect-source-roles", str(path), "--json"], capture_output=True, encoding="utf-8", timeout=30)
            response = json.loads(process.stdout)
            self.assertEqual(process.returncode, 1)
            self.assertEqual([i["field"] for i in leaves(response)], [FIELDS[2]])
            self.assertEqual(path.read_bytes(), original)
        from uwmd import main
        manifest, status = main(["manifest"])
        self.assertEqual((status, manifest["capabilities"]), (0, ["parse", "calc-evaluate"]))


if __name__ == "__main__":
    unittest.main()
