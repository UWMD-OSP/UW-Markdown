"""Owner-authorized RFC0091 candidate controls; independent of WIP validate."""
import copy
from dataclasses import replace
import unittest

from test_reader import HEADER
from test_source_validation import OMITTED, fence, payload
from uwmd_reader import parse
from uwmd_source_validation import inspect_source_roles


FIELDS = (("META-02", "quality", "human_review_required"),
          ("META-03", "lifecycle", "superseded"))


def flags(result):
    return [finding for finding in result["issues"] if finding["code"] in ("META-02", "META-03")]


class SourceMetadataFlagTests(unittest.TestCase):
    def inspect(self, raw):
        document = parse(raw)
        before = copy.deepcopy(document)
        result = inspect_source_roles(document)
        self.assertEqual(document, before)
        self.assertEqual(document.source.raw, raw)
        return document, result

    def test_absent_null_every_nonboolean_type_and_exact_boolean_values(self):
        for code, group, name in FIELDS:
            for value in (OMITTED, None, 0, 1, .5, "true", "false", "", [], [False], {}, {"flag": False}):
                with self.subTest(field=name, value=value):
                    body = payload()
                    if value is OMITTED:
                        del body["_meta"][group][name]
                    else:
                        body["_meta"][group][name] = value
                    # A similarly named convenience field is no canonical alias.
                    body[name] = True
                    _, result = self.inspect(HEADER + fence(body))
                    self.assertEqual([(i["code"], i["severity"], i["field"]) for i in flags(result)],
                        [(code, "error", "_meta." + group + "." + name)])
                    finding = flags(result)[0]
                    self.assertEqual(finding["message"], "Block " + finding["field"] + " must be a boolean.")
                    self.assertEqual(finding["remediation"],
                        "State " + finding["field"] + " explicitly as true or false; do not infer a flag.")
                    self.assertNotIn("category", finding)
            for value in (False, True):
                body = payload(); body["_meta"][group][name] = value
                _, result = self.inspect(HEADER + fence(body))
                self.assertEqual(flags(result), [])
                self.assertEqual(result["issues"], [])

    def test_existing_container_precedence_suppresses_both_flags_without_repair(self):
        for body in ({"value": 1}, {"_meta": None}, {"_meta": []},
                     {"_meta": {}}, {"_meta": {"provenance": {}, "lifecycle": None}},
                     {"_meta": {"provenance": False, "lifecycle": {}}},
                     dict(section_id="property", **payload())):
            with self.subTest(body=body):
                _, result = self.inspect(HEADER + fence(body))
                self.assertEqual(flags(result), [])
                self.assertEqual([i["code"] for i in result["issues"]],
                                 [] if "_meta" not in body else ["META-01"])

    def test_missing_nonobject_quality_skips_only_review_flag_not_superseded(self):
        for quality in (OMITTED, None, False, 0, "bad", []):
            with self.subTest(quality=quality):
                body = payload()
                if quality is OMITTED:
                    del body["_meta"]["quality"]
                else:
                    body["_meta"]["quality"] = quality
                body["_meta"]["lifecycle"]["superseded"] = None
                _, result = self.inspect(HEADER + fence(body))
                self.assertEqual([(i["code"], i["field"]) for i in result["issues"]],
                                 [("META-03", "_meta.lifecycle.superseded")])
                self.assertIn("_meta.quality", [f["field"] for f in result["shape_findings"]])

    def test_shape_all_actors_then_each_blocks_02_03_then_prior_role_source_order(self):
        first = payload(_role=None)
        first["_meta"]["provenance"].update(actor="", source="bad")
        first["_meta"]["quality"]["human_review_required"] = None
        del first["_meta"]["lifecycle"]["superseded"]
        malformed = payload(); malformed["_meta"]["provenance"] = None
        last = copy.deepcopy(first)
        last["_meta"]["provenance"]["actor"] = "third"
        _, result = self.inspect(HEADER + fence(first) + fence(malformed) + fence(last))
        self.assertEqual([(i["code"], i["context"]["block_index"]) for i in result["issues"]],
            [("META-01", 1), ("META-01", 0),
             ("META-02", 0), ("META-03", 0), ("META-02", 2), ("META-03", 2),
             ("ROLE-01", 0), ("SRC-01", 0), ("ROLE-01", 2), ("SRC-01", 2)])
        self.assertEqual([i["field"] for i in result["issues"][:2]],
                         ["_meta", "_meta.provenance.actor"])

    def test_all_retained_physical_blocks_history_append_extensions_and_unselected_peers(self):
        raw = HEADER
        sections = (("property", None, False), ("property", None, False),
                    ("property", "default", False), ("property", "other", False),
                    ("pipeline_log", None, False), ("custom_calculations", None, False),
                    ("custom_scenarios", None, False), ("x_peer", "a", False),
                    ("x_peer", "b", False), ("property", None, True), ("x_peer", "old", True))
        for section, variant, history in sections:
            body = payload(); body["_meta"]["section"] = section
            del body["_meta"]["quality"]["human_review_required"]
            del body["_meta"]["lifecycle"]["superseded"]
            if history:
                body["_role"] = "not-reclassified"
                body["_meta"]["provenance"]["source"] = "historical-source"
            raw += fence(body, section=section, variant=variant, superseded=history)
        document, result = self.inspect(raw)
        self.assertEqual([(i["code"], i["context"]["block_index"]) for i in flags(result)],
                         [(code, index) for index in range(len(sections)) for code in ("META-02", "META-03")])
        self.assertEqual(result["issues"], flags(result))
        self.assertEqual(result["history_blocks_skipped"], 2)
        for finding in flags(result):
            block = document.source.blocks[finding["context"]["block_index"]]
            self.assertEqual(finding["context"]["body_byte_start"], block.body_span.start)
            self.assertEqual(finding["context"]["body_byte_end"], block.body_span.end)
        self.assertEqual(len(document.source.blocks), len(sections))

    def test_equal_valued_distinct_blocks_are_not_deduplicated_by_contents(self):
        body = payload(); del body["_meta"]["quality"]["human_review_required"]
        document, result = self.inspect(HEADER + fence(body) + fence(body))
        self.assertEqual(document.source.blocks[0].parsed.value, document.source.blocks[1].parsed.value)
        self.assertIsNot(document.source.blocks[0], document.source.blocks[1])
        self.assertEqual([i["context"]["block_index"] for i in flags(result)], [0, 1])
        # A constructed model can repeat a reference; the flag pass assesses it
        # once, without claiming that this model equals the original source.
        source = replace(document.source, blocks=(document.source.blocks[0], document.source.blocks[0]))
        result = inspect_source_roles(replace(document, source=source))
        self.assertEqual([i["context"]["block_index"] for i in flags(result)], [0])

    def test_current_model_authority_no_stale_raw_reparse_or_projection_alias(self):
        document = parse(HEADER + fence(payload()))
        original_raw = document.source.raw
        projection = document.projection()
        projection["sections"]["property"]["meta"] = {"not": "an authority replacement"}
        self.assertEqual(flags(inspect_source_roles(document)), [])
        body = document.source.blocks[0].parsed.value
        body["_meta"]["quality"]["human_review_required"] = 0
        body["_meta"]["lifecycle"]["superseded"] = "true"
        result = inspect_source_roles(document)
        self.assertEqual([i["code"] for i in flags(result)], ["META-02", "META-03"])
        self.assertEqual(document.source.raw, original_raw)
        result["issues"][0]["context"]["block_index"] = 100
        self.assertEqual(flags(inspect_source_roles(document))[0]["context"]["block_index"], 0)
        copy_model = copy.deepcopy(document)
        copy_model.source.blocks[0].parsed.value["_meta"]["quality"]["human_review_required"] = True
        self.assertEqual([i["code"] for i in flags(inspect_source_roles(copy_model))], ["META-03"])
        self.assertEqual([i["code"] for i in flags(inspect_source_roles(document))], ["META-02", "META-03"])

    def test_unrelated_active_shape_findings_remain_unallocated_and_detached(self):
        body = payload()
        body["_meta"]["section"] = "wrong"
        body["_meta"]["quality"].update(human_review_required="bad", confidence="unknown", partial="bad")
        body["_overrides"] = [dict(path=False)]
        body = {"value": 1, **body}
        _, result = self.inspect(HEADER + fence(body))
        self.assertEqual([i["code"] for i in result["issues"]], ["META-02"])
        self.assertEqual([f["field"] for f in result["shape_findings"]],
            ["_meta", "_meta.section", "_meta.quality.confidence", "_meta.quality.human_review_required",
             "_meta.quality.partial", "_overrides[0].path"])
        self.assertTrue(all("code" not in f and "severity" not in f for f in result["shape_findings"]))


if __name__ == "__main__":
    unittest.main()
