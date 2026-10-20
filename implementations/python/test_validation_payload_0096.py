"""Actual RFC0096 WIP operation/ownership controls; no capability promotion."""
import asyncio
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_reader import block
from test_validation import validate,well_formed
from test_validation_cli import property_source
from test_validation_optional_shapes import cash,waterfall,stack
from test_composition import part,fence
from uwmd import _validation_response
from uwmd_reader import parse
from uwmd_validation import _validate_source,validate_document
from uwmd_validation_payload_admission import payload_findings
from uwmd_validation_optional_shapes import optional_shape_assessments

NEW=("LU-05","REC-11","CS-03","WF-16")


def rows(result):return [(i["code"],i["field"]) for i in result["issues"] if i["code"] in NEW]


def assessed(raw):
    document=parse(raw);before=copy.deepcopy(document)
    source=asyncio.run(_validate_source(raw));model=validate(document)
    if document!=before:raise AssertionError("Input was mutated")
    if rows(source)!=rows(model):raise AssertionError("Source/model current-payload divergence")
    return source


def lease(**changes):return dict(model_type="absorption_curve",period_granularity="monthly",schedule=[dict(period="2026-01")])|changes


class PayloadIntegrationTests(unittest.TestCase):
    def test_four_exact_repro_shapes_now_have_normal_registered_results_and_actual_cli(self):
        sources=[property_source()+well_formed("lease_up_schedule",**lease(model_type="unknown")),
            property_source()+well_formed("rent_roll",tenants=[dict(recovery_terms=dict(method="net",admin_fee_pct="bad"))]),
            property_source()+well_formed("capital_stack",**stack("bad")),
            property_source()+cash()+well_formed("distribution_waterfall",**waterfall(stated_outcomes=False))]
        wanted=[("LU-05","model_type"),("REC-11","tenants[0].recovery_terms.admin_fee_pct"),("CS-03","sizing"),("WF-16","stated_outcomes")]
        with tempfile.TemporaryDirectory(prefix="uwmd-payload-0096-") as directory:
            path=Path(directory)/"source.uwx.md"
            for raw,expected in zip(sources,wanted):
                result=assessed(raw);self.assertEqual(rows(result),[expected])
                response,status=_validation_response(result)
                self.assertEqual((status,response["overall_status"]),(1,"errors"))
                self.assertNotIn("partial_validation_result",response)
                path.write_bytes(raw)
                process=subprocess.run([sys.executable,"-B",str(Path(__file__).with_name("uwmd.py")),"validate",str(path),"--json"],
                    capture_output=True,encoding="utf8",timeout=20)
                actual=json.loads(process.stdout)
                self.assertEqual(process.returncode,1);self.assertEqual(process.stderr,"")
                self.assertEqual(rows(actual),[expected]);self.assertNotIn("partial_validation_result",actual)
                self.assertEqual(path.read_bytes(),raw)

    def test_target_allocation_null_and_existing_inversion_are_separate(self):
        for cadence,target,expected in (("monthly","2026-Q1",[("LU-05","stabilization_target")]),
                ("unknown","not-a-cadence",[]),("unknown",False,[("LU-05","stabilization_target")]),
                ("monthly",None,[]),("monthly","2025-12",[])):
            result=assessed(property_source()+well_formed("lease_up_schedule",**lease(period_granularity=cadence,stabilization_target=target)))
            self.assertEqual(rows(result),expected)
            self.assertFalse(any(i["code"]=="LU-01" and i["field"]=="stabilization_target" for i in result["errors"]))
            self.assertEqual(result["section_assessment"]["lease_up_schedule"]["shape_findings"],[])
            self.assertEqual(any(i["code"]=="LU-03" and i["field"]=="stabilization_target" for i in result["errors"]),target=="2025-12")
        result=assessed(property_source()+well_formed("lease_up_schedule",**lease(schedule=[False])))
        self.assertIn(("LU-01","schedule[0].period"),[(i["code"],i["field"]) for i in result["errors"]])
        self.assertEqual(result["section_assessment"]["lease_up_schedule"]["shape_findings"],[])

    def test_mp_matrix_exact_owners_no_unrelated_coarse_parent(self):
        cases=[({},dict(pct=.05),[]),({},dict(pct=.05,accumulation=None),[]),
            ({},dict(pct=.05,accumulation="bad"),[("REC-11","cap.accumulation")]),
            ({},dict(pct=None,accumulation="bad"),[("REC-11","cap.accumulation")]),
            (dict(method="net"),dict(pct=.05),[("REC-02","cap.accumulation")]),
            (dict(method="net"),dict(pct=.05,accumulation=None),[("REC-02","cap.accumulation")]),
            (dict(method=None),dict(pct=.05,accumulation=None),[("REC-02","method")]),
            (dict(method="net"),dict(pct=None,accumulation="bad"),[("REC-11","cap.accumulation")]),
            (dict(method="net"),dict(pct=False,accumulation=None),[("REC-01","cap.pct"),("REC-02","cap.accumulation")])]
        for terms,cap,wanted in cases:
            raw=property_source()+well_formed("rent_roll",tenants=[dict(recovery_terms=terms|dict(cap=cap))])
            result=assessed(raw)
            actual=[(i["code"],i["field"].removeprefix("tenants[0].recovery_terms.")) for i in result["errors"] if i["code"].startswith("REC-")]
            self.assertEqual(actual,wanted)
            self.assertEqual(result["section_assessment"]["lease_recoveries"]["shape_findings"],[])
        for terms,expected in ((dict(pro_rata_share=None),[]),(dict(method=None),[("REC-02","method")]),
                (dict(method="base_year_stop"),[("REC-02","base_year")]),
                (dict(method="base_year_stop",base_year=None),[("REC-02","base_year")]),
                (dict(method="base_year_stop",base_year="bad"),[("REC-11","base_year")])):
            result=assessed(property_source()+well_formed("rent_roll",tenants=[dict(recovery_terms=terms)]))
            self.assertEqual([(i["code"],i["field"].removeprefix("tenants[0].recovery_terms."))
                for i in result["errors"] if i["code"].startswith("REC-")],expected)
            self.assertEqual(result["section_assessment"]["lease_recoveries"]["shape_findings"],[])

    def test_new_pass_family_codepoint_variants_before_cc16_and_after_dq(self):
        raw=property_source()
        for key in ("😀","\ue000","a"):
            value=parse(property_source()+well_formed("lease_up_schedule",**lease(model_type="unknown"))).source.blocks[1].parsed.value
            raw+=block("lease_up_schedule",value,variant=key)
        raw+=well_formed("rent_roll",tenants=[dict(recovery_terms=dict(method="net",admin_fee_pct=False))])
        raw+=well_formed("capital_stack",**stack(False))
        raw+=cash()+well_formed("distribution_waterfall",**waterfall(stated_outcomes=False))
        for key in ("a","b"):
            raw+=block("debt_structure",dict(_role="senior",loan_amount=1),variant=key)
        result=assessed(raw);issues=result["issues"]
        new=[i for i in issues if i["code"] in NEW]
        self.assertEqual([i["code"] for i in new],["LU-05"]*3+["REC-11","CS-03","WF-16"])
        self.assertEqual([i["context"]["variant"] for i in new[:3]],["a","\ue000","😀"])
        first=min(i for i,item in enumerate(issues) if item["code"] in NEW)
        last=max(i for i,item in enumerate(issues) if item["code"] in NEW)
        self.assertTrue(all(i<first for i,item in enumerate(issues) if item["code"].startswith("DQ-")))
        self.assertTrue(any(item["code"]=="CC-16" for item in issues))
        self.assertTrue(all(i>last for i,item in enumerate(issues) if item["code"]=="CC-16"))

    def test_history_overwritten_and_mutable_current_model_scope(self):
        bad=parse(property_source()+well_formed("lease_up_schedule",**lease(model_type="unknown"))).source.blocks[1].parsed.value
        history=copy.deepcopy(bad);history["_meta"]["lifecycle"]["superseded"]=True
        raw=property_source()+block("lease_up_schedule",history,variant="history")
        raw+=block("lease_up_schedule",bad,variant="base")+block("lease_up_schedule",
            parse(property_source()+well_formed("lease_up_schedule",**lease())).source.blocks[1].parsed.value,variant="base")
        self.assertEqual(rows(assessed(raw)),[])
        document=parse(raw);document.source.blocks[3].parsed.value["model_type"]="unknown"
        self.assertEqual(rows(validate(document)),[("LU-05","model_type")])
        self.assertEqual(document.source.raw,raw)

    def test_exact_new_owner_is_required_not_only_code_or_field(self):
        raw=property_source()+well_formed("capital_stack",**stack(False));document=parse(raw)
        result=validate(document);prediction=payload_findings(document)[0]
        self.assertEqual(prediction["code"],"CS-03")
        for key,value in (("code","CS-01"),("severity","warning"),("section","other"),("field","other"),("context",dict(block_index=0))):
            owners=copy.deepcopy(result["issues"])
            for issue in owners:
                if issue["code"]=="CS-03":issue[key]=value
            assessment=optional_shape_assessments(document,registered_recovery_issues=owners)["capital_stack_sizing"]
            self.assertEqual([f["field"] for f in assessment["shape_findings"]],["sizing"])

    def test_composed_source_assesses_only_assembled_current_payload_and_keeps_original_metadata(self):
        value=parse(property_source()+well_formed("lease_up_schedule",**lease(model_type="unknown"))).source.blocks[1].parsed.value
        root_value=copy.deepcopy(value);root_value["model_type"]="root-not-assembled"
        root_value["external"]=dict(parts=["used"],part_count=1)
        raw=property_source()+fence("lease_up_schedule",root_value," external=true")
        used=part("used",value,section="lease_up_schedule",collection=False)
        unused=part("unused",value,section="lease_up_schedule",collection=False)
        result=asyncio.run(_validate_source(raw,parts=[used.source.raw,unused.source.raw]))
        self.assertEqual(rows(result),[("LU-05","model_type")])
        self.assertEqual(result["composition_assessment"]["status"],"resolved")
        self.assertEqual(result["section_assessment"]["lease_up_schedule"]["shape_findings"],[])

    def test_external_exemption_requires_marker_and_own_admitted_directive(self):
        valid=dict(parts=["part-a"],part_count=1)
        cases=[(None,None),(None,valid),("true",None),("true",False),("true",[]),
            ("true",{}),("true",dict(parts=["a"],part_count=2)),
            ("true",dict(parts=["a","a"],part_count=2)),
            ("true",dict(parts=["a"],part_count=1,collection_path="rows")),
            ("true",dict(parts=["a"],part_count=1,unknown=1)),
            ("false",valid),("true",valid)]
        for annotation,directive in cases:
            with self.subTest(annotation=annotation,directive=directive):
                body=lease(model_type="unknown")
                if directive is not None:body["external"]=directive
                raw=property_source()+well_formed("lease_up_schedule",**body)
                if annotation is not None:
                    raw=raw.replace(b"uw:section=lease_up_schedule",b"uw:section=lease_up_schedule external="+annotation.encode(),1)
                expected=[] if annotation=="true" and directive==valid else [("LU-05","model_type")]
                if directive is not None and expected:expected.append(("LU-05","external"))
                document=parse(raw);before=copy.deepcopy(document)
                model=validate(document);source=asyncio.run(_validate_source(raw))
                self.assertEqual(rows(model),expected);self.assertEqual(rows(source),expected)
                self.assertEqual(document,before);self.assertEqual(document.source.raw,raw)
                if annotation=="true" and directive!=valid:
                    self.assertIn("COMP-DIRECTIVE-MALFORMED" if directive is None or directive in (False,[],{}) else
                                  "COMP-COUNT-MISMATCH" if directive.get("part_count")!=len(directive["parts"]) else
                                  "COMP-DUP-KEY" if len(set(directive["parts"]))!=len(directive["parts"]) else
                                  "COMP-DIRECTIVE-MALFORMED",
                                  [i["code"] for i in source["composition_assessment"]["issues"]])
        # MODEL authority reads current content, while the fresh SOURCE operation
        # continues to see the original admitted directive and skips payload.
        raw=property_source()+fence("lease_up_schedule",dict(lease(model_type="unknown"),external=valid)," external=true")
        document=parse(raw);document.source.blocks[1].parsed.value["external"]=False
        self.assertEqual(rows(validate(document)),[("LU-05","model_type"),("LU-05","external")])
        self.assertEqual(rows(asyncio.run(_validate_source(raw))),[])
        self.assertEqual(document.source.raw,raw)

    def test_actual_cli_preserves_composition_refusals_and_independent_payload_findings(self):
        with tempfile.TemporaryDirectory(prefix="uwmd-payload-0096-external-") as directory:
            path=Path(directory)/"source.uwx.md"
            for marked,directive in ((True,False),(False,dict(parts=["a"],part_count=1))):
                body=lease(model_type="unknown");body["external"]=directive
                raw=property_source()+well_formed("lease_up_schedule",**body)
                if marked:raw=raw.replace(b"uw:section=lease_up_schedule",b"uw:section=lease_up_schedule external=true",1)
                path.write_bytes(raw)
                process=subprocess.run([sys.executable,"-B",str(Path(__file__).with_name("uwmd.py")),"validate",str(path),"--json"],
                    capture_output=True,encoding="utf8",timeout=20)
                value=json.loads(process.stdout)
                self.assertEqual(process.returncode,1);self.assertEqual(process.stderr,"")
                result=value["partial_validation_result"] if marked else value
                self.assertEqual(rows(result),[("LU-05","model_type"),("LU-05","external")])
                if marked:
                    self.assertIn("COMP-DIRECTIVE-MALFORMED",[i["code"] for i in value["composition_assessment"]["issues"]])
                    self.assertEqual(value["error"]["code"],"COMP-DIRECTIVE-MALFORMED")
                else:self.assertNotIn("partial_validation_result",value)
                self.assertEqual(path.read_bytes(),raw)

    def test_wf_lexical_impossible_date_has_no_structural_calendar_promotion(self):
        raw=property_source()+cash()+well_formed("distribution_waterfall",**waterfall(
            stated_schedule=[dict(date="0000-99-99",by_tier=[])]))
        result=assessed(raw)
        self.assertFalse(any(i["code"]=="WF-16" for i in result["issues"]))
        self.assertEqual(result["section_assessment"]["waterfall_claims"]["shape_findings"],[])
        self.assertNotIn("partial_validation_result",_validation_response(result)[0])


if __name__=="__main__":unittest.main()
