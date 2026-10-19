"""Canonical FV and integrated provenance/policy controls; no CLI claim."""
import copy
import json
import unittest

from test_reader import HEADER, block
from test_validation import validate, well_formed, codes, ROOT
from uwmd_reader import parse
from uwmd_source_validation import inspect_source_roles
from uwmd_validation_provenance import timestamp_shape, incomplete_policy


def local_fields(result):
    findings = result["metadata_assessment"]["shape_findings"]
    if any("code" in finding or "severity" in finding for finding in findings):
        raise AssertionError("Unallocated local metadata cannot acquire normative findings")
    return [finding["field"] for finding in findings]


def body_with_meta(section="property"):
    return parse(HEADER+well_formed(section)).source.blocks[0].parsed.value


def document(body,section="property",stage=None):
    header=HEADER if stage is None else HEADER.replace(b"unknown_key: retained",("deal_stage: "+stage).encode())
    return parse(header+block(section,body))


class ValidationProvenanceTests(unittest.TestCase):
    def test_canonical_fv_fields_win_without_alias_or_value_normalization(self):
        raw=HEADER+well_formed("noi_model",
            expenses={"expense_ratio":.1},expense_ratio=.5,
            income={"vacancy_credit_loss":{"rate_applied":.5}},vacancy_rate=.1)
        raw+=well_formed("dcf",assumptions={"revenue_growth_rate":.1})
        parsed=parse(raw);before=copy.deepcopy(parsed)
        result=validate(parsed)
        self.assertTrue({("FV-10","warning"),("FV-14","warning"),("FV-12","warning")} <= set(codes(result)))
        self.assertEqual(parsed,before)
        for value in (None,False,"0.1"):
            with self.subTest(value=value):
                raw=HEADER+well_formed("noi_model",expenses={"expense_ratio":value},
                    expense_ratio=.1,income={"vacancy_credit_loss":{"rate_applied":value}},vacancy_rate=.8)
                raw+=well_formed("dcf",assumptions={"revenue_growth_rate":value})
                self.assertFalse(any(code.startswith("FV-") for code,_ in codes(validate(parse(raw)))))

    def test_unreviewed_shortcut_paths_never_select_fv_behavior(self):
        raw=HEADER+well_formed("noi_model",expense_ratio=.1,vacancy_rate=.8,
            income={"vacancy_pct":.8},revenue_growth_rate=.2,
            projections={"year_1":{"revenue_growth_rate":.2}})
        raw+=well_formed("debt_structure",dscr=.1,ltv=.99,debt_yield=.001)
        raw+=well_formed("cash_flow_projection",rent_growth_rate=.99)
        parsed=parse(raw);before=copy.deepcopy(parsed)
        self.assertFalse(any(code.startswith("FV-") for code,_ in codes(validate(parsed))))
        self.assertEqual(parsed,before)

    def test_present_metadata_shapes_keep_exact_registered_or_local_owners(self):
        for path,value in (
            (("quality","confidence"),True),(("quality","human_review_required"),"yes"),
            (("quality","flags"),[1]),(("quality","partial"),"yes"),
            (("lifecycle","revision"),True),(("lifecycle","superseded"),"false"),
            (("provenance","agent_version"),5)):
            with self.subTest(path=path,value=value):
                body=body_with_meta();body["_meta"][path[0]][path[1]]=value
                parsed=document(body);before=copy.deepcopy(parsed)
                inventory=inspect_source_roles(parsed)
                self.assertTrue(inventory["shape_findings"])
                result=validate(parsed)
                self.assertNotIn(("META-01","error"),codes(result))
                field = "_meta."+".".join(path)
                owner = {("quality", "human_review_required"): "META-02",
                         ("lifecycle", "superseded"): "META-03",
                         ("quality", "confidence"): "META-04",
                         ("lifecycle", "revision"): "META-04"}.get(path)
                if owner:
                    self.assertNotIn(field,local_fields(result))
                    self.assertIn((owner,"error"),codes(result))
                    self.assertIn(field,[f["field"] for f in result["metadata_assessment"]["handled_shape_findings"]])
                else:
                    self.assertIn(field,local_fields(result))
                self.assertEqual(parsed,before)
                self.assertFalse(any(c.startswith("META_FIELD_INVALID") for c,_ in codes(result)))

    def test_exact_completeness_suffixes_and_accepted_actor_admission(self):
        body=body_with_meta()
        for group,key in (("lifecycle","revision"),("provenance","source"),
                          ("provenance","timestamp"),("quality","confidence")):
            del body["_meta"][group][key]
        result=validate(document(body))
        expected={("META_FIELD_MISSING_"+name,"warning") for name in ("VERSION","SOURCE","TIMESTAMP","CONFIDENCE")}
        self.assertTrue(expected <= set(codes(result)))
        self.assertNotIn(("META-01","error"),codes(result))
        source=ROOT/"conformance/documents/fixtures/05-land-stage-overlay.uwx.md"
        result=validate(parse(source.read_bytes()))
        self.assertEqual(result["overall_status"],"errors")
        actor=[i for i in result["issues"] if i["field"]=="_meta.provenance.actor"]
        self.assertEqual(len(actor),9)
        self.assertTrue(all((i["code"],i["severity"])==("META-01","error") for i in actor))
        self.assertNotIn("_meta.provenance.actor",local_fields(result))
        self.assertFalse(any("ACTOR" in i["code"] for i in result["issues"]))
        # The source is unchanged; RFC0090 governed diagnostic expectations.

    def test_agent_identity_required_when_stated_actor_is_agent(self):
        body=body_with_meta();body["_meta"]["provenance"]["source"]="agent/extractor"
        self.assertIn("_meta.provenance.agent_id",local_fields(validate(document(body))))
        body["_meta"]["provenance"]["agent_id"]=None
        self.assertNotIn("_meta.provenance.agent_id",local_fields(validate(document(body))))
        body["_meta"]["provenance"]["agent_id"]=5
        self.assertIn("_meta.provenance.agent_id",local_fields(validate(document(body))))

    def test_conditional_provenance_references_are_shapes_never_resolved_or_inferred(self):
        digest="sha256:"+"0"*64
        for resolution,key,reference in (
            ("market_data_accepted","market_data_ref",dict(document_id="market",as_of="stated-date",digest=digest)),
            ("inherited_assumption","inherited_from",dict(document_id="parent",digest=digest,distance=1))):
            with self.subTest(resolution=resolution):
                body=body_with_meta();body["_meta"]["provenance"]["resolution"]=resolution
                absent = validate(document(body))
                if key == "market_data_ref":
                    self.assertNotIn("_meta.provenance."+key,local_fields(absent))
                    self.assertIn(("DQ-06","error"),codes(absent))
                else:
                    self.assertIn("_meta.provenance."+key,local_fields(absent))
                reference["unknown"]="retained"
                body["_meta"]["provenance"][key]=reference
                parsed=document(body);before=copy.deepcopy(parsed)
                self.assertNotIn("_meta.provenance."+key,local_fields(validate(parsed)))
                self.assertEqual(parsed,before)
                body["_meta"]["provenance"][key]["digest"]="SHA256:invalid"
                self.assertIn("_meta.provenance."+key,local_fields(validate(document(body))))

    def test_t1b_keeps_fraction_calendar_and_rejects_original_noncanonical_values(self):
        for value in ("1985-04-12T23:20:50.52Z", "0000-02-29T00:00:00Z",
                      "2026-01-01T00:00:00.123456789123456789Z"):
            with self.subTest(value=value):
                self.assertTrue(timestamp_shape(value))
                body=body_with_meta();body["_meta"]["provenance"]["timestamp"]=value
                parsed=document(body)
                self.assertNotIn("_meta.provenance.timestamp",local_fields(validate(parsed)))
                self.assertEqual(parsed.source.blocks[0].parsed.value["_meta"]["provenance"]["timestamp"],value)
        # Preserve the formerly accepted authored vectors as strict T1B negatives.
        for value in ("1996-12-19T16:39:57-08:00", "1990-12-31T23:59:60Z",
            "1990-12-31T15:59:60-08:00", "1937-01-01T12:00:27.87+00:20",
            "2024-02-29t00:00:00z", "0000-02-29T00:00:00-00:00",
            "2026-02-29T00:00:00Z","2026-01-01","2026-01-01T00:00:00",
            "2026-01-01T24:00:00Z","2026-01-01T00:60:00Z","2026-01-01T00:00:00+24:00",
            "2026-01-01T00:00:60Z","2026-01-30T23:59:60Z","2026-01-01 00:00:00Z"):
            with self.subTest(value=value):
                self.assertFalse(timestamp_shape(value))
                body=body_with_meta();body["_meta"]["provenance"]["timestamp"]=value
                parsed=document(body); result=validate(parsed)
                self.assertNotIn("_meta.provenance.timestamp",local_fields(result))
                self.assertEqual([(i["code"], i["field"]) for i in result["errors"]],
                                 [("META-04", "_meta.provenance.timestamp")])
                self.assertEqual(parsed.source.blocks[0].parsed.value["_meta"]["provenance"]["timestamp"],value)

    def test_overrides_and_leaf_confidence_preserve_orthogonal_review_flag(self):
        body=body_with_meta();body["_overrides"]=[dict(path="unknown",confidence="low",note="stated")]
        parsed=document(body);before=copy.deepcopy(parsed)
        self.assertIn(("META_LOW_CONFIDENCE_NO_REVIEW_FLAG","info"),codes(validate(parsed)))
        self.assertEqual(parsed,before)
        self.assertIs(parsed.source.blocks[0].parsed.value["_meta"]["quality"]["human_review_required"],False)
        body["_overrides"][0]["path"]=5
        self.assertIn("_overrides[0].path",local_fields(validate(document(body))))

    def test_unknown_notes_integrity_and_history_are_not_promoted_to_verification(self):
        body=body_with_meta();body["unknown"]={"opaque":[1,2]};body["_notes"]={"never":"validated"}
        body["_meta"]["integrity"]={"signature":{"unsupported":"opaque"}}
        history=copy.deepcopy(body);history["_meta"]["lifecycle"]["superseded"]=True
        history["_meta"]["provenance"]["actor"]=5
        parsed=parse(HEADER+block("property",history)+block("property",body));before=copy.deepcopy(parsed)
        result=validate(parsed)
        actor=[i for i in result["issues"] if i["field"]=="_meta.provenance.actor"]
        self.assertEqual([(i["code"],i["severity"],i["context"]["block_index"]) for i in actor],
                         [("META-01","error",0)])
        self.assertNotIn("_meta.provenance.actor",local_fields(result))
        self.assertFalse(any(c.startswith("INT-") for c,_ in codes(result)))
        self.assertEqual(parsed,before)

    def test_registered_actor_absence_and_values_preserve_all_physical_evidence(self):
        raw=HEADER
        for ordinal,value in enumerate((None,"",5)):
            body=body_with_meta();body["_meta"]["provenance"]["actor"]=value
            raw+=block("property",body,variant="peer"+str(ordinal),role="component")
        body=body_with_meta();del body["_meta"]["provenance"]["actor"]
        raw+=block("property",body,variant="selected",role="primary")
        history=body_with_meta();del history["_meta"]["provenance"]["actor"]
        history["_meta"]["lifecycle"]["superseded"]=True
        raw+=block("property",history)
        parsed=parse(raw);before=copy.deepcopy(parsed)
        result=validate(parsed)
        findings=[i for i in result["issues"] if i["field"]=="_meta.provenance.actor"]
        self.assertEqual([f["context"]["block_index"] for f in findings],[0,1,2,3,4])
        self.assertNotIn("_meta.provenance.actor",local_fields(result))
        self.assertEqual(findings,[i for i in inspect_source_roles(parsed)["issues"]
                                   if i["field"]=="_meta.provenance.actor"])
        for finding in findings:
            self.assertEqual((finding["code"],finding["severity"]),("META-01","error"))
            block_source=parsed.source.blocks[finding["context"]["block_index"]]
            self.assertEqual(finding["context"]["body_byte_start"],block_source.body_span.start)
            self.assertEqual(finding["context"]["body_byte_end"],block_source.body_span.end)
        findings[0]["message"]="consumer edit"
        self.assertEqual(parsed,before)
        fresh=validate(parsed)
        self.assertNotEqual(next(i for i in fresh["issues"]
                                 if i["field"]=="_meta.provenance.actor")["message"],"consumer edit")

    def test_registered_actor_order_precedence_and_unallocated_requirements_integrate(self):
        actor=body_with_meta()
        del actor["_meta"]["provenance"]["actor"]
        actor["_role"]=None
        actor["_meta"]["provenance"]["source"]="invalid"
        actor["_meta"]["section"]="wrong"
        actor={"value":1,**actor}
        malformed=body_with_meta();malformed["_meta"]["provenance"]=None
        # Reader's block() convenience helper supplies _meta and moves it
        # first; explicit fences preserve the malformed input under test.
        raw=HEADER
        for payload in (actor,malformed,{"value":1}):
            raw+=b"~~~json uw:section=property\n"+json.dumps(payload).encode()+b"\n~~~\n"
        parsed=parse(raw);before=copy.deepcopy(parsed)
        result=validate(parsed)
        source_issues=inspect_source_roles(parsed)["issues"]
        projected = copy.deepcopy(source_issues); projected[0].pop("field")
        self.assertEqual(result["issues"][:len(source_issues)],projected)
        self.assertEqual([(i["code"],i["field"]) for i in source_issues],
            [("META-01","_meta"),("META-01","_meta"),("META-01","_meta.section"),
             ("META-01","_meta.provenance.actor"),("ROLE-01","_role"),
             ("SRC-01","_meta.provenance.source")])
        self.assertEqual(sum(i["code"]=="META_MISSING" for i in result["issues"]),1)
        self.assertNotIn("_meta.provenance.actor",local_fields(result))
        self.assertFalse({"_meta","_meta.section"} & set(local_fields(result)))
        self.assertEqual(result["errors"],[i for i in result["issues"] if i["severity"]=="error"])
        self.assertEqual(parsed,before)

    def test_registered_nested_wrapper_findings_are_preserved_without_local_promotion(self):
        body=body_with_meta();del body["_meta"]["provenance"]
        body["_overrides"]=[{"path":5}]
        parsed=document(body);before=copy.deepcopy(parsed)
        inventory=inspect_source_roles(parsed)
        result=validate(parsed)
        registered=[i for i in result["issues"] if i["code"]=="META-01"]
        original = [i for i in inventory["issues"] if i["code"] == "META-01"]
        self.assertEqual(original[0]["field"], "_meta")
        projected = copy.deepcopy(original); projected[0].pop("field")
        self.assertEqual(registered, projected)
        self.assertEqual(len(registered),1)
        self.assertNotIn("value",registered[0])
        self.assertIn("_overrides[0].path",local_fields(result))
        self.assertEqual(parsed,before)

    def test_policy_specificity_uses_field_then_stage_then_declaration(self):
        policies=[
            dict(section="noi_model",action={"kind":"defer"}),
            dict(section="noi_model",stage="screening",action={"kind":"degrade"}),
            dict(section="noi_model",field_path="expenses.expense_ratio",action={"kind":"halt"}),
            dict(section="noi_model",field_path="expenses.expense_ratio",stage="screening",action={"kind":"defer"})]
        before=copy.deepcopy(policies)
        self.assertEqual(incomplete_policy("noi_model",None,"screening",policies)["action"]["kind"],"degrade")
        self.assertEqual(incomplete_policy("noi_model","expenses.expense_ratio","screening",policies)["action"]["kind"],"defer")
        self.assertEqual(incomplete_policy("noi_model","expenses.expense_ratio","scope",policies)["action"]["kind"],"halt")
        self.assertEqual(incomplete_policy("rent_roll",None,"scope")["action"]["kind"],"substitute")
        self.assertEqual(incomplete_policy("borrower_sponsor",None,"screening")["action"]["kind"],"defer")
        self.assertEqual(policies,before)

    def test_field_halt_and_same_specificity_override_integrate_without_substitution(self):
        body=body_with_meta("noi_model");body["_meta"]["quality"]["provisional"]=True
        body["expenses"]={"expense_ratio":None}
        parsed=document(body,"noi_model","screening");before=copy.deepcopy(parsed)
        policies=[dict(section="noi_model",field_path="expenses.expense_ratio",stage="screening",action={"kind":"halt"})]
        result=validate(parsed,incomplete_policies=policies)
        self.assertIn(("DQ-02","error"),codes(result));self.assertEqual(parsed,before)
        body=body_with_meta("noi_model");body["_meta"]["quality"]["provisional"]=True
        parsed=document(body,"noi_model","full_underwrite")
        policies=[dict(section="noi_model",stage="full_underwrite",action={"kind":"defer"})]
        self.assertNotIn(("DQ-02","error"),codes(validate(parsed,incomplete_policies=policies)))
        self.assertNotIn("expenses",parsed.source.blocks[0].parsed.value)


if __name__=="__main__":
    unittest.main()
