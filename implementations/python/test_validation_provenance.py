"""Canonical FV and integrated provenance/policy controls; no CLI claim."""
import copy
import unittest

from test_reader import HEADER, block
from test_validation import validate, well_formed, codes, ROOT
from uwmd_reader import parse
from uwmd_source_validation import inspect_source_roles
from uwmd_validation_provenance import timestamp_shape, incomplete_policy


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

    def test_present_metadata_shapes_use_one_existing_registered_meta01(self):
        for path,value in (
            (("provenance","actor"),None),(("provenance","actor"),""),
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
                self.assertEqual([c for c in codes(result) if c[0]=="META-01"],[("META-01","error")])
                self.assertEqual(parsed,before)
                self.assertFalse(any(c.startswith("META_FIELD_INVALID") for c,_ in codes(result)))

    def test_exact_completeness_suffixes_and_absent_actor_frozen_precedent(self):
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
        self.assertEqual(result["overall_status"],"clean")
        self.assertFalse(any("ACTOR" in i["code"] for i in result["issues"]))
        # This pins the actual existing joint-contract gap, not a claim that
        # the Format/schema's required actor field has become optional.

    def test_agent_identity_required_when_stated_actor_is_agent(self):
        body=body_with_meta();body["_meta"]["provenance"]["source"]="agent/extractor"
        self.assertIn(("META-01","error"),codes(validate(document(body))))
        body["_meta"]["provenance"]["agent_id"]=None
        self.assertNotIn(("META-01","error"),codes(validate(document(body))))
        body["_meta"]["provenance"]["agent_id"]=5
        self.assertIn(("META-01","error"),codes(validate(document(body))))

    def test_conditional_provenance_references_are_shapes_never_resolved_or_inferred(self):
        digest="sha256:"+"0"*64
        for resolution,key,reference in (
            ("market_data_accepted","market_data_ref",dict(document_id="market",as_of="stated-date",digest=digest)),
            ("inherited_assumption","inherited_from",dict(document_id="parent",digest=digest,distance=1))):
            with self.subTest(resolution=resolution):
                body=body_with_meta();body["_meta"]["provenance"]["resolution"]=resolution
                self.assertIn(("META-01","error"),codes(validate(document(body))))
                reference["unknown"]="retained"
                body["_meta"]["provenance"][key]=reference
                parsed=document(body);before=copy.deepcopy(parsed)
                self.assertNotIn(("META-01","error"),codes(validate(parsed)))
                self.assertEqual(parsed,before)
                body["_meta"]["provenance"][key]["digest"]="SHA256:invalid"
                self.assertIn(("META-01","error"),codes(validate(document(body))))

    def test_rfc3339_shape_keeps_fraction_offset_case_calendar_and_leap_slots(self):
        for value in ("1985-04-12T23:20:50.52Z","1996-12-19T16:39:57-08:00",
            "1990-12-31T23:59:60Z","1990-12-31T15:59:60-08:00",
            "1937-01-01T12:00:27.87+00:20","2024-02-29t00:00:00z",
            "0000-02-29T00:00:00-00:00","2026-01-01T00:00:00.123456789123456789Z"):
            with self.subTest(value=value):
                self.assertTrue(timestamp_shape(value))
                body=body_with_meta();body["_meta"]["provenance"]["timestamp"]=value
                parsed=document(body)
                self.assertNotIn(("META-01","error"),codes(validate(parsed)))
                self.assertEqual(parsed.source.blocks[0].parsed.value["_meta"]["provenance"]["timestamp"],value)
        for value in ("2026-02-29T00:00:00Z","2026-01-01","2026-01-01T00:00:00",
            "2026-01-01T24:00:00Z","2026-01-01T00:60:00Z","2026-01-01T00:00:00+24:00",
            "2026-01-01T00:00:60Z","2026-01-30T23:59:60Z","2026-01-01 00:00:00Z"):
            with self.subTest(value=value):
                self.assertFalse(timestamp_shape(value))

    def test_overrides_and_leaf_confidence_preserve_orthogonal_review_flag(self):
        body=body_with_meta();body["_overrides"]=[dict(path="unknown",confidence="low",note="stated")]
        parsed=document(body);before=copy.deepcopy(parsed)
        self.assertIn(("META_LOW_CONFIDENCE_NO_REVIEW_FLAG","info"),codes(validate(parsed)))
        self.assertEqual(parsed,before)
        self.assertIs(parsed.source.blocks[0].parsed.value["_meta"]["quality"]["human_review_required"],False)
        body["_overrides"][0]["path"]=5
        self.assertIn(("META-01","error"),codes(validate(document(body))))

    def test_unknown_notes_integrity_and_history_are_not_promoted_to_verification(self):
        body=body_with_meta();body["unknown"]={"opaque":[1,2]};body["_notes"]={"never":"validated"}
        body["_meta"]["integrity"]={"signature":{"unsupported":"opaque"}}
        history=copy.deepcopy(body);history["_meta"]["lifecycle"]["superseded"]=True
        history["_meta"]["provenance"]["actor"]=5
        parsed=parse(HEADER+block("property",history)+block("property",body));before=copy.deepcopy(parsed)
        result=validate(parsed)
        self.assertNotIn(("META-01","error"),codes(result))
        self.assertFalse(any(c.startswith("INT-") for c,_ in codes(result)))
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
