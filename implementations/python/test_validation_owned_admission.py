"""Exact allocated REC/WF owners and current LU applicability; no new codes."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_reader import block
from test_validation import well_formed, validate
from test_validation_cli import property_source
from test_validation_optional_shapes import cash, waterfall
from uwmd_reader import parse
from uwmd import _validation_response
from uwmd_validation_optional_shapes import optional_shape_assessments


def recoveries(**tenant):
    return property_source()+well_formed("rent_roll",as_of_date="2026-03-01",tenants=[tenant])


def report(raw,family):
    result = validate(parse(raw)); return result,result["section_assessment"][family]


def row(**changes):
    return dict(period_start="2026-01-01",period_end="2026-01-31",**changes)


class AllocatedAdmissionTests(unittest.TestCase):
    def assert_owned(self,raw,family,code,fields):
        document=parse(raw); before=copy.deepcopy(document)
        result=validate(document); assessment=result["section_assessment"][family]
        self.assertEqual(assessment["shape_findings"],[])
        self.assertEqual([f["field"] for f in assessment["handled_shape_findings"]],fields)
        self.assertEqual({f["registered_code"] for f in assessment["handled_shape_findings"]},{code})
        self.assertEqual(document,before)
        response,status=_validation_response(result)
        self.assertEqual(status,1); self.assertNotIn("partial_validation_result",response)
        self.assertIn(code,[i["code"] for i in response["errors"]])
        return document,result

    def test_rec03_pool_carrier_empty_and_each_invalid_typed_member(self):
        base="tenants[0].recovery_terms.recoverable_pool"
        for pool,fields in ((False,[base]),({},[base]),([],[base]),([False],[base+"[0]"]),
                            (["real_estate_taxes",3,{}],[base+"[1]",base+"[2]"])):
            self.assert_owned(recoveries(recovery_terms=dict(method="net",recoverable_pool=pool)),
                              "lease_recoveries","REC-03",fields)
        for pool in (None,["real_estate_taxes"]):
            result,assessment=report(recoveries(recovery_terms=dict(method="net",recoverable_pool=pool)),"lease_recoveries")
            self.assertEqual(assessment["shape_findings"],[])
            self.assertFalse(any(i["code"]=="REC-03" for i in result["issues"]))

    def test_rec04_carrier_row_required_type_calendar_and_settlement(self):
        root="tenants[0].recovery_true_up"
        for value,fields in ((False,[root]),([False],[root+"[0]"]),([{}],[root+"[0].period_start",root+"[0].period_end"]),
                ([dict(period_start=False,period_end="2026-01-31")],[root+"[0].period_start"]),
                ([dict(period_start="2026-02-30",period_end="2026-03-01")],[root+"[0].period_start"]),
                ([row(settlement="unknown")],[root+"[0].settlement"])):
            self.assert_owned(recoveries(recovery_true_up=value),"lease_recoveries","REC-04",fields)
        for value in (None,[],[row(settlement=None)]):
            result,assessment=report(recoveries(recovery_true_up=value),"lease_recoveries")
            self.assertEqual(assessment["shape_findings"],[])
            self.assertFalse(any(i["code"]=="REC-04" for i in result["issues"]))

    def test_rec04_registered_row_never_consumes_unrelated_amount_or_unknown_sibling(self):
        raw=recoveries(recovery_true_up=[dict(period_start="2026-02-30",period_end="2026-03-01",pool_actual=False,unknown=1)])
        result,assessment=report(raw,"lease_recoveries")
        self.assertEqual([f["field"] for f in assessment["shape_findings"]],
                         ["tenants[0].recovery_true_up[0].pool_actual","tenants[0].recovery_true_up[0].unknown"])
        self.assertEqual([f["field"] for f in assessment["handled_shape_findings"]],["tenants[0].recovery_true_up[0].period_start"])
        self.assertIn("partial_validation_result",_validation_response(result)[0])

    def test_wf10_selected_floor_and_wf13_tax_with_optional_siblings_preserved(self):
        for basis,leaf,value in (("lp_irr_floor","floor_rate",False),("lp_irr_floor","floor_rate",0),
                ("lp_irr_floor","floor_rate",1),("lp_em_floor","floor_multiple",True),("lp_em_floor","floor_multiple",1)):
            claim=dict(basis=basis,cap="promote_received",**{leaf:value})
            raw=property_source()+cash()+well_formed("distribution_waterfall",**waterfall(clawback=claim))
            self.assert_owned(raw,"waterfall_claims","WF-10",["clawback."+leaf])
        for tax in (False,"bad",-.1,1):
            claim=dict(basis="lp_em_floor",floor_multiple=1.5,cap="promote_received",net_of_tax_rate=tax)
            raw=property_source()+cash()+well_formed("distribution_waterfall",**waterfall(clawback=claim))
            self.assert_owned(raw,"waterfall_claims","WF-13",["clawback.net_of_tax_rate"])
        claim=dict(basis="lp_em_floor",floor_multiple=0,floor_rate="bad",cap="promote_received")
        _,assessment=report(property_source()+cash()+well_formed("distribution_waterfall",**waterfall(clawback=claim)),"waterfall_claims")
        self.assertEqual([f["field"] for f in assessment["shape_findings"]],["clawback.floor_rate"])
        self.assertEqual([f["field"] for f in assessment["handled_shape_findings"]],["clawback.floor_multiple"])

    def test_wrong_block_severity_code_field_and_stale_predicate_never_own(self):
        raw=recoveries(recovery_true_up=[dict(period_start=False,period_end="2026-01-31")])
        document,result=self.assert_owned(raw,"lease_recoveries","REC-04",["tenants[0].recovery_true_up[0].period_start"])
        owners=result["issues"]
        self.assertTrue(optional_shape_assessments(document)["lease_recoveries"]["shape_findings"])
        for key,value in (("code","REC-05"),("severity","warning"),("field","tenants[1].recovery_true_up[0]"),
                          ("section","other"),("context",dict(block_index=0))):
            wrong=copy.deepcopy(owners)
            for issue in wrong:
                if issue["code"]=="REC-04": issue[key]=value
            assessment=optional_shape_assessments(document,registered_recovery_issues=wrong)["lease_recoveries"]
            self.assertEqual([f["field"] for f in assessment["shape_findings"]],["tenants[0].recovery_true_up[0].period_start"])
        document.source.blocks[1].parsed.value["tenants"][0]["recovery_true_up"][0]["period_start"]="2026-01-01"
        self.assertEqual(optional_shape_assessments(document,registered_recovery_issues=owners)["lease_recoveries"]["shape_findings"],[])

    def test_current_lu_only_incomplete_peers_gate_and_history_evidence_is_separate(self):
        good=dict(model_type="absorption_curve",period_granularity="monthly",schedule=[dict(period="2026-01")])
        historical=parse(well_formed("lease_up_schedule",**good).join([b"",b""])) if False else None
        old=parse(property_source()+well_formed("lease_up_schedule",**good)).source.blocks[1].parsed.value
        old["model_type"]="unknown";old["schedule"]=[{}];old["_meta"]["lifecycle"]["superseded"]=True
        stale=copy.deepcopy(old);stale["_meta"]["lifecycle"]["superseded"]=False
        raw=property_source()+block("lease_up_schedule",old,variant="history")+block("lease_up_schedule",stale,variant="base")+block("lease_up_schedule",good,variant="base")
        result,assessment=report(raw,"lease_up_schedule")
        self.assertEqual(assessment["shape_findings"],[])
        self.assertEqual(len(assessment["inactive_shape_findings"]),4)
        self.assertNotIn("partial_validation_result",_validation_response(result)[0])
        # A distinct CURRENT downside peer retains its actual unallocated finding.
        current=copy.deepcopy(good);current["model_type"]="unknown"
        result,assessment=report(raw+block("lease_up_schedule",current,variant="downside"),"lease_up_schedule")
        self.assertEqual([f["field"] for f in assessment["shape_findings"]],["model_type"])
        self.assertIn("partial_validation_result",_validation_response(result)[0])

    def test_actual_cli_returns_registered_error_results_and_does_not_rewrite_source(self):
        sources=[recoveries(recovery_terms=dict(method="net",recoverable_pool=[False])),
            recoveries(recovery_true_up=[dict(period_start=False,period_end="2026-01-31")]),
            property_source()+cash()+well_formed("distribution_waterfall",**waterfall(
                clawback=dict(basis="lp_em_floor",floor_multiple=1.5,cap="promote_received",net_of_tax_rate=1)))]
        with tempfile.TemporaryDirectory(prefix="uwmd-allocated-admission-") as directory:
            path=Path(directory)/"input.uwx.md"
            for raw,code in zip(sources,("REC-03","REC-04","WF-13")):
                path.write_bytes(raw)
                process=subprocess.run([sys.executable,"-B",str(Path(__file__).with_name("uwmd.py")),"validate",str(path),"--json"],
                    capture_output=True,encoding="utf8",timeout=20)
                response=json.loads(process.stdout)
                self.assertEqual(process.returncode,1);self.assertEqual(process.stderr,"")
                self.assertNotIn("partial_validation_result",response)
                self.assertIn(code,[i["code"] for i in response["errors"]])
                self.assertEqual(path.read_bytes(),raw)


if __name__=="__main__":
    unittest.main()
