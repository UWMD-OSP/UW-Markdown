"""Resolved SOURCE/MODEL validation and accepted read-only CLI transport."""
import asyncio
import copy
from dataclasses import replace
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import unittest

from test_composition import FIXTURES, external, fence, index_parts, load, part
from test_reader import HEADER
from test_source_metadata_optional import body
from uwmd import _validation_response
from uwmd_composition import CompositionError, parse_part, resolve_composition
from uwmd_document_sources import number_source
from uwmd_reader import parse
from uwmd_source_validation import _inspect_source_roles
from uwmd_validation import _validate_source, validate_document

CLI = Path(__file__).with_name("uwmd.py")


def typed(section, **values):
    value = body(); value["_meta"]["section"] = section; value.update(values)
    return value


def assess(root, *parts):
    return asyncio.run(_validate_source(root.source.raw, parts=[p.source.raw for p in parts]))


def errors(result):
    return [i for i in result["errors"] if i["code"].startswith("META-")]


class ValidationCompositionTests(unittest.TestCase):
    def cli(self, *arguments):
        completed = subprocess.run([sys.executable, "-B", str(CLI), *map(str, arguments)],
            capture_output=True, text=True, encoding="utf8", timeout=20)
        self.assertEqual(completed.stderr, "")
        return completed.returncode, json.loads(completed.stdout)

    def test_whole_current_financial_view_and_caller_sources_are_unchanged(self):
        root = parse(external(["whole"], collection=False).source.raw.replace(b"rent_roll", b"property"))
        supplied = part("whole", typed("property", address="123 Main", asset_class="multifamily", units=4), section="property", collection=False)
        before = copy.deepcopy((root, supplied)); result = assess(root, supplied)
        response, exit_code = _validation_response(result)
        self.assertEqual(exit_code, 0); self.assertNotIn("error", response)
        self.assertTrue(result["stage_readiness"]["scope"])
        self.assertEqual(result["composition_assessment"], dict(status="resolved", externalized=["property"], issues=[]))
        self.assertEqual((root,supplied), before); self.assertEqual(errors(result), [])

    def test_source_lexical_numeric_first_is_not_replayed_as_model_order(self):
        root = external(["whole"], collection=False)
        supplied = part("whole", {"0": 0, **typed("rent_roll", units=[])}, collection=False)
        result = assess(root, supplied)
        self.assertEqual([(i["field"], i["context"]["source_index"]) for i in errors(result)], [("_meta",1)])
        model = resolve_composition(root, index_parts([supplied])).document
        self.assertEqual(errors(asyncio.run(validate_document(model))), [])
        model._retained_sources[1].blocks[0].parsed.value["_meta"]["provenance"]["actor"] = ""
        self.assertEqual([i["field"] for i in errors(asyncio.run(validate_document(model)))],
                         ["_meta.provenance.actor", "_meta.provenance.actor"])
        self.assertNotIn("_retained_sources", json.dumps(model.projection()))

    def test_collection_meta_survives_row_projection_and_unused_sources_are_excluded(self):
        root = external(["used"]); value = typed("rent_roll", unit_id="a", rent=100)
        value["_meta"]["quality"]["flags"] = [False]
        value["_meta"]["provenance"]["market_data_ref"] = dict(document_id="a", as_of="2025-02-29", digest="sha256:"+"a"*64)
        used = part("used", value); unused_value = typed("rent_roll", unit_id="unused")
        unused_value["_meta"]["provenance"]["actor"] = None
        unused = part("unused", unused_value); result = assess(root,used,unused)
        self.assertEqual([(i["code"],i["field"],i["context"]["source_index"]) for i in errors(result)],
            [("META-05","_meta.quality.flags[0]",1),("META-06","_meta.provenance.market_data_ref.as_of",1)])
        self.assertEqual(result["metadata_assessment"]["shape_findings"], [])
        model = resolve_composition(root,index_parts([used,unused])).document
        self.assertEqual(len(model._retained_sources),2)
        self.assertNotIn("_meta",model.source.blocks[0].parsed.value["units"][0])
        self.assertNotIn("unused",json.dumps(model.projection()))

    def test_ordinary_src_role_use_assembled_current_sections_variants_only(self):
        root = external(["whole"],collection=False)
        root.source.blocks[0].parsed.value["_meta"]["provenance"]["source"] = "bad-root"
        value = typed("rent_roll",units=[]); value["_meta"]["provenance"]["source"] = "bad-part"; value["_role"] = "bad-role"
        model = resolve_composition(root,index_parts([part("whole",value,collection=False)])).document
        self.assertEqual(len([i for i in _inspect_source_roles(model)["issues"] if i["code"]=="SRC-01"]),3)
        result = asyncio.run(validate_document(model))
        ordinary = [i for i in result["issues"] if i["code"].startswith(("SRC-","ROLE-"))]
        self.assertEqual([i["code"] for i in ordinary],["ROLE-01","SRC-01"])
        self.assertTrue(all(i["context"]["model_only"] for i in ordinary))
        extension = typed("x_kept"); extension["_role"] = "bad-role"
        current = replace(model,source=replace(model.source,blocks=model.source.blocks+parse(HEADER+fence("x_kept",extension)).source.blocks))
        self.assertEqual([i["code"] for i in asyncio.run(validate_document(current))["issues"]
            if i["code"].startswith(("SRC-","ROLE-"))],["ROLE-01","SRC-01","ROLE-01"])

    def test_history_metadata_and_history_only_typed_refusal(self):
        historical = typed("rent_roll",units=[]); historical["_meta"]["lifecycle"]["superseded"] = True
        historical["_meta"]["provenance"]["actor"] = ""
        supplied = part("whole",typed("rent_roll",units=[]),collection=False)
        supplied = parse(supplied.source.raw+fence("rent_roll",historical))
        result = assess(external(["whole"],collection=False),supplied)
        self.assertEqual([(i["field"],i["context"]["source_index"]) for i in errors(result)],[("_meta.provenance.actor",1)])
        with self.assertRaises(CompositionError) as caught: parse_part(part("history",historical))
        self.assertEqual(caught.exception.code,"COMP-PART-MALFORMED")

    def test_numeric_token_points_to_exact_part_bytes_and_survives_snapshot(self):
        supplied = part("a",typed("rent_roll",unit_id="a",rent=123456.789))
        supplied = parse(supplied.source.raw.replace(b"123456.789",b"1.2345678900e5"))
        model = resolve_composition(external(["a"]),index_parts([supplied])).document
        token = next(t for t in model.source.blocks[0].parsed.numbers if t.pointer=="/units/0/rent")
        self.assertIs(number_source(model,token),model._retained_sources[1])
        self.assertEqual(token.span.extract(number_source(model,token).raw),b"1.2345678900e5")
        self.assertNotEqual(token.span.extract(model.source.raw),b"1.2345678900e5")
        self.assertEqual(token.lexeme,"1.2345678900e5")
        copied = copy.deepcopy(model); copied_token = next(t for t in copied.source.blocks[0].parsed.numbers if t.pointer==token.pointer)
        self.assertEqual(copied_token.span.extract(number_source(copied,copied_token).raw),b"1.2345678900e5")
        self.assertIsNone(number_source(model,copy.deepcopy(token)))
        whole = resolve_composition(external(["a"],collection=False),index_parts([part("a",typed("rent_roll",total=1),collection=False)])).document
        whole_token = next(t for t in whole.source.blocks[0].parsed.numbers if t.pointer=="/total")
        self.assertIs(number_source(whole,whole_token),whole._retained_sources[1])

    def test_frozen_resolved_validation_allphysical_meta_and_current_warning_population(self):
        for name in ("inline-vs-external","collection-order"):
            root,parts = load(FIXTURES/"resolve"/name)
            result = assess(root,*(p.document for p in parts.values()))
            self.assertEqual(result["composition_assessment"]["status"],"resolved")
            self.assertEqual([i["context"]["block_index"] for i in errors(result)],[0,1,2,3,4])
            self.assertEqual({i["code"] for i in errors(result)},{"META-02"})
            self.assertEqual(result["metadata_assessment"]["shape_findings"],[])
            self.assertEqual([i["code"] for i in result["warnings"] if i["code"].startswith("META_FIELD_")],
                             ["META_FIELD_MISSING_TIMESTAMP","META_FIELD_MISSING_CONFIDENCE"])
            response,exit_code = _validation_response(result)
            self.assertEqual(exit_code,1); self.assertNotIn("partial_validation_result",response)

    def test_actual_cli_default_explicit_read_only_and_parse_only_discovery(self):
        folder = FIXTURES/"resolve/inline-vs-external"
        retained = {p:hashlib.sha256(p.read_bytes()).hexdigest() for p in folder.rglob("*") if p.is_file()}
        expected = dict(status="resolved",externalized=["rent_roll"],parts_available=3,issues=[])
        for flags in (("--json",),("--parts",folder/"parts","--json"),("--parts="+str(folder/"parts"),"--json")):
            self.assertEqual(self.cli("resolve",folder/"record.uwx.md",*flags),(0,expected))
        self.assertEqual({p:hashlib.sha256(p.read_bytes()).hexdigest() for p in retained},retained)
        manifest = self.cli("manifest")[1]
        self.assertEqual((manifest["capabilities"],manifest["profiles"]),(["parse", "validate", "calc-evaluate"],[]))

    def test_actual_cli_existing_refusals_and_closed_validate_flags(self):
        for group,name,code in (("unresolved","missing-part","COMP-UNRESOLVED"),("reject","count-mismatch","COMP-COUNT-MISMATCH"),
                ("reject","part-malformed","COMP-PART-MALFORMED"),("reject","section-mismatch","COMP-SECTION-MISMATCH")):
            exit_code,response = self.cli("resolve",FIXTURES/group/name/"record.uwx.md","--json")
            self.assertEqual(exit_code,1)
            error = response.get("error") or response["issues"][0]
            self.assertEqual((error["category"],error["code"]),("validate",code))
        valid = FIXTURES/"resolve/inline-vs-external/record.uwx.md"
        for args in (("resolve",valid),("resolve",valid,"--json","--output","out.uwx.md"),
                     ("validate",valid,"--resolved","--json"),("validate",valid,"--parts","parts","--json")):
            exit_code,response = self.cli(*args)
            self.assertEqual(exit_code,1); self.assertNotIn("code",response["error"])
        self.assertEqual(self.cli("resolve",valid.with_name("nonexistent.uwx.md"),"--json")[0],2)

    def test_missing_part_never_assembles_a_smaller_collection(self):
        root = external(["present","missing"]); supplied = part("present",typed("rent_roll",unit_id="a",rent=1))
        result = assess(root,supplied); response,exit_code = _validation_response(result)
        self.assertEqual(result["composition_assessment"]["status"],"unresolved")
        self.assertEqual((exit_code,response["error"]["code"]),(1,"COMP-UNRESOLVED"))
        model = resolve_composition(root,index_parts([supplied])).document
        self.assertNotIn("units",model.source.blocks[0].parsed.value); self.assertEqual(len(model._retained_sources),1)
        self.assertEqual(asyncio.run(_validate_source(root.source.raw))["composition_assessment"]["status"],"unresolved")


if __name__ == "__main__":
    unittest.main()
