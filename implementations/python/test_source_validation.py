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
    def test_nine_actual_standalone_scoped_comparisons_with_candidate_actor_delta(self):
        spec=importlib.util.spec_from_file_location("source_shared",ROOT/"conformance/runner/runner.py")
        driver=importlib.util.module_from_spec(spec);spec.loader.exec_module(driver)
        fixtures=[]
        for name in ("01-actor-and-resolution","02-legacy-tag-in-source","04-colon-form-rejected"):
            folder=ROOT/"conformance/source"/name
            expected=json.loads((folder/"expected.json").read_text())
            fixtures.append((folder/"deal.uwx.md",expected["src_codes"],0))
        for name in ("20-flat-meta","21-section-id-wrapper","22-resolution-outside-vocabulary"):
            folder=ROOT/"conformance/documents/malformed"
            expected=json.loads((folder/(name+".expected.json")).read_text())
            fixtures.append((folder/(name+".uwx.md"),expected["expected_codes"],0))
        for name in ("10-declared-roles","11-role-collision","12-role-eligibility"):
            folder=ROOT/"conformance/documents"
            expected=json.loads((folder/"expected"/(name+".validation.json")).read_text())
            fixtures.append((folder/"fixtures"/(name+".uwx.md"),
                sorted({i["code"] for i in expected["issues"] if i["code"].startswith("ROLE-")}),
                {"10-declared-roles":11,"11-role-collision":8,"12-role-eligibility":8}[name]))
        self.assertEqual(len(fixtures),9)
        for path,want,actor_delta in fixtures:
            with self.subTest(fixture=path):
                raw=path.read_bytes()
                process=subprocess.run([sys.executable,"-B",str(ROOT/"implementations/python/uwmd.py"),
                    "inspect-source-roles",str(path),"--json"],capture_output=True,text=True,timeout=60)
                actual=json.loads(process.stdout)
                # Explicit test-only scoped projection. Frozen validate outputs
                # contain unrelated findings; no portable case/flag is changed.
                actor_issues=[i for i in actual["issues"] if i["field"]=="_meta.provenance.actor"]
                self.assertEqual(len(actor_issues),actor_delta)
                if actor_delta:
                    want=sorted(set(want)|{"META-01"})
                # This explicit owner-approved candidate delta does not rewrite
                # the frozen prelaunch assertions or claim unchanged conformance.
                projected=dict(codes=sorted(set(codes(actual))))
                self.assertEqual(driver.json_subset(dict(codes=sorted(want)),projected),[])
                self.assertEqual(process.returncode,0 if actual["ok"] else 1)
                self.assertEqual(path.read_bytes(),raw)
                self.assertNotIn("overall_status",actual)
        manifest=main(["manifest"])[0]
        self.assertEqual((manifest["capabilities"],manifest["profiles"]),(["parse", "calc-evaluate", "validate", "verify-reserve-accounts", "verify-reserve-draws"],[]))
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

    def test_closed_override_diagnostics_keep_local_evidence_without_path_lookup(self):
        for value in (None,{},"wrong",1):
            result=inspect(payload(_overrides=value))
            self.assertEqual([(i["code"], i["field"]) for i in result["issues"]], [("META-05", "_overrides")])
            self.assertFalse(result["ok"])
            self.assertTrue(result["shape_findings"])
            self.assertTrue(all("code" not in f and "severity" not in f for f in result["shape_findings"]))
        overrides=[None,{}, {"path":5,"confidence":"uncertain","reason":"new_reason","note":None},
                   {"path":"not_a_real_target[999]","unknown_member":{"retained":True}}]
        result=inspect(payload(_overrides=overrides))
        self.assertEqual([(i["code"], i["field"]) for i in result["issues"]], [("META-05", field) for field in
            ("_overrides[0]", "_overrides[1].path", "_overrides[2].path", "_overrides[2].confidence", "_overrides[2].reason", "_overrides[2].note")])
        self.assertEqual(result["blocks"][0]["overrides_checked"],4)
        self.assertFalse(any(f["field"].startswith("_overrides[3]") for f in result["shape_findings"]))
        # No new minimum length/path grammar is invented beyond the schema's string.
        self.assertTrue(inspect(payload(_overrides=[{"path":""}]))["ok"])

    def test_meta_routing_shape_is_pinned_and_flat_source_is_not_interpreted(self):
        missing=inspect({"value":1})
        self.assertEqual(missing["issues"],[])
        self.assertFalse(missing["ok"])
        self.assertEqual([f["field"] for f in missing["shape_findings"]],["_meta"])
        self.assertTrue(all("code" not in f and "severity" not in f for f in missing["shape_findings"]))
        for value in ({"_meta":None},{"_meta":{"source":"market_data","section":"property"}},
                      payload(section_id="property")):
            self.assertIn("META-01",codes(inspect(value)))
            self.assertNotIn("SRC-02",codes(inspect(value)))
        value=payload();value["_meta"]["section"]="wrong"
        result=inspect(value)
        self.assertEqual(codes(result),["META-01"])
        self.assertFalse(result["ok"])
        self.assertEqual([f["field"] for f in result["shape_findings"]], ["_meta.section"])
        proper=payload();late={"value":1,"_meta":proper["_meta"]}
        result=inspect(late)
        self.assertEqual(codes(result),["META-01"])
        self.assertFalse(result["ok"])
        self.assertEqual([f["field"] for f in result["shape_findings"]], ["_meta"])

    def test_exact_registered_leaves_keep_unrelated_local_provenance_shapes(self):
        value=payload();value["_meta"]["provenance"]={"source":"agent/A","actor":0,"timestamp":False}
        value["_meta"]["quality"].update(field_overrides=[{"source":"market_data"}],confidence="unknown")
        value["_meta"]["lifecycle"].update(revision=True)
        result=inspect(value)
        self.assertEqual([(i["code"],i["field"]) for i in result["issues"]],
                         [("META-01","_meta.provenance.actor"),
                          ("META-04","_meta.quality.confidence"),
                          ("META-04","_meta.lifecycle.revision"),
                          ("META-04","_meta.provenance.timestamp"),
                          ("META-05","_meta.quality.field_overrides"),
                          ("META-06","_meta.provenance.agent_id")])
        paths={f["field"] for f in result["shape_findings"]}
        self.assertTrue({"_meta.provenance.agent_id","_meta.provenance.timestamp",
                         "_meta.quality.field_overrides","_meta.quality.confidence","_meta.lifecycle.revision"}<=paths)
        self.assertNotIn("_meta.provenance.actor",paths)
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


    def test_candidate_actor_exact_value_domain_and_no_aliases(self):
        for actor in (OMITTED,None,"",False,0,1.0,[],{}):
            with self.subTest(actor=actor):
                value=payload()
                if actor is OMITTED:del value["_meta"]["provenance"]["actor"]
                else:value["_meta"]["provenance"]["actor"]=actor
                value["_meta"]["actor"]="not-an-alias"
                result=inspect(value)
                self.assertEqual([(i["code"],i["severity"],i["field"]) for i in result["issues"]],
                    [("META-01","error","_meta.provenance.actor")])
                self.assertFalse(result["ok"])
                self.assertEqual(result["issues"][0]["message"],
                    "Block _meta.provenance.actor must be a nonempty string.")
                self.assertEqual(result["issues"][0]["remediation"],
                    "State the actual author in _meta.provenance.actor as a nonempty string; do not infer an actor.")
                self.assertFalse(any(f["field"]=="_meta.provenance.actor" for f in result["shape_findings"]))
        for actor in (" ","\t\n","manual","someone:anywhere","é","\u0000"):
            value=payload();value["_meta"]["provenance"]["actor"]=actor
            document=parse(HEADER+fence(value));before=copy.deepcopy(document)
            self.assertTrue(inspect_source_roles(document)["ok"])
            self.assertEqual(document,before)

    def test_candidate_all_physical_actor_coverage_including_history_and_hidden_peers(self):
        raw=HEADER
        for index,(section,variant,meta_old,fence_old) in enumerate((
                ("property",None,False,False),("property",None,False,False),
                ("property","default",False,False),("property","other",False,False),
                ("x_private","peer",False,False),("history",None,False,False),
                ("property",None,True,False),("x_private","old",False,True))):
            value=payload();value["_meta"]["section"]=section
            del value["_meta"]["provenance"]["actor"]
            value["_meta"]["lifecycle"]["superseded"]=meta_old
            raw+=fence(value,section=section,variant=variant,superseded=fence_old)
        document=parse(raw);before=copy.deepcopy(document)
        result=inspect_source_roles(document)
        self.assertEqual([i["context"]["block_index"] for i in result["issues"]],list(range(8)))
        self.assertTrue(all(i["field"]=="_meta.provenance.actor" for i in result["issues"]))
        self.assertEqual(result["history_blocks_skipped"],2)
        self.assertEqual(document,before)
        self.assertEqual(document.source.raw,raw)

    def test_candidate_metadata_precedence_then_actor_then_active_role_source(self):
        actor=payload(_role=None);actor["_meta"]["provenance"].update(actor=None,source="invalid")
        malformed=payload();malformed["_meta"]["provenance"]=None
        history=payload();history["_meta"]["lifecycle"]=None
        document=parse(HEADER+fence(actor)+fence(malformed)+fence(history,superseded=True)
                       +fence({"value":1}))
        result=inspect_source_roles(document)
        self.assertEqual([(i["code"],i["field"],i["context"]["block_index"]) for i in result["issues"]],
            [("META-01","_meta",1),("META-01","_meta",2),
             ("META-01","_meta.provenance.actor",0),("ROLE-01","_role",0),
             ("SRC-01","_meta.provenance.source",0)])
        self.assertEqual([f["field"] for f in result["shape_findings"]],["_meta"])
        for body in ({"_meta":None},{"_meta":[]},{"_meta":{"section":"property"}},
                     {"section_id":"property","value":1}):
            self.assertEqual([(i["code"],i["field"]) for i in inspect(body)["issues"]],
                             [("META-01","_meta")])

    def test_accepted_0093_order_identity_checks_never_suppress_actor(self):
        for kind in ("late_meta","wrong_section","both"):
            for historical in (False,True):
                with self.subTest(kind=kind,historical=historical):
                    value=payload()
                    del value["_meta"]["provenance"]["actor"]
                    if kind in ("wrong_section","both"):
                        value["_meta"]["section"]="other"
                    if kind in ("late_meta","both"):
                        value={"value":1,"_meta":value["_meta"]}
                    document=parse(HEADER+fence(value,superseded=historical))
                    before=copy.deepcopy(document)
                    result=inspect_source_roles(document)
                    allocated = (["_meta","_meta.section"] if kind=="both" else
                                 ["_meta"] if kind=="late_meta" else ["_meta.section"])
                    self.assertEqual([(i["code"],i["field"]) for i in result["issues"]],
                        [("META-01", field) for field in allocated + ["_meta.provenance.actor"]])
                    self.assertFalse(result["ok"])
                    fields=[] if historical else allocated
                    self.assertEqual([f["field"] for f in result["shape_findings"]],fields)
                    self.assertTrue(all("code" not in f and "severity" not in f
                                        for f in result["shape_findings"]))
                    self.assertEqual(document,before)
                    # RFC0093 retains shape errors on history as well as current
                    # data; restoring an actor never suppresses independent shape.
                    document.source.blocks[0].parsed.value["_meta"]["provenance"]["actor"]="author"
                    result=inspect_source_roles(document)
                    self.assertEqual([(i["code"],i["field"]) for i in result["issues"]],
                                     [("META-01", field) for field in allocated])
                    self.assertFalse(result["ok"])
                    self.assertEqual([f["field"] for f in result["shape_findings"]],fields)

    def test_candidate_parsed_model_authority_does_not_reparse_or_certify_raw(self):
        document=parse(HEADER+fence(payload()))
        raw=document.source.raw
        document.source.blocks[0].parsed.value["_meta"]["provenance"]["actor"]=None
        result=inspect_source_roles(document)
        self.assertEqual(codes(result),["META-01"])
        self.assertEqual(document.source.raw,raw)
        result["issues"][0]["context"]["block_index"]=99
        self.assertEqual(inspect_source_roles(document)["issues"][0]["context"]["block_index"],0)

if __name__=="__main__":unittest.main()
