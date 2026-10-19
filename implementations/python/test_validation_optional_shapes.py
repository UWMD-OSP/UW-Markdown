"""Fixed optional-shape admission; no financial outcome or capability claim."""
import copy
import json
import math
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from test_reader import HEADER,block
from test_validation import well_formed,validate
from test_validation_cli import property_source
from test_validation_external import external
from uwmd import _validation_response
from uwmd_reader import parse


def stack(sizing):
    return dict(tranches=[dict(id="senior",position=1,amount=1000,rate=.05,
                               **{"class":"senior_debt"})],sizing=sizing)


def cash():
    body=parse(HEADER+well_formed("cash_flow_series",day_count="actual/365f",series=[
        dict(date="2026-01-01",amount=-100),dict(date="2026-02-01",amount=110)]))
    return block("cash_flow_series",body.source.blocks[0].parsed.value,variant="equity")


def waterfall(**extra):
    return dict(cash_flow_ref={"variant":"equity"},equity_split={"lp":.8,"gp":.2},
                tiers=[dict(type="split",lp_share=.8,gp_share=.2)],**extra)


class OptionalShapeAdmissionTests(unittest.TestCase):
    def report(self,raw,family):
        document=parse(raw);before=copy.deepcopy(document)
        result=validate(document)
        findings=result["section_assessment"][family]["shape_findings"]
        self.assertEqual(document,before)
        self.assertEqual(document.source.raw,raw)
        for finding in findings:
            self.assertNotIn("code",finding);self.assertNotIn("severity",finding)
            source=document.source.blocks[finding["context"]["block_index"]]
            self.assertEqual(finding["context"]["body_byte_start"],source.body_span.start)
        command,status=_validation_response(result)
        if findings:
            self.assertEqual(status,1)
            self.assertNotIn("code",command["error"])
            self.assertNotIn("overall_status",command)
            self.assertEqual(command["partial_validation_result"]["issues"],result["issues"])
        new_owned=[f for f in result["section_assessment"][family].get("handled_shape_findings",())
                   if f["registered_code"] in ("REC-11","CS-03","WF-16")]
        if new_owned and not findings:
            self.assertEqual(status,1)
            self.assertNotIn("partial_validation_result",command)
            self.assertNotIn("error",command)
        return result,findings+new_owned,command,status

    def recoveries(self,**tenant):
        return property_source()+well_formed("rent_roll",as_of_date="2026-03-01",tenants=[tenant])

    def test_three_previously_local_paths_have_exact_0096_normal_errors(self):
        for raw,family,field in (
            (self.recoveries(recovery_terms={"method":"net","admin_fee_pct":"bad"}),
                "lease_recoveries","tenants[0].recovery_terms.admin_fee_pct"),
            (property_source()+well_formed("capital_stack",**stack("bad")),
                "capital_stack_sizing","sizing"),
            (property_source()+cash()+well_formed("distribution_waterfall",
                **waterfall(stated_outcomes=False)),"waterfall_claims","stated_outcomes")):
            result,findings,_,_=self.report(raw,family)
            self.assertEqual([(i["code"],i["field"]) for i in result["errors"]],
                             [(dict(lease_recoveries="REC-11",capital_stack_sizing="CS-03",waterfall_claims="WF-16")[family],field)])
            self.assertIn(field,[finding["field"] for finding in findings])

    def test_recovery_nullable_zero_and_fraction_boundaries_follow_fixed_schema(self):
        admitted=(None,{},{"cap":{"pct":.03}},{"method":"net","admin_fee_pct":0,"gross_up_pct":1},
                  {"method":"net","admin_fee_pct":None,"gross_up_pct":None,"cap":None},
                  {"method":"net","cap":{"pct":.03,"accumulation":"cumulative","over":None}})
        for terms in admitted:
            _,findings,_,_=self.report(self.recoveries(recovery_terms=terms),"lease_recoveries")
            self.assertEqual(findings,[])
        for terms in ({"method":"net","admin_fee_pct":True},{"method":"net","admin_fee_pct":1},
                      {"method":"net","admin_fee_pct":-.01},{"method":"net","gross_up_pct":0},
                      {"method":"net","gross_up_pct":1.01},{"method":"net","share_basis":"unknown"},
                      {"method":"net","cap":{"unallocated":0}}):
            _,findings,_,_=self.report(self.recoveries(recovery_terms=terms),"lease_recoveries")
            self.assertTrue(findings)
        # Conditional method/accumulation semantics keep their existing REC-02;
        # the local shape inventory never replaces registered findings.
        result,findings,_,_=self.report(self.recoveries(
            recovery_terms={"method":"net","cap":{"pct":.03}}),"lease_recoveries")
        self.assertIn("REC-02",[issue["code"] for issue in result["issues"]])
        self.assertEqual(findings,[])
        self.assertEqual(result["section_assessment"]["lease_recoveries"]["handled_shape_findings"][0]["registered_code"],
                         "REC-02")

    def test_true_up_closed_shape_preserves_signed_credits_and_empty_array(self):
        row=dict(period_start="2026-01-01",period_end="2026-01-31",pool_actual=0,
                 tenant_share_uncapped=None,tenant_share_capped=None,estimated_billed=0,
                 true_up_amount=-10,settlement=None,cash_flow_ref=None)
        for entries in (None,[],[row]):
            _,findings,_,_=self.report(self.recoveries(recovery_true_up=entries),"lease_recoveries")
            self.assertEqual(findings,[])
        for changes in ({"pool_actual":False},{"pool_actual":-1},{"true_up_amount":"credit"},
                        {"period_end":"2026-02-30"},{"unknown":0}):
            bad={**row,**changes}
            _,findings,_,_=self.report(self.recoveries(recovery_true_up=[bad]),"lease_recoveries")
            self.assertEqual(bool(findings), "period_end" not in changes)

    def test_sizing_fixed_declaration_union_types_and_component_scope(self):
        figure=dict(id="stated",fn="weighted_cost",over="*",value=0)
        for declared in ([],[figure]):
            _,findings,_,_=self.report(property_source()+well_formed("capital_stack",**stack(declared)),
                                      "capital_stack_sizing")
            self.assertEqual(findings,[])
        for declared in (None,"bad",[{}],[{**figure,"value":False}],
                         [{**figure,"through":1}],[{**figure,"id":""}],[{**figure,"extra":0}]):
            _,findings,_,_=self.report(property_source()+well_formed("capital_stack",**stack(declared)),
                                      "capital_stack_sizing")
            self.assertTrue(findings)
        raw=property_source().replace(b"asset_class: multifamily",b"asset_class: mixed_use")
        raw+=well_formed("components",
            retail=dict(component_class="retail",net_operating_income=100,capital_stack=stack("bad")),
            office=dict(component_class="office",net_operating_income=200))
        _,findings,_,_=self.report(raw,"capital_stack_sizing")
        self.assertEqual([f["field"] for f in findings],["retail.capital_stack.sizing"])

    def test_waterfall_nullable_claims_schedule_refs_and_bool_number_distinction(self):
        for claims in (None,{},{"lp":None},{"lp":{"contributions":0,"moic":0},"promote_total":None}):
            raw=property_source()+cash()+well_formed("distribution_waterfall",
                **waterfall(stated_outcomes=claims,stated_schedule=[]))
            _,findings,_,_=self.report(raw,"waterfall_claims")
            self.assertEqual(findings,[])
        for extras in ({"stated_outcomes":{"lp":{"distributions":False}}},
                       {"stated_outcomes":{"lp":{"unknown":0}}},
                       {"stated_schedule":False},
                       {"stated_schedule":[{"date":"2026-02-01","by_tier":[{}]}]},
                       {"stated_schedule":[{"date":"2026-02-01","by_tier":[{"tier":False}]}]}):
            raw=property_source()+cash()+well_formed("distribution_waterfall",**waterfall(**extras))
            _,findings,_,_=self.report(raw,"waterfall_claims")
            self.assertTrue(findings)
        raw=property_source()+cash()+well_formed("distribution_waterfall",**waterfall(
            stated_schedule=[{"date":"2026-02-01","by_tier":[{"tier":0,"lp":0,"gp":None}]}]))
        _,findings,_,_=self.report(raw,"waterfall_claims")
        self.assertEqual(findings,[])

    def test_clawback_floor_multiple_has_its_own_accepted_strictly_above_one_domain(self):
        for value,refused in ((0,True),(.5,True),(1,True),
                              (math.nextafter(1,math.inf),False),(1.5,False),
                              (None,True),(False,True),(True,True)):
            with self.subTest(floor_multiple=value):
                claim=dict(basis="lp_em_floor",floor_multiple=value,cap="promote_received")
                raw=property_source()+cash()+well_formed("distribution_waterfall",
                                                        **waterfall(clawback=claim))
                result,findings,_,_=self.report(raw,"waterfall_claims")
                errors=[i for i in result["issues"] if i["code"]=="WF-10"]
                self.assertEqual(len(errors),int(refused))
                # Null is admitted by the field's optional schema, while the
                # lp_em_floor conditional requires its value via registered WF-10.
                self.assertEqual(findings,[])
        # Unused companions still have their declared shape; no inactive field
        # becomes a normalized/ignored payload value.
        claim=dict(basis="lp_em_floor",floor_multiple=1.5,floor_rate="bad",cap="promote_received")
        result,findings,_,_=self.report(property_source()+cash()+well_formed(
            "distribution_waterfall",**waterfall(clawback=claim)),"waterfall_claims")
        self.assertFalse(any(i["code"]=="WF-10" for i in result["issues"]))
        self.assertIn("clawback.floor_rate",[f["field"] for f in findings])
        for claim in (None,dict(basis="lp_em_floor",floor_multiple=1.5,
                               floor_rate=None,net_of_tax_rate=0,cap="promote_received")):
            _,findings,_,_=self.report(property_source()+cash()+well_formed(
                "distribution_waterfall",**waterfall(clawback=claim)),"waterfall_claims")
            self.assertEqual(findings,[])

    def test_current_history_external_and_unknown_unrelated_payload_are_distinct(self):
        bad=parse(HEADER+well_formed("capital_stack",**stack("bad"))).source.blocks[0].parsed.value
        history=copy.deepcopy(bad);history["_meta"]["lifecycle"]["superseded"]=True
        good=well_formed("capital_stack",**stack([]))
        for raw in (property_source()+block("capital_stack",history)+good,
                    property_source()+block("capital_stack",bad)+good,
                    property_source()+external("capital_stack",**stack("bad"))):
            result,findings,_,_=self.report(raw,"capital_stack_sizing")
            self.assertEqual(findings,[])
            if b"external=true" in raw:self.assertEqual(result["composition_assessment"]["status"],"unresolved")
        raw=property_source()+well_formed("x_private",opaque={
            "recovery_terms":{"admin_fee_pct":"bad"},"sizing":"bad","stated_outcomes":False})
        result,_,command,status=self.report(raw,"lease_recoveries")
        self.assertEqual(status,0)
        self.assertNotIn("error",command)
        self.assertTrue(all(not item["shape_findings"] for item in result["section_assessment"].values()))

    def test_unsupported_schema_keyword_is_never_treated_as_valid_even_in_unselected_branch(self):
        with tempfile.TemporaryDirectory(prefix="uwmd-optional-shape-schema-") as folder:
            provider=Path(folder)
            # A test-only future schema change; normative source files are untouched.
            schema={"type":"object","properties":{"cap":{"type":"object","properties":{"pct":{"type":"number","multipleOf":2}}}}}
            (provider/"lease-recovery-terms.schema.json").write_text(json.dumps(schema),encoding="utf8")
            with patch("uwmd_validation_optional_shapes._SCHEMAS",provider):
                _,findings,_,_=self.report(self.recoveries(recovery_terms={"method":"net","cap":{}}),
                                          "lease_recoveries")
            self.assertTrue(any("Unsupported fixed-schema keyword: multipleOf"==f["message"] for f in findings))


if __name__=="__main__":
    unittest.main()
