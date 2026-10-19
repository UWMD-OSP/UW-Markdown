"""RFC0096 closed current-payload admission, independent of source selection.

The caller supplies current assembled payload views and actual variant context.
No Document traversal, raw-source parsing, schema I/O or financial reproduction
occurs here. Existing registered owners remain separate from these four passes.
"""
import copy
from dataclasses import dataclass
import re

from uwmd_binding_sources import finite


@dataclass(frozen=True)
class _PayloadView:
    section: str
    payload: dict
    # None means a singleton. For a current variant map, pass its actual key;
    # this is ordering evidence, not a new source/Envelope identity mapping.
    key: str | None = None
    context: dict | None = None


_LU_ROWS = (("occupied_sf",0,None),("leased_sf",0,None),("in_place_rent_psf",0,None),
    ("market_rent_psf",0,None),("vacancy_rate",0,1),("rent_revenue",None,None),
    ("concessions",None,None),("ti_lc_capex",None,None),("net_cash_flow",None,None))
_LU_ASSUMPTIONS = (("monthly_turnover_rate",0,1),("market_rent_psf_at_stabilization",0,None),
    ("vacancy_during_lease_up",0,1),("concession_months_per_lease",0,None),
    ("tenant_improvement_psf",0,None),("leasing_commission_rate",0,1))
_LU_SUMMARY = (("occupied_sf",0,None),("occupancy_rate",0,1),
    ("annualized_egi",None,None),("annualized_noi",None,None))
_UNIVERSAL = frozenset(("_meta","_role","_overrides","_notes"))
_COMPONENTS = frozenset(("multifamily","office","retail","industrial","self_storage",
    "hospitality","senior_housing","student_housing","data_center","manufactured_housing"))
_REC_FIELDS = ("method","pro_rata_share","share_basis","base_year","expense_stop_per_sqft",
    "fixed_recovery_annual","admin_fee_pct","gross_up_pct","recoverable_pool","cap")
_REC_ROWS = ("period_start","period_end","pool_actual","tenant_share_uncapped",
    "tenant_share_capped","estimated_billed","true_up_amount","settlement","cash_flow_ref")
_ACCUMULATION = ("cumulative","non_cumulative","compounding")
_SIZING_FNS = ("coverage","blended_coverage","debt_yield_through","ltc_through","ltv_through","weighted_cost")


def _integer(value,minimum=None):
    return finite(value) and int(value)==value and (minimum is None or value>=minimum)


def _path(parent,child):
    return parent+("." if parent else "")+child


