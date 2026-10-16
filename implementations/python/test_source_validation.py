"""Independent source/role inventory evidence; not full validate conformance."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest

from test_reader import HEADER
from uwmd import main
from uwmd_reader import parse
from uwmd_source_validation import BLOCK_ROLES, RESOLUTION_TAGS, inspect_source_roles, source_code

ROOT = Path(__file__).resolve().parents[2]
OMITTED = object()


def fence(body, *, section="property", variant=None, superseded=False):
    attributes="```json uw:section="+section+(" variant="+variant if variant is not None else "")
    if superseded:attributes+=" superseded=true"
    return (attributes+"\n"+json.dumps(body,ensure_ascii=True)+"\n```\n").encode()


def payload(**extra):
    value={"_meta":{"section":"property","provenance":{"source":"manual","actor":"tester",
        "timestamp":"2026-01-01T00:00:00Z"},"quality":{"confidence":"high","human_review_required":False},
        "lifecycle":{"revision":1,"superseded":False}},"value":1}
    value.update(extra)
    return value


def inspect(body):
    return inspect_source_roles(parse(HEADER+fence(body)))


def codes(result):
    return [issue["code"] for issue in result["issues"]]


class SourceValidationTests(unittest.TestCase):
    def test_nine_actual_standalone_frozen_scoped_comparisons(self):
        spec=importlib.util.spec_from_file_location("source_shared",ROOT/"conformance/runner/runner.py")
        driver=importlib.util.module_from_spec(spec);spec.loader.exec_module(driver)
        fixtures=[]
        for name in ("01-actor-and-resolution","02-legacy-tag-in-source","04-colon-form-rejected"):
            folder=ROOT/"conformance/source"/name
            expected=json.loads((folder/"expected.json").read_text())
            fixtures.append((folder/"deal.uwx.md",expected["src_codes"]))
        for name in ("20-flat-meta","21-section-id-wrapper","22-resolution-outside-vocabulary"):
            folder=ROOT/"conformance/documents/malformed"
            expected=json.loads((folder/(name+".expected.json")).read_text())
            fixtures.append((folder/(name+".uwx.md"),expected["expected_codes"]))
        for name in ("10-declared-roles","11-role-collision","12-role-eligibility"):
            folder=ROOT/"conformance/documents"
            expected=json.loads((folder/"expected"/(name+".validation.json")).read_text())
            fixtures.append((folder/"fixtures"/(name+".uwx.md"),
                sorted({i["code"] for i in expected["issues"] if i["code"].startswith("ROLE-")})))
        self.assertEqual(len(fixtures),9)
        for path,want in fixtures:
            with self.subTest(fixture=path):
                raw=path.read_bytes()
                process=subprocess.run([sys.executable,"-B",str(ROOT/"implementations/python/uwmd.py"),
                    "inspect-source-roles",str(path),"--json"],capture_output=True,text=True,timeout=60)
                actual=json.loads(process.stdout)
                # Explicit test-only scoped projection. Frozen validate outputs
                # contain unrelated findings; no portable case/flag is changed.
                projected=dict(codes=sorted(set(codes(actual))))
                self.assertEqual(driver.json_subset(dict(codes=sorted(want)),projected),[])
                self.assertEqual(process.returncode,0 if actual["ok"] else 1)
                self.assertEqual(path.read_bytes(),raw)
                self.assertNotIn("overall_status",actual)
        manifest=main(["manifest"])[0]
        self.assertEqual((manifest["capabilities"],manifest["profiles"]),(["parse"],[]))
        for command in ("validate","calc","verify"):
            self.assertNotEqual(main([command,"unused"])[1],0)

    def test_exact_actor_namespaces_and_ascii_identifier_grammar(self):
        valid=["manual","agent/A","document/om.pdf","system/calculations.ts","institution/threshold-override",
               "agent/a_B-1.2","document/0"]
        for value in valid:
            with self.subTest(source=value):self.assertIsNone(source_code(value))
        for value in ("manual "," manual","MANUAL","agent:A","agent/","agent/.id","agent/_id",
                      "vendor/A","agent/a/b","agent/a b","agent/é","agent/A\n",None,True,1,[],{}):
            with self.subTest(source=value):self.assertEqual(source_code(value),"SRC-01")

    def test_resolution_tags_in_actor_never_move_or_alias(self):
        for tag in RESOLUTION_TAGS:
            with self.subTest(tag=tag):
                value=payload();value["_meta"]["provenance"]["source"]=tag
                before=copy.deepcopy(value);result=inspect(value)
                self.assertEqual(codes(result),["SRC-02"])
                self.assertEqual(result["blocks"][0]["source"],tag)
                self.assertNotIn("resolution",result["blocks"][0])
                self.assertEqual(value,before)
        self.assertIsNone(source_code("manual"))

    def test_resolution_is_closed_optional_and_authored_null_is_invalid(self):
        for tag in RESOLUTION_TAGS:
            value=payload();value["_meta"]["provenance"]["resolution"]=tag
            self.assertNotIn("SRC-03",codes(inspect(value)))
        for tag in (None,"manual","ai_extracted ","new_method",False,[],{}):
            with self.subTest(resolution=tag):
                value=payload();value["_meta"]["provenance"]["resolution"]=tag
                self.assertEqual(codes(inspect(value)),["SRC-03"])
        self.assertNotIn("resolution",inspect(payload())["blocks"][0])

    def test_all_active_physical_blocks_even_when_reader_exposes_last(self):
        bad=payload();bad["_meta"]["provenance"]["source"]="agent:bad";bad["_role"]=[]
        good=payload()
        document=parse(HEADER+fence(bad)+fence(good))
        self.assertEqual(document.projection()["sections"]["property"]["meta"]["provenance"]["source"],"manual")
        result=inspect_source_roles(document)
        self.assertEqual(result["blocks_checked"],2)
        self.assertEqual(set(codes(result)),{"SRC-01","ROLE-01"})
        self.assertEqual({i["context"]["block_index"] for i in result["issues"]},{0})
        self.assertLess(result["blocks"][0]["body_byte_start"],result["blocks"][1]["body_byte_start"])

    def test_valid_roles_unknown_sections_and_meta_role_not_an_alias(self):
        for role in BLOCK_ROLES:
            value=payload(_role=role)
            document=parse(HEADER+fence(value,section="property",variant="named"))
            self.assertNotIn("ROLE-01",codes(inspect_source_roles(document)))
        for role in (None,False,1,[],{},"Primary","primary "):
            self.assertEqual(codes(inspect(payload(_role=role))),["ROLE-01"])
        value=payload();value["_meta"]["role"]="invalid-but-not-an-alias"
        self.assertNotIn("ROLE-01",codes(inspect(value)))
        value=payload(_role="unknown");value["_meta"]["section"]="x_private"
        result=inspect_source_roles(parse(HEADER+fence(value,section="x_private")))
        self.assertEqual(codes(result),["ROLE-01"])

    def test_superseded_roles_and_provenance_are_explicitly_outside_active_scope(self):
        invalid=payload(_role=None);invalid["_meta"]["provenance"]["source"]="old_uninterpreted_source"
        for metadata_flag,fence_flag in ((True,False),(False,True)):
            with self.subTest(metadata_flag=metadata_flag,fence_flag=fence_flag):
                old=copy.deepcopy(invalid);old["_meta"]["lifecycle"]["superseded"]=metadata_flag
                document=parse(HEADER+fence(old,superseded=fence_flag)+fence(payload()))
                before=copy.deepcopy(document);result=inspect_source_roles(document)
                self.assertEqual((result["blocks_checked"],result["history_blocks_skipped"]),(1,1))
                self.assertEqual(result["issues"],[])
                self.assertEqual(document,before)

    def test_leaf_source_and_resolution_findings_keep_exact_entry_addresses(self):
        overrides=[{"path":"units[7].rent","source":"user_input","resolution":"manual"},
                   {"path":"other","source":"agent:bad"},
                   {"path":"good","source":"document/a.pdf","resolution":"ai_extracted"}]
        value=payload(_overrides=overrides);result=inspect(value)
        self.assertEqual([(i["code"],i["field"]) for i in result["issues"]],
            [("SRC-02","_overrides[0].source"),("SRC-03","_overrides[0].resolution"),
             ("SRC-01","_overrides[1].source")])
        self.assertEqual(result["blocks"][0]["overrides_checked"],3)
        self.assertEqual(result["shape_findings"],[])
        self.assertEqual(value["_overrides"],overrides)

    def test_leaf_schema_shape_diagnostics_never_invent_codes_or_path_lookup(self):
        for value in (None,{},"wrong",1):
            result=inspect(payload(_overrides=value))
            self.assertEqual(result["issues"],[])
            self.assertFalse(result["ok"])
            self.assertTrue(result["shape_findings"])
            self.assertTrue(all("code" not in f and "severity" not in f for f in result["shape_findings"]))
        overrides=[None,{}, {"path":5,"confidence":"uncertain","reason":"new_reason","note":None},
                   {"path":"not_a_real_target[999]","unknown_member":{"retained":True}}]
        result=inspect(payload(_overrides=overrides))
        self.assertEqual(result["issues"],[])
        self.assertEqual(result["blocks"][0]["overrides_checked"],4)
        self.assertFalse(any(f["field"].startswith("_overrides[3]") for f in result["shape_findings"]))
        # No new minimum length/path grammar is invented beyond the schema's string.
        self.assertTrue(inspect(payload(_overrides=[{"path":""}]))["ok"])

    def test_meta_routing_shape_is_pinned_and_flat_source_is_not_interpreted(self):
        for value in ({"value":1},{"_meta":None},{"_meta":{"source":"market_data","section":"property"}},
                      payload(section_id="property")):
            self.assertIn("META-01",codes(inspect(value)))
            self.assertNotIn("SRC-02",codes(inspect(value)))
        value=payload();value["_meta"]["section"]="wrong"
        self.assertEqual(codes(inspect(value)),["META-01"])
        proper=payload();late={"value":1,"_meta":proper["_meta"]}
        self.assertEqual(codes(inspect(late)),["META-01"])

    def test_selected_provenance_shape_stays_local_and_has_no_legacy_fallback(self):
        value=payload();value["_meta"]["provenance"]={"source":"agent/A","actor":0,"timestamp":False}
        value["_meta"]["quality"].update(field_overrides=[{"source":"market_data"}],confidence="unknown")
        value["_meta"]["lifecycle"].update(revision=True)
        result=inspect(value)
        self.assertEqual(result["issues"],[])
        paths={f["field"] for f in result["shape_findings"]}
        self.assertTrue({"_meta.provenance.agent_id","_meta.provenance.actor","_meta.provenance.timestamp",
                         "_meta.quality.field_overrides","_meta.quality.confidence","_meta.lifecycle.revision"}<=paths)
        self.assertFalse(any("code" in f or "severity" in f for f in result["shape_findings"]))
        value=payload();value["_meta"]["provenance"]["source"]="agent/A";value["_meta"]["provenance"]["agent_id"]=None
        value["_meta"]["lifecycle"]["revision"]=1.0
        self.assertTrue(inspect(value)["ok"])

    def test_unknown_payload_and_returned_evidence_do_not_mutate_inputs(self):
        value=payload(content={"source":"not_provenance","_role":"invalid_payload","resolution":"manual"},
                      unknown={"deep":[1,2,{"_overrides":"ordinary payload"}]})
        document=parse(HEADER+fence(value));before=copy.deepcopy(document)
        result=inspect_source_roles(document)
        self.assertTrue(result["ok"])
        self.assertEqual(document,before)
        result["blocks"][0]["source"]="mutated"
        self.assertEqual(inspect_source_roles(document)["blocks"][0]["source"],"manual")
        self.assertEqual(document.source.raw,before.source.raw)
        self.assertEqual(document.projection(),before.projection())


if __name__=="__main__":unittest.main()
