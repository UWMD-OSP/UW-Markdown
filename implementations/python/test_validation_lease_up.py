"""Complete fixed lease-up payload admission evidence; no model/verifier claim."""
import copy
import json
import unittest

from test_reader import HEADER, block
from test_validation import ROOT, validate, well_formed
from test_validation_external import external
from uwmd_reader import parse


def payload():
    return dict(model_type="absorption_curve", period_granularity="monthly",
                schedule=[dict(period="2026-01")])

def parsed(body=None):
    return parse(HEADER + well_formed("lease_up_schedule", **(payload() if body is None else body)))

def local(result):
    assessment=result["section_assessment"]["lease_up_schedule"]
    for finding in assessment["shape_findings"]:
        if any(name in finding for name in ("code","severity","status")):
            raise AssertionError("Local schema evidence must not invent normative diagnostics")
    return assessment

def fields(result):
    return [finding["field"] for finding in local(result)["shape_findings"]]

def lu_codes(result):
    return [i["code"] for i in result["issues"] if i["code"].startswith("LU-")]


class ValidationLeaseUpTests(unittest.TestCase):
    def test_published_schema_example_all_fields_and_nullable_optional_members(self):
        schema=json.loads((ROOT/"spec/schemas/section-lease-up-schedule.schema.json").read_text(encoding="utf8"))
        example=copy.deepcopy(schema["examples"][0])
        result=validate(parsed(example))
        self.assertEqual(fields(result),[])
        for group in ("assumptions","stabilized_summary"):
            body=payload();body[group]=None
            self.assertEqual(fields(validate(parsed(body))),[])
            body[group]={key:None for key in schema["properties"][group]["properties"]}
            self.assertEqual(fields(validate(parsed(body))),[])
        body=payload();body["stabilization_target"]=None
        body["schedule"][0].update({key:None for key in schema["$defs"]["period"]["properties"] if key!="period"})
        self.assertEqual(fields(validate(parsed(body))),[])
        # The schema example is a shape oracle; its financial statements are
        # not recomputed and no verified verdict is asserted.

    def test_every_optional_row_field_type_bound_null_and_signed_amount_domain(self):
        nonnegative=("occupied_sf","leased_sf","in_place_rent_psf","market_rent_psf","vacancy_rate")
        signed=("rent_revenue","concessions","ti_lc_capex","net_cash_flow")
        for key in (*nonnegative,*signed):
            for value in (None,0,1):
                with self.subTest(key=key,value=value):
                    body=payload();body["schedule"][0][key]=value
                    self.assertEqual(fields(validate(parsed(body))),[])
            invalid=(True,"1",{},[])
            invalid+=(-1,) if key in nonnegative else ()
            invalid+=(1.01,) if key=="vacancy_rate" else ()
            for value in invalid:
                with self.subTest(key=key,value=value):
                    body=payload();body["schedule"][0][key]=value
                    result=validate(parsed(body))
                    self.assertIn("schedule[0]."+key,fields(result))
                    self.assertEqual(lu_codes(result),[])
        for key in signed:
            body=payload();body["schedule"][0][key]=-5
            self.assertEqual(fields(validate(parsed(body))),[])

    def test_all_assumption_members_have_exact_nullable_fraction_or_nonnegative_bounds(self):
        rates=("monthly_turnover_rate","vacancy_during_lease_up","leasing_commission_rate")
        amounts=("market_rent_psf_at_stabilization","concession_months_per_lease","tenant_improvement_psf")
        for key in (*rates,*amounts):
            for value in (None,0,1):
                body=payload();body["assumptions"]={key:value}
                self.assertEqual(fields(validate(parsed(body))),[])
            for value in (True,"1",-1,{},[]):
                with self.subTest(key=key,value=value):
                    body=payload();body["assumptions"]={key:value}
                    result=validate(parsed(body))
                    self.assertIn("assumptions."+key,fields(result))
                    self.assertEqual(lu_codes(result),[])
            if key in rates:
                body=payload();body["assumptions"]={key:1.01}
                self.assertIn("assumptions."+key,fields(validate(parsed(body))))
        # Both registered models admit exactly this set; no assumption becomes
        # a conditional requirement or a default because of model_type.

    def test_all_summary_members_are_stated_shape_only_no_endpoint_equations(self):
        for key in ("occupied_sf","occupancy_rate","annualized_egi","annualized_noi"):
            for value in (None,0,1):
                body=payload();body["stabilized_summary"]={key:value}
                self.assertEqual(fields(validate(parsed(body))),[])
            for value in (False,"1",[],{}):
                body=payload();body["stabilized_summary"]={key:value}
                self.assertIn("stabilized_summary."+key,fields(validate(parsed(body))))
        for key in ("occupied_sf","occupancy_rate"):
            body=payload();body["stabilized_summary"]={key:-1}
            self.assertIn("stabilized_summary."+key,fields(validate(parsed(body))))
        body=payload();body["stabilized_summary"]={"occupancy_rate":1.01}
        self.assertIn("stabilized_summary.occupancy_rate",fields(validate(parsed(body))))
        body=payload();body["stabilized_summary"]={"annualized_noi":-5,"annualized_egi":-2}
        self.assertEqual(fields(validate(parsed(body))),[])

    def test_required_fields_containers_closed_members_and_no_unregistered_lu_codes(self):
        for key in ("model_type","period_granularity","schedule"):
            body=payload();del body[key]
            result=validate(parsed(body))
            if key == "model_type":
                self.assertIn(key, fields(result))
            else:
                self.assertNotIn(key, fields(result))
                self.assertIn("LU-01" if key == "period_granularity" else "LU-03", lu_codes(result))
        for group in ("assumptions","stabilized_summary"):
            for value in (False,"x",[]):
                body=payload();body[group]=value
                self.assertIn(group,fields(validate(parsed(body))))
            body=payload();body[group]={"unknown":123}
            self.assertIn(group+".unknown",fields(validate(parsed(body))))
        body=payload();body["unknown"]={"retained":True}
        body["schedule"][0]["future"]=None
        source=parsed(body);before=copy.deepcopy(source);result=validate(source)
        self.assertEqual(fields(result),["unknown","schedule[0].future"])
        self.assertEqual(lu_codes(result),[])
        self.assertEqual(source,before)
        for row in (None,[],{},dict(period=0),dict(period="2026-99")):
            body=payload();body["schedule"]=[row]
            result=validate(parsed(body))
            if isinstance(row, dict):
                self.assertEqual(fields(result), [])
                self.assertIn("LU-01", lu_codes(result))
            else:
                self.assertEqual(fields(result), ["schedule[0]"])
        # Registered period diagnostics still own period/cadence failure;
        # none of these schema fields silently acquires LU-05 or META-01.

    def test_model_vocabulary_does_not_gate_shapes_or_fill_missing_inputs(self):
        for model,expected in (("absorption_curve",[]),("natural_turnover",["LU-04"])):
            body=payload();body["model_type"]=model;body["assumptions"]={}
            source=parsed(body);before=copy.deepcopy(source);result=validate(source)
            self.assertEqual(fields(result),[])
            self.assertEqual(lu_codes(result),expected)
            self.assertEqual(source,before)
        for model in (None,True,5,[],{},"unknown"):
            body=payload();body["model_type"]=model
            result=validate(parsed(body))
            self.assertIn("model_type",fields(result))
            self.assertEqual(lu_codes(result),[])

    def test_universal_annotations_and_unknown_sections_are_not_payload_shape_rules(self):
        body=payload();body["_notes"]={"opaque":"never validated"}
        body["_overrides"]=[dict(path="schedule",note="authored")]
        source=parsed(body);before=copy.deepcopy(source)
        self.assertEqual(fields(validate(source)),[])
        self.assertEqual(source,before)
        source=parse(HEADER+well_formed("future_section",model_type=[],schedule="unknown"))
        self.assertEqual(local(validate(source))["blocks_checked"],[])

    def test_all_retained_physical_peers_are_local_only_history_not_reclassified(self):
        historical=copy.deepcopy(parse(HEADER+well_formed("lease_up_schedule",**payload())).source.blocks[0].parsed.value)
        historical["_meta"]["lifecycle"]["superseded"]=True
        historical["model_type"]="old_unknown";historical["schedule"]=[{}]
        historical["_role"]="old_invalid"
        raw=HEADER+block("lease_up_schedule",historical,variant="old")
        stale=payload();stale["assumptions"]={"unknown":1}
        raw+=block("lease_up_schedule",stale,variant="base")
        raw+=block("lease_up_schedule",payload(),variant="base",role="primary")
        downside=payload();downside["model_type"]="unallocated"
        raw+=block("lease_up_schedule",downside,variant="downside")
        source=parse(raw);before=copy.deepcopy(source);result=validate(source);assessment=local(result)
        self.assertEqual([b["block_index"] for b in assessment["blocks_checked"]],[0,1,2,3])
        self.assertEqual([b["current"] for b in assessment["blocks_checked"]],[False,False,True,True])
        self.assertEqual([b["superseded"] for b in assessment["blocks_checked"]],[True,False,False,False])
        self.assertEqual([f["context"]["block_index"] for f in assessment["shape_findings"]],[0,0,1,3])
        self.assertEqual(lu_codes(result),[])
        self.assertFalse(any(i["code"]=="ROLE-01" for i in result["issues"]))
        self.assertEqual(source,before)

    def test_actual_external_marker_skips_payload_but_inline_external_member_is_data(self):
        raw=HEADER+external("lease_up_schedule",variant="external")
        source=parse(raw);result=validate(source);assessment=local(result)
        self.assertEqual(assessment["blocks_checked"],[])
        self.assertEqual([b["block_index"] for b in assessment["external_blocks_skipped"]],[0])
        self.assertEqual(assessment["shape_findings"],[])
        self.assertEqual(lu_codes(result),[])
        self.assertEqual(result["composition_assessment"]["status"],"unresolved")
        body=payload();body["external"]={"ordinary":"payload"}
        self.assertIn("external",fields(validate(parsed(body))))

    def test_detached_evidence_spans_preserve_original_source_and_consumer_mutation(self):
        body=payload();body["assumptions"]={"monthly_turnover_rate":"1"}
        source=parsed(body);before=copy.deepcopy(source);result=validate(source)
        assessment=local(result);finding=assessment["shape_findings"][0]
        self.assertEqual(finding["context"]["body_byte_start"],source.source.blocks[0].body_span.start)
        self.assertEqual(finding["context"]["body_byte_end"],source.source.blocks[0].body_span.end)
        finding["message"]="consumer edit";assessment["blocks_checked"][0]["variant"]="edited"
        self.assertEqual(source,before)
        self.assertNotEqual(local(validate(source))["shape_findings"][0]["message"],"consumer edit")

    def test_seven_frozen_document_assertions_without_financial_verdict_claims(self):
        paths=[p for p in (ROOT/"conformance/lease-up").glob("*/expected.json")
               if (p.parent/"deal.uwx.md").exists()]
        self.assertEqual(len(paths),7)
        for path in paths:
            with self.subTest(case=path.parent.name):
                expected=json.loads(path.read_text(encoding="utf8"))
                source_path=path.parent/"deal.uwx.md";raw=source_path.read_bytes()
                result=validate(parse(raw));codes=[i["code"] for i in result["issues"]]
                self.assertTrue(set(expected.get("expected_codes",()))<=set(codes))
                self.assertFalse([c for c in codes if c.startswith(tuple(expected.get("absent_code_prefixes",())))])
                self.assertNotIn("verdict",result)
                self.assertEqual(source_path.read_bytes(),raw)
        # Only unchanged document diagnostics are compared. Two bare financial
        # cases and the positive fixtures' "verified" outcome are not asserted.

    def test_valid_numbers_never_establish_financial_equations_or_model_verification(self):
        body=payload();body["schedule"]=[dict(period="2026-01",occupied_sf=10,
            rent_revenue=1,concessions=-1,ti_lc_capex=-1,net_cash_flow=999)]
        body["stabilized_summary"]=dict(occupied_sf=40,occupancy_rate=.5)
        result=validate(parsed(body))
        self.assertEqual(fields(result),[])
        self.assertEqual(lu_codes(result),[])
        self.assertNotIn("verdict",result)


if __name__=="__main__":
    unittest.main()
