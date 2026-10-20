"""Closed RFC0095 predicates and actual SOURCE/MODEL source-inventory controls."""
import copy
from dataclasses import replace
import hashlib
import json
from pathlib import Path
import unittest

from test_reader import HEADER
from uwmd_reader import parse
from uwmd_source_validation import inspect_source_roles, _inspect_source_roles_source

ROOT = Path(__file__).resolve().parents[2]
VECTORS = ROOT / "docs/reviews/2026-10-17-validation-diagnostic-gap-354.0095-date-only.vectors.json"
DIGEST = "sha256:" + "a" * 64


def body():
    return {"_meta": {"section": "x_optional", "provenance": {"source": "manual", "actor": "author",
        "timestamp": "2026-01-01T00:00:00Z"}, "quality": {"confidence": "high", "human_review_required": False},
        "lifecycle": {"revision": 1, "superseded": False}}, "value": 1}


def fence(value, section="x_optional", annotation=""):
    return ("```json uw:section=" + section + annotation + "\n" + json.dumps(value, ensure_ascii=True) + "\n```\n").encode()


def rows(result, prefix="META-"):
    return [(i["code"], i["field"]) for i in result["issues"] if i["code"].startswith(prefix)]


class OptionalMetadataSourceTests(unittest.TestCase):
    def assess(self, value):
        raw = HEADER + fence(value); document = parse(raw); before = copy.deepcopy(document)
        result = inspect_source_roles(document)
        self.assertEqual(document, before)
        self.assertEqual(document.source.raw, raw)
        return result

    def test_shared_frozen_date_vectors_through_actual_carrier_admission(self):
        raw = VECTORS.read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "f8d3ebc4aef8b0992edf2a333cc53fa2325b869c680ba990158225f18c6e7400")
        vectors = json.loads(raw)
        self.assertEqual(len(vectors["date_cases"]), 106)
        for case in vectors["date_cases"]:
            with self.subTest(id=case["id"]):
                value = body(); value["_meta"]["provenance"]["market_data_ref"] = dict(document_id="", as_of=case["input"], digest=DIGEST)
                self.assertEqual(rows(self.assess(value), "META-06"), [] if case["admitted"] else
                                 [("META-06", "_meta.provenance.market_data_ref.as_of")])
        for case in vectors["required_as_of_carriers"]:
            value = body(); value["_meta"]["provenance"]["market_data_ref"] = dict(document_id="", digest=DIGEST, **case["input"])
            self.assertEqual(rows(self.assess(value), "META-06"), [] if case["admitted"] else
                             [("META-06", "_meta.provenance.market_data_ref.as_of")])
        self.assertEqual(VECTORS.read_bytes(), raw)

    def test_exact_optional_order_indexed_flags_and_override_members(self):
        value = body(); value["_meta"]["provenance"].update(agent_id=False, agent_version=[], notes={})
        value["_meta"]["quality"].update(flags=["", False, 1], partial=None, provisional="yes", field_overrides=None)
        value["_overrides"] = [None, dict(path=False, confidence=None, reason="other", note=0)]
        self.assertEqual(rows(self.assess(value)), [("META-05", field) for field in (
            "_meta.provenance.agent_id", "_meta.provenance.agent_version", "_meta.provenance.notes",
            "_meta.quality.flags[1]", "_meta.quality.flags[2]", "_meta.quality.partial", "_meta.quality.provisional",
            "_meta.quality.field_overrides", "_overrides[0]", "_overrides[1].path", "_overrides[1].confidence",
            "_overrides[1].reason", "_overrides[1].note")])

    def test_admitted_optional_null_empty_unknown_and_duplicate_paths(self):
        value = body(); value["_meta"]["provenance"].update(agent_id=None, agent_version="", notes=None)
        value["_meta"]["quality"].update(flags=["", "unknown", "unknown"], partial=False, provisional=True)
        value["_overrides"] = [dict(path="", unknown={}), dict(path="", confidence="low", reason="computed", note="")]
        value["_notes"] = {"never": [None, False]}; value["unknown"] = {"retained": True}
        self.assertEqual(rows(self.assess(value)), [])

    def test_sibling_overrides_parent_suppression_and_independent_quality(self):
        for value in ({"_overrides": [None]}, {"_meta": None, "_overrides": [None]},
                      {"_meta": {"provenance": []}, "_overrides": [None]}):
            self.assertEqual(rows(self.assess(value), "META-05"), [("META-05", "_overrides[0]")])
            self.assertEqual(rows(self.assess(value), "META-06"), [])
        value = body(); value["_meta"]["quality"] = None
        value["_meta"]["provenance"].update(agent_version=False, resolution="inherited_assumption")
        self.assertEqual(rows(self.assess(value)), [("META-01", "_meta.quality"),
            ("META-05", "_meta.provenance.agent_version"), ("META-06", "_meta.provenance.inherited_from")])

    def test_symmetric_all_stated_assertions_ignore_shadowing_and_bad_paths(self):
        value = body(); value["_overrides"] = [None, dict(resolution="inherited_assumption"),
            dict(path="same", resolution="market_data_accepted"), dict(path="same", resolution="user_input"),
            dict(path="same", resolution="inherited_assumption"), dict(path="same", resolution="market_data_accepted")]
        result = self.assess(value)
        self.assertEqual(rows(result, "META-06"), [("META-06", "_meta.provenance.inherited_from"),
                                                  ("META-06", "_meta.provenance.market_data_ref")])
        self.assertEqual(rows(result, "META-05"), [("META-05", "_overrides[0]"), ("META-05", "_overrides[1].path")])
        value["_overrides"] = [dict(path="p", resolution=["inherited_assumption"])]
        self.assertEqual(rows(self.assess(value), "META-06"), [])

    def test_agent_presence_valid_grammar_not_prefix_and_present_null(self):
        for source, expected in (("agent/extractor", True), ("agent/", False), (" agent/a", False), ("agent/a/b", False), ("manual", False)):
            value = body(); value["_meta"]["provenance"]["source"] = source
            self.assertEqual(rows(self.assess(value), "META-06"), [("META-06", "_meta.provenance.agent_id")] if expected else [])
        for agent in (None, ""):
            value = body(); value["_meta"]["provenance"].update(source="agent/a", agent_id=agent)
            self.assertEqual(rows(self.assess(value)), [])
        value["_meta"]["provenance"]["agent_id"] = False
        self.assertEqual(rows(self.assess(value)), [("META-05", "_meta.provenance.agent_id")])

    def test_reference_carriers_children_digest_distance_and_unknown_members(self):
        for carrier in (None, False, 0, "", [], [dict(document_id="d")]):
            value = body(); value["_meta"]["provenance"]["inherited_from"] = carrier
            self.assertEqual(rows(self.assess(value)), [("META-06", "_meta.provenance.inherited_from")])
        value = body(); value["_meta"]["provenance"].update(inherited_from={}, market_data_ref={})
        self.assertEqual(rows(self.assess(value)), [("META-06", "_meta.provenance." + path) for path in
            ("inherited_from.document_id", "inherited_from.digest", "inherited_from.distance", "market_data_ref.document_id", "market_data_ref.as_of", "market_data_ref.digest")])
        for distance in (1, 1.0, 9007199254740992, 1e100):
            value = body(); value["_meta"]["provenance"]["inherited_from"] = dict(document_id="", digest=DIGEST, distance=distance, unknown=True)
            self.assertEqual(rows(self.assess(value)), [])
        for distance in (True, None, 0, .5, "1"):
            value["_meta"]["provenance"]["inherited_from"]["distance"] = distance
            self.assertEqual(rows(self.assess(value)), [("META-06", "_meta.provenance.inherited_from.distance")])
        for digest in (DIGEST + "\n", DIGEST.upper(), "sha256:" + "a" * 63, None, False):
            value = body(); value["_meta"]["provenance"]["market_data_ref"] = dict(document_id="", as_of="2026-01-01", digest=digest, rationale="")
            self.assertEqual(rows(self.assess(value)), [("META-06", "_meta.provenance.market_data_ref.digest")])

    def test_complete_passes_retained_history_identity_and_current_model(self):
        value = body(); value["_meta"]["provenance"]["resolution"] = "inherited_assumption"
        value["_meta"]["quality"]["partial"] = "bad"
        historical = copy.deepcopy(value); historical["_meta"]["lifecycle"]["superseded"] = True
        raw = HEADER + fence(value) + fence(historical) + fence(value, annotation=" variant=peer")
        document = parse(raw); result = inspect_source_roles(document)
        self.assertEqual([i["code"] for i in result["issues"]], ["META-05"]*3 + ["META-06"]*3)
        self.assertEqual([i["context"]["block_index"] for i in result["issues"]], [0,1,2,0,1,2])
        for block in document.source.blocks:
            block.parsed.value["_meta"]["quality"]["partial"] = False
            block.parsed.value["_meta"]["provenance"].pop("resolution")
        self.assertEqual(rows(inspect_source_roles(document)), [])
        self.assertEqual(len(rows(_inspect_source_roles_source(raw))), 6)
        self.assertEqual(document.source.raw, raw)

    def test_model_inherited_attributes_are_not_own_reference_members_or_assertions(self):
        class PrototypeReference(dict):
            document_id = "prototype"
            digest = DIGEST
            distance = 1
        class PrototypeOverride(dict):
            resolution = "inherited_assumption"
            path = "prototype"
        value = body(); document = parse(HEADER + fence(value))
        payload = document.source.blocks[0].parsed.value
        payload["_overrides"] = [PrototypeOverride()]
        self.assertEqual(rows(inspect_source_roles(document)), [("META-05", "_overrides[0].path")])
        payload["_overrides"] = []
        payload["_meta"]["provenance"]["inherited_from"] = PrototypeReference()
        self.assertEqual(rows(inspect_source_roles(document)), [("META-06", "_meta.provenance.inherited_from." + field)
                                                               for field in ("document_id", "digest", "distance")])

    def test_exact_reference_identity_dedup_is_not_value_equality(self):
        value = body(); value["_meta"]["quality"]["partial"] = "bad"
        document = parse(HEADER + fence(value) + fence(value))
        repeated = replace(document, source=replace(document.source,
            blocks=(*document.source.blocks, document.source.blocks[0])))
        result = inspect_source_roles(repeated)
        self.assertEqual([i["context"]["block_index"] for i in result["issues"]], [0, 1])

    def test_old_metadata_passes_and_source_checks_keep_independent_order(self):
        value = body(); value["_meta"]["provenance"].update(actor="", source="invalid", notes=False, resolution="inherited_assumption")
        value["_meta"]["quality"].update(confidence="bad", human_review_required=None)
        value["_role"] = None
        self.assertEqual([i["code"] for i in self.assess(value)["issues"]],
                         ["META-01", "META-02", "META-04", "META-05", "META-06", "ROLE-01", "SRC-01"])


if __name__ == "__main__":
    unittest.main()