class _Admission:
    def __init__(self):
        self.issues=[]

    def emit(self,view,code,field,message):
        issue=dict(code=code,severity="error",section=view.section,field=field,message=message)
        if view.context is not None:
            issue["context"]=copy.deepcopy(view.context)
        self.issues.append(issue)

    def extras(self,view,code,body,allowed,path):
        for name in sorted(key for key in body if key not in allowed):
            self.emit(view,code,_path(path,name),"Member is outside this closed stated-payload object.")

    def number(self,view,code,body,name,path,minimum=None,maximum=None,*,
               exclusive_minimum=False,exclusive_maximum=False,required=False,integer=False):
        if name not in body:
            if required:self.emit(view,code,path,"Required numeric member is absent.")
            return
        value=body[name]
        if value is None and not required:return
        valid=finite(value) and (not integer or int(value)==value)
        if valid and minimum is not None:
            valid=value>minimum if exclusive_minimum else value>=minimum
        if valid and maximum is not None:
            valid=value<maximum if exclusive_maximum else value<=maximum
        if not valid:self.emit(view,code,path,"Stated numeric member violates its finite type or declared bound.")

    def enum(self,view,code,body,name,path,values,*,required=False):
        if name not in body:
            if required:self.emit(view,code,path,"Required member is absent.")
            return
        value=body[name]
        if value is None and not required:return
        if not isinstance(value,str) or value not in values:
            self.emit(view,code,path,"Member is outside its exact closed vocabulary.")

    def numeric_object(self,view,code,value,path,fields):
        if value is None:return
        if not isinstance(value,dict):
            self.emit(view,code,path,"A nullable object is required when this carrier is stated.")
            return
        for name,low,high in fields:
            self.number(view,code,value,name,_path(path,name),low,high)
        self.extras(view,code,value,{field[0] for field in fields},path)

    def lease_up(self,view):
        body=view.payload;code="LU-05"
        self.enum(view,code,body,"model_type","model_type",("natural_turnover","absorption_curve"),required=True)
        target=body.get("stabilization_target")
        if target is not None:
            cadence=body.get("period_granularity")
            grammar=(r"[0-9]{4}-(?:0[1-9]|1[0-2])" if cadence=="monthly" else
                     r"[0-9]{4}-Q[1-4]" if cadence=="quarterly" else None)
            if not isinstance(target,str) or grammar is not None and re.fullmatch(grammar,target) is None:
                self.emit(view,code,"stabilization_target","Target must be a string in the admitted declared cadence grammar.")
        self.numeric_object(view,code,body.get("assumptions"),"assumptions",_LU_ASSUMPTIONS)
        rows=body.get("schedule")
        if isinstance(rows,list):
            for index,row in enumerate(rows):
                if not isinstance(row,dict):continue  # LU-01 owns unavailable row period.
                path="schedule["+str(index)+"]"
                for name,low,high in _LU_ROWS:
                    self.number(view,code,row,name,_path(path,name),low,high)
                self.extras(view,code,row,{"period",*(field[0] for field in _LU_ROWS)},path)
        self.numeric_object(view,code,body.get("stabilized_summary"),"stabilized_summary",_LU_SUMMARY)
        self.extras(view,code,body,{"model_type","period_granularity","stabilization_target","assumptions",
                                  "schedule","stabilized_summary",*_UNIVERSAL},"")

    def recovery(self,view):
        tenants=view.payload.get("tenants");code="REC-11"
        if not isinstance(tenants,list):return
        for index,tenant in enumerate(tenants):
            if not isinstance(tenant,dict):continue
            path="tenants["+str(index)+"]";terms=tenant.get("recovery_terms")
            if isinstance(terms,dict):
                root=path+".recovery_terms"
                self.enum(view,code,terms,"share_basis",root+".share_basis",("nra","gla","stated"))
                self.number(view,code,terms,"base_year",root+".base_year",integer=True)
                for name,low,high,exclude_low,exclude_high in (
                        ("expense_stop_per_sqft",0,None,False,False),
                        ("fixed_recovery_annual",0,None,False,False),
                        ("admin_fee_pct",0,1,False,True),("gross_up_pct",0,1,True,False)):
                    self.number(view,code,terms,name,root+"."+name,low,high,
                                exclusive_minimum=exclude_low,exclusive_maximum=exclude_high)
                cap=terms.get("cap")
                if isinstance(cap,dict):
                    self.enum(view,code,cap,"over",root+".cap.over",("base_year","prior_year"))
                    method_stated="method" in terms and terms["method"] is not None
                    pct_stated="pct" in cap and cap["pct"] is not None
                    if not(method_stated and pct_stated):
                        self.enum(view,code,cap,"accumulation",root+".cap.accumulation",_ACCUMULATION)
                    self.extras(view,code,cap,{"pct","over","accumulation"},root+".cap")
                self.extras(view,code,terms,set(_REC_FIELDS),root)
            rows=tenant.get("recovery_true_up")
            if isinstance(rows,list):
                for ordinal,row in enumerate(rows):
                    if not isinstance(row,dict):continue  # Existing REC-04 owns the row carrier.
                    root=path+".recovery_true_up["+str(ordinal)+"]"
                    for name in ("pool_actual","tenant_share_uncapped","tenant_share_capped","estimated_billed","true_up_amount"):
                        self.number(view,code,row,name,root+"."+name,0 if name!="true_up_amount" else None)
                    self.extras(view,code,row,set(_REC_ROWS),root)

    def sizing(self,view,stack,path="sizing"):
        if "sizing" not in stack:return
        claims=stack["sizing"];code="CS-03"
        if not isinstance(claims,list):
            self.emit(view,code,path,"Present sizing must be an array; null is not admitted.")
            return
        for index,claim in enumerate(claims):
            root=path+"["+str(index)+"]"
            if not isinstance(claim,dict):
                self.emit(view,code,root,"Each sizing declaration must be an object.")
                continue
            if not isinstance(claim.get("id"),str) or claim["id"]=="":
                self.emit(view,code,root+".id","Sizing id must be a required nonempty string.")
            self.enum(view,code,claim,"fn",root+".fn",_SIZING_FNS,required=True)
            over,through="over" in claim,"through" in claim
            if over==through:
                self.emit(view,code,root,"Sizing requires exactly one own over/through selector.")
            elif over:
                if not isinstance(claim["over"],str) or claim["over"]=="":
                    self.emit(view,code,root+".over","Sizing over must be a nonempty string.")
            elif not _integer(claim["through"],1):
                self.emit(view,code,root+".through","Sizing through must be an integer at least one.")
            self.number(view,code,claim,"value",root+".value",required=True)
            self.extras(view,code,claim,{"id","fn","over","through","value"},root)

    def waterfall(self,view):
        body=view.payload;code="WF-16";clawback=body.get("clawback")
        if isinstance(clawback,dict):
            basis=clawback.get("basis")
            if basis!="lp_irr_floor":
                self.number(view,code,clawback,"floor_rate","clawback.floor_rate",0,1,
                            exclusive_minimum=True,exclusive_maximum=True)
            if basis!="lp_em_floor":
                self.number(view,code,clawback,"floor_multiple","clawback.floor_multiple",1,exclusive_minimum=True)
            self.extras(view,code,clawback,{"basis","floor_rate","floor_multiple","net_of_tax_rate","cap"},"clawback")
        outcomes=body.get("stated_outcomes")
        if outcomes is not None:
            if not isinstance(outcomes,dict):
                self.emit(view,code,"stated_outcomes","Stated outcomes must be a nullable object.")
            else:
                for party in ("lp","gp"):
                    self.numeric_object(view,code,outcomes.get(party),"stated_outcomes."+party,
                        (("contributions",None,None),("distributions",None,None),("moic",0,None),("xirr",None,None)))
                for name in ("promote_total","profit_total","clawback_amount"):
                    self.number(view,code,outcomes,name,"stated_outcomes."+name)
                self.extras(view,code,outcomes,{"lp","gp","promote_total","profit_total","clawback_amount"},"stated_outcomes")
        rows=body.get("stated_schedule")
        if rows is None:return
        if not isinstance(rows,list):
            self.emit(view,code,"stated_schedule","Stated schedule must be a nullable array.")
            return
        for index,row in enumerate(rows):
            path="stated_schedule["+str(index)+"]"
            if not isinstance(row,dict):
                self.emit(view,code,path,"Each stated schedule row must be an object.")
                continue
            date=row.get("date")
            if not isinstance(date,str) or re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}",date) is None:
                self.emit(view,code,path+".date","Date must be a required whole ASCII YYYY-MM-DD string; calendar validity is separate.")
            tiers=row.get("by_tier")
            if not isinstance(tiers,list):
                self.emit(view,code,path+".by_tier","A required by_tier array is needed.")
            else:
                for ordinal,tier in enumerate(tiers):
                    root=path+".by_tier["+str(ordinal)+"]"
                    if not isinstance(tier,dict):
                        self.emit(view,code,root,"Each stated tier row must be an object.")
                        continue
                    self.number(view,code,tier,"tier",root+".tier",0,required=True,integer=True)
                    for party in ("lp","gp"):
                        self.number(view,code,tier,party,root+"."+party)
                    self.extras(view,code,tier,{"tier","lp","gp"},root)
            self.extras(view,code,row,{"date","by_tier"},path)


def _payload_admission(views,*,asset_class=None):
    """Return only RFC0096 issues for caller-selected current payloads.

    Views with a key represent current variant-map entries. Keys and extra
    member names sort by Unicode code point, not UTF-16 or source fence order.
    Caller-owned context provides actual source identity; key never replaces it.
    """
    views=tuple(views);admission=_Admission()
    def selected(section):
        return sorted((view for view in views if view.section==section and isinstance(view.payload,dict)),
                      key=lambda view:(view.key is not None,view.key or ""))
    for view in selected("lease_up_schedule"):admission.lease_up(view)
    for view in selected("rent_roll"):admission.recovery(view)
    for view in selected("capital_stack"):admission.sizing(view,view.payload)
    if asset_class=="mixed_use":
        for view in selected("components"):
            for name in sorted(key for key in view.payload if key in _COMPONENTS):
                component=view.payload[name]
                if not isinstance(component,dict) or component.get("component_class")!=name:continue
                stack=component.get("capital_stack")
                if isinstance(stack,dict):admission.sizing(view,stack,name+".capital_stack.sizing")
    for view in selected("distribution_waterfall"):admission.waterfall(view)
    return admission.issues
