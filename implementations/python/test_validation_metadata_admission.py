"""Whole base-metadata admission at the existing validation/CLI boundary.

Registered actor/source/completeness findings remain separate from unallocated
shape findings. No optional-profile verification or capability is inferred.
"""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_reader import HEADER
from test_validation import ROOT, validate
from test_validation_cli import property_source
from uwmd import _validation_response, main
from uwmd_reader import parse
from uwmd_source_validation import inspect_source_roles

OMITTED = object()
DIGEST = "sha256:" + "0" * 64


def body():
    return copy.deepcopy(parse(property_source()).source.blocks[0].parsed.value)


def fence(value, section="property", annotation=""):
    return (("```json uw:section=" + section + annotation + "\n")
            + json.dumps(value, ensure_ascii=True) + "\n```\n").encode()


def reference(kind):
    if kind == "market_data_ref":
        return dict(document_id="market", as_of="authored vintage", digest=DIGEST)
    return dict(document_id="ancestor", digest=DIGEST, distance=1)


class MetadataAdmissionTests(unittest.TestCase):
    def assess(self, value):
        document = parse(HEADER + fence(value))
        before = copy.deepcopy(document)
        result = validate(document)
        self.assertEqual(document, before)
        self.assertEqual(document.source.raw, before.source.raw)
        for severity, key in (("error", "errors"), ("warning", "warnings"), ("info", "info")):
            self.assertEqual(result[key], [i for i in result["issues"] if i["severity"] == severity])
        findings = result["metadata_assessment"]["shape_findings"]
        for finding in findings:
            self.assertNotIn("code", finding)
            self.assertNotIn("severity", finding)
            block = document.source.blocks[finding["context"]["block_index"]]
            self.assertEqual(finding["context"]["body_byte_start"], block.body_span.start)
            self.assertEqual(finding["context"]["body_byte_end"], block.body_span.end)
        output, status = _validation_response(result)
        if findings:
            self.assertEqual(status, 1)
            self.assertNotIn("overall_status", output)
            self.assertNotIn("code", output["error"])
            self.assertEqual(output["partial_validation_result"]["issues"], result["issues"])
        return result, findings

    def test_inventory_covers_every_declared_base_metadata_and_leaf_field(self):
        schema = json.loads((ROOT / "spec/schemas/uwmd-block.schema.json").read_text())
        meta = schema["$defs"]["UWMeta"]["properties"]
        self.assertEqual(set(meta), {"section", "provenance", "quality", "lifecycle", "integrity"})
        self.assertEqual(set(meta["provenance"]["properties"]),
            {"source", "resolution", "actor", "agent_id", "agent_version", "timestamp", "notes",
             "market_data_ref", "inherited_from"})
        self.assertEqual(set(meta["quality"]["properties"]),
            {"confidence", "human_review_required", "flags", "partial", "provisional"})
        self.assertEqual(set(meta["lifecycle"]["properties"]), {"revision", "superseded"})
        self.assertEqual(set(meta["provenance"]["properties"]["market_data_ref"]["properties"]),
                         {"document_id", "as_of", "digest", "rationale"})
        self.assertEqual(set(meta["provenance"]["properties"]["inherited_from"]["properties"]),
                         {"document_id", "digest", "distance"})
        self.assertEqual(set(schema["properties"]["_overrides"]["items"]["properties"]),
                         {"path", "confidence", "source", "resolution", "reason", "note"})

    def test_all_base_typed_fields_refuse_without_invented_registered_routing(self):
        cases = (
            ("provenance", "timestamp", None), ("provenance", "timestamp", "not a timestamp"),
            ("provenance", "agent_id", 0), ("provenance", "agent_version", False),
            ("provenance", "notes", []), ("quality", "confidence", None),
            ("quality", "human_review_required", 0), ("quality", "flags", "flag"),
            ("quality", "flags", [False]), ("quality", "partial", None),
            ("quality", "provisional", "false"), ("lifecycle", "revision", 0),
            ("lifecycle", "revision", 1.5), ("lifecycle", "revision", True),
            ("lifecycle", "superseded", None))
        for group, key, value in cases:
            with self.subTest(group=group, key=key, value=value):
                authored = body(); authored["_meta"][group][key] = value
                result, findings = self.assess(authored)
                field = "_meta." + group + "." + key + ("[0]" if key == "flags" and isinstance(value, list) else "")
                owner = {("quality", "human_review_required"): "META-02",
                         ("lifecycle", "superseded"): "META-03",
                         ("provenance", "timestamp"): "META-04",
                         ("quality", "confidence"): "META-04",
                         ("lifecycle", "revision"): "META-04",
                         ("provenance", "agent_id"): "META-05", ("provenance", "agent_version"): "META-05",
                         ("provenance", "notes"): "META-05", ("quality", "flags"): "META-05",
                         ("quality", "partial"): "META-05", ("quality", "provisional"): "META-05"}.get((group, key))
                if owner:
                    self.assertNotIn(field, [f["field"] for f in findings])
                    self.assertEqual([(i["code"], i["severity"], i["field"]) for i in result["errors"]],
                                     [(owner, "error", field)])
                    self.assertEqual([f["registered_code"] for f in
                        result["metadata_assessment"]["handled_shape_findings"]], [owner])
                else:
                    self.assertIn(field, [f["field"] for f in findings])
                self.assertFalse(any(i["code"] == "META-01" for i in result["issues"]))
        authored = body(); authored["_meta"]["section"] = 5
        result, findings = self.assess(authored)
        self.assertEqual(findings, [])
        self.assertEqual([(i["code"], i["field"]) for i in result["errors"]],
                         [("META-01", "_meta.section")])
        authored = body(); authored["_meta"]["quality"]["field_overrides"] = []
        self.assertIn(("META-05", "_meta.quality.field_overrides"), [(i["code"], i["field"]) for i in self.assess(authored)[0]["errors"]])

    def test_optional_and_required_presence_keeps_exact_nullable_and_registered_domains(self):
        authored = body()
        authored["_meta"]["provenance"].update(agent_id=None, agent_version=None, notes=None)
        authored["_meta"]["quality"].update(flags=[], partial=False, provisional=False)
        authored["_meta"]["lifecycle"]["revision"] = 1.0
        self.assertEqual(self.assess(authored)[1], [])
        authored["_meta"]["provenance"]["source"] = "agent/extractor"
        del authored["_meta"]["provenance"]["agent_id"]
        self.assertIn(("META-06", "_meta.provenance.agent_id"), [(i["code"], i["field"]) for i in self.assess(authored)[0]["errors"]])
        for group, key, suffix in ((None, "section", "SECTION"), ("lifecycle", "revision", "VERSION"),
                ("provenance", "source", "SOURCE"), ("provenance", "timestamp", "TIMESTAMP"),
                ("quality", "confidence", "CONFIDENCE")):
            authored = body(); target = authored["_meta"] if group is None else authored["_meta"][group]
            del target[key]
            result, _ = self.assess(authored)
            self.assertIn(("META_FIELD_MISSING_" + suffix, "warning"),
                          [(i["code"], i["severity"]) for i in result["issues"]])
        for value in (OMITTED, None, "", False, 0, [], {}):
            authored = body()
            if value is OMITTED: del authored["_meta"]["provenance"]["actor"]
            else: authored["_meta"]["provenance"]["actor"] = value
            result, findings = self.assess(authored)
            self.assertEqual([(i["code"], i["severity"], i["field"]) for i in result["issues"]],
                             [("META-01", "error", "_meta.provenance.actor")])
            self.assertEqual(findings, [])
        authored = body(); authored["_meta"]["provenance"]["actor"] = " \t"
        self.assertEqual(self.assess(authored)[1], [])

    def test_promoted_block_or_leaf_uses_meta06_without_duplicate_dq06(self):
        for leaf in (False, True):
            for value in (OMITTED, None, False, 0, "", [], {}):
                with self.subTest(leaf=leaf, value=value):
                    authored = body()
                    if leaf: authored["_overrides"] = [dict(path="units", resolution="market_data_accepted")]
                    else: authored["_meta"]["provenance"]["resolution"] = "market_data_accepted"
                    if value is not OMITTED: authored["_meta"]["provenance"]["market_data_ref"] = value
                    result, findings = self.assess(authored)
                    self.assertEqual(findings, [])
                    expected = ["_meta.provenance.market_data_ref." + k for k in ("document_id", "as_of", "digest")] if value == {} and isinstance(value, dict) else ["_meta.provenance.market_data_ref"]
                    self.assertEqual([i["field"] for i in result["errors"] if i["code"] == "META-06"], expected)
                    self.assertFalse(any(i["code"] == "DQ-06" and i["severity"] == "error" for i in result["issues"]))
        authored = body(); authored["_overrides"] = [dict(path="units", resolution="market_data_accepted")]
        authored["_meta"]["provenance"]["market_data_ref"] = reference("market_data_ref")
        # The original authored vintage literal is intentionally retained and now invalid under U3.
        self.assertEqual([(i["code"], i["field"]) for i in self.assess(authored)[0]["issues"]],
                         [("META-06", "_meta.provenance.market_data_ref.as_of")])
        authored = body(); authored["_meta"]["provenance"]["resolution"] = "market_data"
        self.assertEqual(self.assess(authored)[0]["issues"], [])

    def test_both_reference_shapes_cover_each_required_member_and_optional_rationale(self):
        for kind, resolution in (("market_data_ref", "market_data_accepted"), ("inherited_from", "inherited_assumption")):
            original = reference(kind)
            for key in original:
                for bad in (OMITTED, None, False, [], {}):
                    with self.subTest(kind=kind, key=key, bad=bad):
                        authored = body(); provenance = authored["_meta"]["provenance"]
                        provenance["resolution"] = resolution; provenance[kind] = copy.deepcopy(original)
                        if bad is OMITTED: del provenance[kind][key]
                        else: provenance[kind][key] = bad
                        result, findings = self.assess(authored)
                        self.assertEqual(findings, [])
                        expected = ["_meta.provenance." + kind + "." + name for name in original
                                    if name == key or kind == "market_data_ref" and name == "as_of"]
                        self.assertEqual([i["field"] for i in result["errors"] if i["code"] == "META-06"], expected)
            authored = body(); authored["_meta"]["provenance"][kind] = original
            result, findings = self.assess(authored)
            self.assertEqual(findings, [])
            self.assertEqual([i["field"] for i in result["errors"] if i["code"] == "META-06"],
                             ["_meta.provenance.market_data_ref.as_of"] if kind == "market_data_ref" else [])
        for distance in (0, -1, .5, True, "1"):
            authored = body(); authored["_meta"]["provenance"]["inherited_from"] = {**reference("inherited_from"), "distance": distance}
            self.assertEqual([i["field"] for i in self.assess(authored)[0]["errors"]], ["_meta.provenance.inherited_from.distance"])
        for rationale in (None, False, 0, [], {}):
            authored = body(); authored["_meta"]["provenance"]["market_data_ref"] = {**reference("market_data_ref"), "rationale": rationale}
            self.assertEqual([i["field"] for i in self.assess(authored)[0]["errors"]],
                             ["_meta.provenance.market_data_ref.as_of", "_meta.provenance.market_data_ref.rationale"])
        authored = body(); authored["_meta"]["provenance"].update(
            market_data_ref={**reference("market_data_ref"), "document_id": "", "as_of": "", "rationale": ""},
            inherited_from={**reference("inherited_from"), "distance": 1.0})
        self.assertEqual([i["field"] for i in self.assess(authored)[0]["errors"]], ["_meta.provenance.market_data_ref.as_of"])

    def test_every_leaf_annotation_field_and_unknown_payload_preservation(self):
        for key, bad in (("path", None), ("confidence", "other"), ("reason", False), ("note", None)):
            authored = body(); authored["_overrides"] = [{"path": "units", key: bad}]
            self.assertIn(("META-05", "_overrides[0]." + key), [(i["code"], i["field"]) for i in self.assess(authored)[0]["errors"]])
        for key, bad, code in (("source", "system:bad", "SRC-01"),
                                ("source", "user_input", "SRC-02"), ("resolution", "manual", "SRC-03")):
            authored = body(); authored["_overrides"] = [{"path": "units", key: bad}]
            self.assertIn(code, [i["code"] for i in self.assess(authored)[0]["issues"]])
        authored = body()
        authored["_overrides"] = [dict(path="units[7].current_rent", confidence="low", source="manual",
            resolution="user_override", reason="overridden", note="", future={"opaque": None})]
        authored["_meta"]["provenance"]["future"] = {"rationale": False}
        authored["_meta"]["provenance"]["market_data_ref"] = {**reference("market_data_ref"), "future": False}
        authored["_meta"]["quality"]["future"] = [None]
        authored["_meta"]["lifecycle"]["future"] = 0
        authored["_meta"]["integrity"] = {"signature": {"unchecked": True}}
        authored["_notes"] = {"never": "validated"}
        result, findings = self.assess(authored)
        self.assertEqual(findings, [])
        self.assertEqual([(i["code"], i["severity"]) for i in result["issues"]],
                         [("META-06", "error"), ("META_LOW_CONFIDENCE_NO_REVIEW_FLAG", "info")])
        self.assertFalse(any(i["code"].startswith("INT-") for i in result["issues"]))

    def test_active_physical_peers_append_extensions_and_history_keep_distinct_scope(self):
        raw = HEADER
        for index, section in enumerate(("property", "property", "pipeline_log", "x_private", "property")):
            authored = body(); authored["_meta"]["section"] = section
            authored["_meta"]["provenance"]["resolution"] = "market_data_accepted"
            if index == 4:
                authored["_meta"]["lifecycle"]["superseded"] = True
                authored["_meta"]["provenance"]["actor"] = None
            raw += fence(authored, section)
        # Every current variant is checked, even a component that financial
        # role selection would exclude. The replaced alpha peer remains local.
        for variant in ("alpha", "alpha", "beta"):
            authored = body(); authored["_meta"]["section"] = "operating_statement"
            authored["_meta"]["provenance"]["resolution"] = "market_data_accepted"
            authored["_role"] = "component"
            raw += fence(authored, "operating_statement", " variant=" + variant)
        document = parse(raw); before = copy.deepcopy(document)
        result = validate(document)
        self.assertEqual([i["section"] for i in result["issues"]
            if (i["code"], i["severity"]) == ("META-06", "error")],
            ["property", "property", "pipeline_log", "x_private", "property", "operating_statement", "operating_statement", "operating_statement"])
        self.assertEqual([f["context"]["block_index"] for f in
            result["metadata_assessment"]["shape_findings"]], [])
        actor = [i for i in result["issues"] if i["field"] == "_meta.provenance.actor"]
        self.assertEqual([i["context"]["block_index"] for i in actor], [4])
        self.assertEqual(document, before)

    def test_registered_shape_actor_role_source_order_and_two_dq06_conditions_are_separate(self):
        authored = body(); authored["_meta"]["provenance"].update(actor=None, source="invalid",
                                                                              resolution="market_data_accepted")
        authored["_role"] = None
        raw = HEADER.replace(b"unknown_key: retained", b"deal_stage: screening") + fence(authored)
        document = parse(raw); inventory = inspect_source_roles(document)
        result = validate(document)
        self.assertEqual(result["issues"][:len(inventory["issues"])], inventory["issues"])
        dq = [(i["severity"], i["section"]) for i in result["issues"] if i["code"] == "DQ-06"]
        self.assertEqual(dq, [("info", "debt_structure"), ("info", "validation")])
        self.assertIn(("META-06", "_meta.provenance.market_data_ref"), [(i["code"], i["field"]) for i in result["issues"]])
        self.assertEqual(result["overall_status"], "errors")
        malformed = body(); malformed["_meta"]["provenance"] = None
        result = validate(parse(HEADER + fence(malformed)))
        self.assertEqual([(i["code"], i.get("field")) for i in result["errors"]], [("META-01", None)])
        result = validate(parse(HEADER + fence({"units": 12, "total_units": 12})))
        self.assertEqual([i["code"] for i in result["issues"]], ["META_MISSING"])

    def test_frozen_promoted_source_reference_and_typed_mutation_without_promotion_claim(self):
        # This source is a frozen promotion result, not a validate expected pair.
        # Its absent timestamp/confidence retain their exact completeness owners;
        # registered errors remain, without a promotion/profile claim.
        path = ROOT / "conformance/market-data/promote/explicit/deal-after-promotion.uwx.md"
        raw = path.read_bytes(); document = parse(raw); before = copy.deepcopy(document)
        original = validate(document)
        self.assertFalse(any(i["code"] == "DQ-06" and i["severity"] == "error"
                             for i in original["issues"]))
        prior = original["metadata_assessment"]["shape_findings"]
        self.assertEqual(prior, [])
        self.assertEqual([(f["field"], f["registered_code"]) for f in
            original["metadata_assessment"]["handled_shape_findings"]], [
                ("_meta.provenance.timestamp", "META_FIELD_MISSING_TIMESTAMP"),
                ("_meta.quality.confidence", "META_FIELD_MISSING_CONFIDENCE"),
                ("_meta.quality.human_review_required", "META-02")])
        self.assertEqual([(i["code"], i["field"]) for i in original["issues"]], [
            ("META-02", "_meta.quality.human_review_required"),
            ("META_FIELD_MISSING_TIMESTAMP", "_meta.provenance.timestamp"),
            ("META_FIELD_MISSING_CONFIDENCE", "_meta.quality.confidence"), ("CC-14", "")])
        self.assertFalse(any(f["field"].startswith("_meta.provenance.market_data_ref") for f in prior))
        changed = copy.deepcopy(document)
        changed.source.blocks[0].parsed.value["_meta"]["provenance"]["market_data_ref"]["rationale"] = False
        result = validate(changed)
        self.assertEqual([(i["code"], i["field"]) for i in result["issues"]],
            [(i["code"], i["field"]) for i in original["issues"][:1]] +
            [("META-06", "_meta.provenance.market_data_ref.rationale")] +
            [(i["code"], i["field"]) for i in original["issues"][1:]])
        self.assertEqual(result["metadata_assessment"]["shape_findings"], [])
        self.assertEqual(document, before)
        self.assertEqual(path.read_bytes(), raw)

    def test_actual_cli_reference_before_after_states_and_parse_only_discovery(self):
        with tempfile.TemporaryDirectory(prefix="uwmd-python-metadata-cli-") as folder:
            path = Path(folder) / "input.uwx.md"
            for kind in ("valid", "block_missing", "leaf_missing", "rationale"):
                authored = body()
                if kind == "leaf_missing":
                    authored["_overrides"] = [dict(path="units", resolution="market_data_accepted")]
                else:
                    authored["_meta"]["provenance"]["resolution"] = "market_data_accepted"
                if kind in ("valid", "rationale"):
                    authored["_meta"]["provenance"]["market_data_ref"] = reference("market_data_ref")
                if kind == "rationale":
                    authored["_meta"]["provenance"]["market_data_ref"]["rationale"] = False
                raw = HEADER + fence(authored); path.write_bytes(raw)
                completed = subprocess.run([sys.executable, "-B", str(ROOT / "implementations/python/uwmd.py"),
                    "validate", str(path), "--json"], capture_output=True, encoding="utf8", timeout=30)
                result = json.loads(completed.stdout)
                self.assertEqual(completed.stderr, "")
                self.assertEqual(path.read_bytes(), raw)
                self.assertEqual(completed.returncode, 1)
                self.assertEqual(result["overall_status"], "errors")
                self.assertNotIn("partial_validation_result", result)
                fields = [i["field"] for i in result["errors"] if i["code"] == "META-06"]
                expected = ["_meta.provenance.market_data_ref"] if kind in ("block_missing", "leaf_missing") else ["_meta.provenance.market_data_ref.as_of"]
                if kind == "rationale": expected.append("_meta.provenance.market_data_ref.rationale")
                self.assertEqual(fields, expected)
        manifest, status = main(["manifest"])
        self.assertEqual((status, manifest["capabilities"], manifest["profiles"]), (0, ["parse", "validate", "calc-evaluate"], []))


if __name__ == "__main__":
    unittest.main()
