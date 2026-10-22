"""Standalone RFC0096 helper controls; imports no developing validation modules."""
import copy
import math
import unittest

from uwmd_payload_admission import _PayloadView as View, _payload_admission


def inspect(section,payload,**options):
    return _payload_admission([View(section,payload)],**options)


def fields(section,payload,**options):
    return [issue["field"] for issue in inspect(section,payload,**options)]


def lease(**extra):
    return dict(model_type="absorption_curve",period_granularity="monthly",schedule=[dict(period="2026-01")],**extra)


def recovery(terms=None,rows=None):
    return dict(tenants=[dict(recovery_terms=terms,recovery_true_up=rows)])


def sizing(**extra):
    return dict(id="stated",fn="weighted_cost",over="*",value=0,**extra)


class PayloadAdmissionTests(unittest.TestCase):
    def test_lu_model_required_exact_vocabulary_does_not_gate_independent_shapes(self):
        for model in ("natural_turnover","absorption_curve"):
            value=lease();value["model_type"]=model
            self.assertEqual(inspect("lease_up_schedule",value),[])
        for model in (None,False,1,[],{},"unknown"," absorption_curve"):
            value=lease();value.update(model_type=model,assumptions=False)
            self.assertEqual(fields("lease_up_schedule",value),["model_type","assumptions"])
        value=lease();del value["model_type"]
        self.assertEqual(fields("lease_up_schedule",value),["model_type"])

    def test_lu_target_declared_cadence_ascii_grammar_and_invalid_cadence_independence(self):
        for cadence,admitted in (("monthly",("0000-01","9999-12")),("quarterly",("0000-Q1","2026-Q4"))):
            for target in admitted:
                value=lease(stabilization_target=target);value["period_granularity"]=cadence
                self.assertEqual(fields("lease_up_schedule",value),[])
            for target in (False,1,[],{},"2026-00","2026-Q5","2026-01\n","２０２６-01"," 2026-01"):
                value=lease(stabilization_target=target);value["period_granularity"]=cadence
                self.assertEqual(fields("lease_up_schedule",value),["stabilization_target"])
        for cadence in (None,False,"unknown"):
            value=lease(stabilization_target="untyped grammar");value["period_granularity"]=cadence
            self.assertEqual(fields("lease_up_schedule",value),[])
            value["stabilization_target"]=False
            self.assertEqual(fields("lease_up_schedule",value),["stabilization_target"])
        value=lease(stabilization_target="untyped grammar");del value["period_granularity"]
        self.assertEqual(fields("lease_up_schedule",value),[])
        self.assertEqual(fields("lease_up_schedule",lease(stabilization_target=None)),[])

    def test_lu_all_numeric_field_domains_null_boolean_and_signed_controls(self):
        groups={"schedule":(("occupied_sf",0,None),("leased_sf",0,None),("in_place_rent_psf",0,None),
            ("market_rent_psf",0,None),("vacancy_rate",0,1),("rent_revenue",None,None),
            ("concessions",None,None),("ti_lc_capex",None,None),("net_cash_flow",None,None)),
            "assumptions":(("monthly_turnover_rate",0,1),("market_rent_psf_at_stabilization",0,None),
            ("vacancy_during_lease_up",0,1),("concession_months_per_lease",0,None),
            ("tenant_improvement_psf",0,None),("leasing_commission_rate",0,1)),
            "stabilized_summary":(("occupied_sf",0,None),("occupancy_rate",0,1),
            ("annualized_egi",None,None),("annualized_noi",None,None))}
        for group,entries in groups.items():
            for name,low,high in entries:
                for value,refused in ((None,False),(0,False),(False,True),(True,True),("0",True),
                    (math.inf,True),(math.nan,True),(-1,low is not None),(2,high is not None)):
                    payload=lease();container=payload["schedule"][0] if group=="schedule" else payload.setdefault(group,{})
                    container[name]=value;path="schedule[0]."+name if group=="schedule" else group+"."+name
                    with self.subTest(group=group,name=name,value=value):
                        self.assertEqual(fields("lease_up_schedule",payload),[path] if refused else [])

    def test_lu_container_precedence_closed_members_and_fixed_field_order(self):
        value=lease(stabilization_target=False,assumptions=[],stabilized_summary=False)
        value["model_type"]="unknown";value["schedule"]=[False,dict(period="bad",z=1,a=2,vacancy_rate=2)]
        value.update(z=1,a=2,_notes=dict(opaque=True))
        self.assertEqual(fields("lease_up_schedule",value),["model_type","stabilization_target","assumptions",
            "schedule[1].vacancy_rate","schedule[1].a","schedule[1].z","stabilized_summary","a","z"])
        # Existing LU01/03 owners: cadence, schedule carriers and row period.
        for rows in (None,False,[],[False],[{}],[dict(period=False)]):
            value=lease();value["schedule"]=rows;value["period_granularity"]="invalid"
            self.assertEqual(fields("lease_up_schedule",value),[])

    def test_recovery_optional_parents_and_existing_owned_conditions_are_not_reallocated(self):
        for terms in (None,False,[],dict(method="bad",pro_rata_share=False,recoverable_pool=[]),dict(cap=False)):
            self.assertEqual(fields("rent_roll",recovery(terms)),[])
        for rows in (None,False,[False],[dict(period_start=False,settlement="bad",cash_flow_ref=dict(opaque=True))]):
            self.assertEqual(fields("rent_roll",recovery(rows=rows)),[])
        self.assertEqual(inspect("rent_roll",dict(tenants=[None,False,1])),[])

    def test_recovery_every_typed_leaf_null_and_bounds_including_selected_companion(self):
        for name,values in {
            "share_basis":(("nra",False),("gla",False),("stated",False),("unknown",True),(False,True)),
            "base_year":((0,False),(-1,False),(1.0,False),(1.5,True),(False,True),("2026",True),(9007199254740992,False)),
            "expense_stop_per_sqft":((0,False),(-1,True),(False,True)),
            "fixed_recovery_annual":((0,False),(-1,True),(False,True)),
            "admin_fee_pct":((0,False),(.5,False),(1,True),(-1,True),(False,True)),
            "gross_up_pct":((0,True),(.5,False),(1,False),(1.1,True),(False,True)),
        }.items():
            for value,refused in ((None,False),*values):
                self.assertEqual(fields("rent_roll",recovery({name:value})),
                                 ["tenants[0].recovery_terms."+name] if refused else [])
        self.assertEqual(fields("rent_roll",recovery(dict(method="base_year_stop",base_year="bad"))),
                         ["tenants[0].recovery_terms.base_year"])
        for terms in (dict(method="base_year_stop"),dict(method="base_year_stop",base_year=None)):
            self.assertEqual(fields("rent_roll",recovery(terms)),[])  # Missing companion belongs REC02.

    def test_recovery_exact_mp_accumulation_partition_is_presence_not_admission(self):
        missing=object()
        for method in (missing,None,"net",False,"unknown"):
            for pct in (missing,None,.05,False):
                for accumulation in (missing,None,"cumulative","bad",False):
                    terms={};cap={}
                    if method is not missing:terms["method"]=method
                    if pct is not missing:cap["pct"]=pct
                    if accumulation is not missing:cap["accumulation"]=accumulation
                    terms["cap"]=cap
                    mp=method is not missing and method is not None and pct is not missing and pct is not None
                    refused=not mp and accumulation is not missing and accumulation is not None and accumulation not in ("cumulative","non_cumulative","compounding")
                    with self.subTest(method=method,pct=pct,accumulation=accumulation):
                        self.assertEqual(fields("rent_roll",recovery(terms)),
                            ["tenants[0].recovery_terms.cap.accumulation"] if refused else [])

    def test_recovery_cap_over_trueup_fields_unknown_members_and_order(self):
        terms=dict(share_basis=False,base_year=False,expense_stop_per_sqft=False,fixed_recovery_annual=False,
            admin_fee_pct=False,gross_up_pct=False,cap=dict(over=False,accumulation="bad",z=1,a=2),z=1,a=2)
        rows=[dict(period_start="bad",pool_actual=False,tenant_share_uncapped=-1,tenant_share_capped=False,
                   estimated_billed=-1,true_up_amount="bad",cash_flow_ref=dict(extra=False),z=1,a=2)]
        prefix="tenants[0].recovery_terms."
        expected=[prefix+name for name in ("share_basis","base_year","expense_stop_per_sqft","fixed_recovery_annual",
            "admin_fee_pct","gross_up_pct","cap.over","cap.accumulation","cap.a","cap.z","a","z")]
        expected += ["tenants[0].recovery_true_up[0]."+name for name in (
            "pool_actual","tenant_share_uncapped","tenant_share_capped","estimated_billed","true_up_amount","a","z")]
        self.assertEqual(fields("rent_roll",recovery(terms,rows)),expected)
        for value in (None,0,1):
            row={name:value for name in ("pool_actual","tenant_share_uncapped","tenant_share_capped","estimated_billed","true_up_amount")}
            self.assertEqual(fields("rent_roll",recovery(rows=[row])),[])
        self.assertEqual(fields("rent_roll",recovery(rows=[dict(true_up_amount=-10)])),[])

    def test_sizing_carrier_rows_required_fields_and_selector_local_precedence(self):
        for value in (None,False,{},"bad"):
            self.assertEqual(fields("capital_stack",dict(sizing=value)),["sizing"])
        self.assertEqual(inspect("capital_stack",{}),[])
        self.assertEqual(inspect("capital_stack",dict(sizing=[])),[])
        self.assertEqual(fields("capital_stack",dict(sizing=[False,{},dict(id=False,fn="bad",over=False,through=False,value=False,z=1,a=2)])),
            ["sizing[0]","sizing[1].id","sizing[1].fn","sizing[1]","sizing[1].value",
             "sizing[2].id","sizing[2].fn","sizing[2]","sizing[2].value","sizing[2].a","sizing[2].z"])

    def test_sizing_exact_domains_no_financial_selector_interpretation_or_safe_ceiling(self):
        for fn in ("coverage","blended_coverage","debt_yield_through","ltc_through","ltv_through","weighted_cost"):
            claim=sizing();claim["fn"]=fn;claim["over"]="not-resolved-here"
            self.assertEqual(fields("capital_stack",dict(sizing=[claim])),[])
        for through,refused in ((0,True),(1,False),(1.0,False),(1.5,True),(False,True),(None,True),(9007199254740992,False)):
            claim=sizing();del claim["over"];claim["through"]=through
            self.assertEqual(fields("capital_stack",dict(sizing=[claim])),["sizing[0].through"] if refused else [])
        for name,value,refused in (("id"," ",False),("over"," ",False),("id","",True),("over","",True),
                                   ("value",-1,False),("value",False,True),("value",None,True),("value",math.inf,True)):
            claim=sizing();claim[name]=value
            self.assertEqual(fields("capital_stack",dict(sizing=[claim])),["sizing[0]."+name] if refused else [])

    def test_component_sizing_requires_mixed_use_eligible_key_and_declared_class(self):
        payload=dict(retail=dict(component_class="retail",capital_stack=dict(sizing=False)),
            office=dict(component_class="office",capital_stack=dict(sizing=False)),
            multifamily=dict(component_class="office",capital_stack=dict(sizing=False)),
            land=dict(component_class="land",capital_stack=dict(sizing=False)),
            x_private=dict(component_class="x_private",capital_stack=dict(sizing=False)))
        self.assertEqual(fields("components",payload,asset_class="office"),[])
        self.assertEqual(fields("components",payload,asset_class="mixed_use"),
                         ["office.capital_stack.sizing","retail.capital_stack.sizing"])

    def test_waterfall_outcome_nullable_parent_precedence_numbers_and_order(self):
        for value in (None,{},dict(lp=None,gp=None,promote_total=None)):
            self.assertEqual(fields("distribution_waterfall",dict(stated_outcomes=value)),[])
        value=dict(stated_outcomes=dict(lp=False,gp=dict(contributions=False,distributions=False,moic=-1,xirr=False,z=1,a=2),
            promote_total=False,profit_total=False,clawback_amount=False,z=1,a=2))
        self.assertEqual(fields("distribution_waterfall",value),["stated_outcomes.lp",*[
            "stated_outcomes.gp."+name for name in ("contributions","distributions","moic","xirr","a","z")],*[
            "stated_outcomes."+name for name in ("promote_total","profit_total","clawback_amount","a","z")]])
        value=dict(stated_outcomes=dict(lp=dict(contributions=-1,distributions=-1,moic=0,xirr=-1),
                   promote_total=-1,profit_total=-1,clawback_amount=-1))
        self.assertEqual(fields("distribution_waterfall",value),[])

    def test_waterfall_date_is_exact_lexical_not_gregorian_or_timestamp(self):
        for date in ("0000-00-00","2026-02-30","9999-99-99"):
            self.assertEqual(fields("distribution_waterfall",dict(stated_schedule=[dict(date=date,by_tier=[])])),[])
        for date in (None,False,1,"2026-01-01\n","2026-01-01\r\n","２０２６-01-01","2026-1-01"," 2026-01-01","2026-01-01T00:00:00Z"):
            self.assertEqual(fields("distribution_waterfall",dict(stated_schedule=[dict(date=date,by_tier=[])])),["stated_schedule[0].date"])

    def test_waterfall_schedule_carriers_closed_rows_and_tier_required_integer(self):
        self.assertEqual(fields("distribution_waterfall",dict(stated_schedule=None)),[])
        self.assertEqual(fields("distribution_waterfall",dict(stated_schedule=False)),["stated_schedule"])
        payload=dict(stated_schedule=[False,{},dict(date="2026-01-01",by_tier=[False,{},dict(tier=False,lp=False,gp=False,z=1,a=2)],z=1,a=2)])
        self.assertEqual(fields("distribution_waterfall",payload),["stated_schedule[0]","stated_schedule[1].date","stated_schedule[1].by_tier",
            "stated_schedule[2].by_tier[0]","stated_schedule[2].by_tier[1].tier",*[
            "stated_schedule[2].by_tier[2]."+name for name in ("tier","lp","gp","a","z")],"stated_schedule[2].a","stated_schedule[2].z"])
        for tier,refused in ((0,False),(1.0,False),(9007199254740992,False),(-1,True),(False,True),(None,True),(1.5,True)):
            payload=dict(stated_schedule=[dict(date="2026-01-01",by_tier=[dict(tier=tier,lp=-1,gp=None)])])
            self.assertEqual(fields("distribution_waterfall",payload),["stated_schedule[0].by_tier[0].tier"] if refused else [])

    def test_waterfall_selected_floor_keeps_existing_owner_other_floor_is_new(self):
        for basis in ("lp_irr_floor","lp_em_floor","lp_preferred_shortfall","invalid",None):
            payload=dict(clawback=dict(basis=basis,floor_rate=False,floor_multiple=False,net_of_tax_rate=False,cap="bad"))
            self.assertEqual(fields("distribution_waterfall",payload),
                (["clawback.floor_rate"] if basis=="lp_em_floor" else [] if basis=="lp_irr_floor" else ["clawback.floor_rate"])+
                ([] if basis=="lp_em_floor" else ["clawback.floor_multiple"]))
        for claim in (None,False,[],dict(floor_rate=None,floor_multiple=None)):
            self.assertEqual(fields("distribution_waterfall",dict(clawback=claim)),[])
        self.assertEqual(fields("distribution_waterfall",dict(clawback=dict(basis="lp_irr_floor",floor_rate="bad",floor_multiple=1))),["clawback.floor_multiple"])

    def test_family_variant_codepoint_order_context_detachment_and_no_input_mutation(self):
        views=[View("distribution_waterfall",dict(stated_outcomes=False),context=dict(variant=None)),
            View("capital_stack",dict(sizing=False),context=dict(variant=None)),
            View("rent_roll",recovery(dict(admin_fee_pct=False)),context=dict(variant=None)),
            View("lease_up_schedule",{},key="😀",context=dict(variant="😀",evidence=[1])),
            View("lease_up_schedule",{},key="\ue000",context=dict(variant="\ue000")),
            View("lease_up_schedule",{},key="a",context=dict(variant="a"))]
        before=copy.deepcopy(views);issues=_payload_admission(views)
        self.assertEqual([i["code"] for i in issues],["LU-05","LU-05","LU-05","REC-11","CS-03","WF-16"])
        self.assertEqual([i["context"]["variant"] for i in issues[:3]],["a","\ue000","😀"])
        self.assertEqual(views,before)
        issues[2]["context"]["evidence"].append(2)
        self.assertEqual(views,before)
        self.assertTrue(all(set(i)<={"code","severity","section","field","message","context"} for i in issues))
        self.assertTrue(all(i["severity"]=="error" and "category" not in i for i in issues))

    def test_extra_member_codepoint_order_and_opaque_universal_and_unknown_sections(self):
        payload=lease();payload.update({"😀":1,"\ue000":2,"a":3,"_notes":False,"_meta":False,"_role":False,"_overrides":False})
        self.assertEqual(fields("lease_up_schedule",payload),["a","\ue000","😀"])
        views=[View("x_private",dict(model_type=False,sizing=False,stated_outcomes=False)),
               View("future_section",dict(model_type=False)),View("pipeline_log",dict(sizing=False))]
        self.assertEqual(_payload_admission(views),[])


if __name__=="__main__":
    unittest.main()
