"""Focused integrated-rule evidence, not CLI/calc/tier conformance.

Only the exact structural assertions of each frozen family are compared.
Financial outcomes in the same family remain separate Verifier obligations.
No source fixture is adapted or rewritten.
"""
import copy
import json
from pathlib import Path
import re
import unittest

from test_reader import HEADER, block
from test_validation import well_formed, validate
from test_validation_external import external
from uwmd_frontmatter import FrontmatterError
from uwmd_reader import parse
from uwmd_validation_builtins import builtin_rules
from uwmd_validation_core import Ledger
from uwmd_validation_tax_capex import _tax_quantize

ROOT = Path(__file__).resolve().parents[2]


def selected_codes(result, prefixes):
    return [i["code"] for i in result["issues"] if i["code"].startswith(prefixes)]


def document(asset="multifamily", **sections):
    raw = HEADER.replace(b"asset_class: multifamily", ("asset_class: "+asset).encode())
    for section, payload in sections.items():
        raw += well_formed(section, **payload)
    return parse(raw)


class ValidationFamilyTests(unittest.TestCase):
    def test_78_frozen_exact_structural_arrays_with_multiplicity(self):
        counts = {}
        for family, prefix in (("tax","TAX-"),("capex","CAPX-"),("lease","LSE-"),("recoveries","REC-")):
            paths = sorted((ROOT/"conformance"/family).glob("*/expected.json"))
            counts[family] = len(paths)
            for path in paths:
                with self.subTest(family=family, case=path.parent.name):
                    expected = json.loads(path.read_text(encoding="utf8"))
                    source = path.parent/"deal.uwx.md"
                    raw = source.read_bytes(); parsed = parse(raw); before = copy.deepcopy(parsed)
                    actual = validate(parsed)
                    self.assertEqual(sorted(selected_codes(actual,(prefix,))), sorted(expected["codes"]))
                    self.assertEqual(parsed, before)
                    self.assertEqual(source.read_bytes(),raw)
        self.assertEqual(counts,dict(tax=21,capex=18,lease=21,recoveries=18))

    def test_17_frozen_waterfall_document_assertions_without_outcome_verdicts(self):
        paths = [p for p in (ROOT/"conformance/waterfall").glob("*/expected.json")
                 if (p.parent/"deal.uwx.md").exists()]
        self.assertEqual(len(paths),17)
        for path in paths:
            with self.subTest(case=path.parent.name):
                expected=json.loads(path.read_text(encoding="utf8"))
                source=path.parent/"deal.uwx.md";raw=source.read_bytes()
                result=validate(parse(raw)); codes=[i["code"] for i in result["issues"]]
                self.assertTrue(set(expected.get("expected_codes",())) <= set(codes))
                self.assertFalse([c for c in codes if c.startswith(tuple(expected.get("absent_code_prefixes",())))])
                self.assertNotIn("verdict",result)
                self.assertEqual(source.read_bytes(),raw)

    def test_two_capital_stack_document_assertions_keep_independent_findings(self):
        for name in ("reject-waterfall-in-v1","split-coupon-bad-fields"):
            root=ROOT/"conformance/capital-stack"/name
            expected=json.loads((root/"expected.json").read_text(encoding="utf8"))
            result=validate(parse((root/"deal.uwx.md").read_bytes()))
            for code in expected["expected_codes"]:
                self.assertGreaterEqual(selected_codes(result,("CS-",)).count(code),expected["min_occurrences"])

    def test_61_unchanged_builtin_source_validation_projections_not_financial_cases(self):
        paths=sorted((ROOT/"conformance/builtin-classes").glob("*/expected.json"))
        self.assertEqual(len(paths),61)
        for path in paths:
            with self.subTest(case=path.parent.name):
                source=path.parent/"deal.uwx.md"; raw=source.read_bytes()
                parsed=parse(raw); before=copy.deepcopy(parsed)
                expected=json.loads(path.read_text(encoding="utf8"))
                result=validate(parsed)
                actual=sorted({i["code"] for i in result["issues"] if re.match(
                    r"^(CC-(DC|HOSP|MH)-|CLS-(03|04)$|MOD-(RULE|CALC)-ERROR$)",i["code"])})
                self.assertEqual(actual,sorted(set(expected["expected_codes"])))
                self.assertEqual(parsed,before)
                self.assertEqual(source.read_bytes(),raw)
        # expected_calcs are intentionally NOT asserted here. This is only the
        # validator projection, not 61 complete builtin financial-case passes.

    def test_decoded_api_mhc_rules_use_missing_null_zero_and_stated_types(self):
        body=dict(total_sites=2,occupied_sites=1,park_owned_homes=0,
                  weighted_pad_rent_monthly=0,as_of_date="not-calendar-validated")
        parsed=document("manufactured_housing",mhc_sites=body)
        before=copy.deepcopy(parsed);ledger=Ledger(parsed);builtin_rules(ledger)
        self.assertEqual(ledger.issues,[])
        self.assertEqual(parsed,before)
        # These decoded-API controls separately probe absent/null/type semantics.
        for key, value, present, required in (
                ("total_sites",None,False,"CC-MH-01"),
                ("occupied_sites",None,True,"CC-MH-02"),
                ("park_owned_homes",True,True,"MOD-RULE-ERROR"),
                ("weighted_pad_rent_monthly",-1,True,"CC-MH-04"),
                ("poh_home_rent_monthly",0,True,"CC-MH-06")):
            with self.subTest(key=key,value=value):
                payload=body.copy()
                if present:payload[key]=value
                else:payload.pop(key)
                ledger=Ledger(document("manufactured_housing",mhc_sites=payload))
                builtin_rules(ledger)
                self.assertIn(required,[i["code"] for i in ledger.issues])
                if key != "poh_home_rent_monthly":
                    self.assertIn("CLS-04",[i["code"] for i in ledger.issues])

    def test_private_builtin_executor_does_not_execute_document_custom_expressions(self):
        payload=dict(total_sites=2,occupied_sites=1,park_owned_homes=0,
                     weighted_pad_rent_monthly=0,as_of_date=0)
        parsed=document("manufactured_housing",mhc_sites=payload,custom_calculations={
            "evil":{"formula":"1 / 0","base_formula":"pow(-2, 0.5)"}},
            property={"total_sites":3})
        before=copy.deepcopy(parsed);ledger=Ledger(parsed);builtin_rules(ledger)
        self.assertIn("CC-MH-08",[i["code"] for i in ledger.issues])
        self.assertNotIn("MOD-CALC-ERROR",[i["code"] for i in ledger.issues])
        self.assertEqual(parsed,before)
        self.assertEqual(ledger.issues[0]["severity"],"error")

    def test_official_schema_shape_failure_does_not_coerce_operand_types(self):
        for value in (True,"2",{},[]):
            with self.subTest(value=value):
                payload=dict(total_sites=value,occupied_sites=1,park_owned_homes=0,
                    weighted_pad_rent_monthly=0,as_of_date="x")
                ledger=Ledger(document("manufactured_housing",mhc_sites=payload))
                builtin_rules(ledger)
                codes=[i["code"] for i in ledger.issues]
                self.assertIn("CLS-04",codes)
                self.assertIn("MOD-RULE-ERROR",codes)

    def test_mixed_components_keep_financing_and_allocation_obligations_separate(self):
        parsed=document("mixed_use",components={
            "retail":dict(component_class="retail",net_operating_income=1,allocation_pct=.3),
            "office":dict(component_class="office",net_operating_income=2,allocation_pct=.7)})
        self.assertFalse(selected_codes(validate(parsed),("MU-",)))
        parsed=document("mixed_use",components={
            "retail":dict(component_class="office",net_operating_income=1,allocation_pct=.3,
                          debt_structure={}),
            "office":dict(component_class="office",net_operating_income=None)})
        self.assertEqual(set(selected_codes(validate(parsed),("MU-",))),{"MU-03","MU-04","MU-05","MU-06"})

    def test_split_coupon_exact_reconciliation_and_no_unstated_positivity_rule(self):
        tranche=dict(id="pref",position=1,**{"class":"preferred_equity"},amount=1,rate=0,
                     accrual="split",cash_rate=-.01,accrued_rate=.01)
        self.assertEqual(selected_codes(validate(document(capital_stack={"tranches":[tranche]})),("CS-",)),[])
        for alteration,code in (({"cash_rate":None},"CS-02b"),({"term_months":True},"CS-01"),
                                 ({"rate":.001},"CS-02b"),({"accrual":"unknown"},"CS-01")):
            with self.subTest(alteration=alteration):
                body=tranche|alteration
                self.assertIn(code,selected_codes(validate(document(capital_stack={"tranches":[body]})),("CS-",)))

    def test_terminal_tax_requires_assessment_but_normal_g1_trigger_remains_valid(self):
        normal=document(noi_model={"expenses":{"real_estate_taxes":{"value":1,"reassessment":{"trigger":"sale"}}}})
        self.assertEqual(selected_codes(validate(normal),("TAX-",)),[])
        terminal=document(dcf={"exit_analysis":{"terminal_tax":{"trigger":"none","in_exit_noi":False}}})
        result=validate(terminal)
        self.assertEqual(selected_codes(result,("TAX-",)),["TAX-01"])
        finding=next(i for i in result["issues"] if i["code"]=="TAX-01")
        self.assertEqual(finding["field"],"exit_analysis.terminal_tax")
        terminal=document(dcf={"exit_analysis":{"terminal_tax":{"trigger":"none","assessed_value":10,
            "millage_rate":.1,"indicated_tax":1,"in_exit_noi":False}}})
        self.assertEqual(selected_codes(validate(terminal),("TAX-",)),[])

    def test_wide_declared_tax_magnitude_uses_existing_decimal_shift(self):
        self.assertEqual(_tax_quantize(15000000000000,-13),20000000000000)
        self.assertEqual(_tax_quantize(-15000000000000,-13),-20000000000000)
        self.assertEqual(_tax_quantize(1.2345,13),1.2345)
        self.assertEqual(_tax_quantize(-1.2345,-13),0)
        self.assertEqual(_tax_quantize(0,1000),0)

    def test_recovery_period_and_pool_use_stated_evidence_not_host_clock(self):
        tenant=dict(recovery_terms=dict(method="net",pro_rata_share=.5,recoverable_pool=["real_estate_taxes"]),
            recovery_true_up=[dict(period_start="2025-01-01",period_end="2025-12-31",
                pool_actual=4,tenant_share_uncapped=2,tenant_share_capped=1,estimated_billed=2,true_up_amount=-1)])
        parsed=document(rent_roll={"as_of_date":"2026-01-01","tenants":[tenant]})
        self.assertEqual(selected_codes(validate(parsed),("REC-",)),[])
        tenant["recovery_true_up"][0]["period_end"]="2026-01-01"
        self.assertIn("REC-05",selected_codes(validate(document(rent_roll={"as_of_date":"2026-01-01","tenants":[tenant]})),("REC-",)))

    def test_unrelated_builtin_class_does_not_execute_other_class_rules(self):
        parsed=document("multifamily",mhc_sites={"total_sites":"bad"})
        ledger=Ledger(parsed);builtin_rules(ledger)
        self.assertEqual(ledger.issues,[])
        parsed.frontmatter.value["asset_class"]={}
        ledger=Ledger(parsed);builtin_rules(ledger)
        self.assertEqual(ledger.issues,[])


class CapitalStackAdmissionTests(unittest.TestCase):
    """Format 4.24 / RFC0026 and0050 structure; no sizing recomputation."""

    def tranche(self, **extra):
        return dict(id="senior",position=1,amount=1000,rate=.05,
                    **{"class":"senior_debt"},**extra)

    def source(self, scope, stack):
        if scope=="top_level":
            return HEADER+well_formed("capital_stack",**stack)
        header=HEADER.replace(b"asset_class: multifamily",b"asset_class: mixed_use")
        return header+well_formed("components",
            retail=dict(component_class="retail",net_operating_income=100,capital_stack=stack),
            office=dict(component_class="office",net_operating_income=200))

    def report(self, raw):
        parsed=parse(raw);before=copy.deepcopy(parsed)
        result=validate(parsed)
        self.assertEqual(parsed,before)
        self.assertEqual(parsed.source.raw,raw)
        return result,[i for i in result["issues"] if i["code"].startswith("CS-")]

    def test_authored_accrual_is_closed_but_omission_remains_optional_in_both_locations(self):
        for scope in ("top_level","component"):
            for mode in (None,"unknown","cash ",False,0,[],{}):
                with self.subTest(scope=scope,mode=mode):
                    result,issues=self.report(self.source(scope,dict(tranches=[self.tranche(accrual=mode)])))
                    path="" if scope=="top_level" else "retail.capital_stack."
                    self.assertEqual([(i["code"],i["severity"],i["field"]) for i in issues],
                                     [("CS-01","error",path+"tranches[0]")])
                    self.assertEqual(result["overall_status"],"errors")
                    self.assertIn(issues[0],result["errors"])
            for extra in ({},{"accrual":"cash"},{"accrual":"accrued"}):
                with self.subTest(scope=scope,extra=extra):
                    _,issues=self.report(self.source(scope,dict(tranches=[self.tranche(**extra)])))
                    self.assertEqual(issues,[])

    def test_split_admission_and_component_rate_presence_keep_existing_allocations(self):
        for scope in ("top_level","component"):
            pref=dict(id="pref",position=1,amount=1000,rate=.12,
                      **{"class":"preferred_equity"},accrual="split",cash_rate=.08,accrued_rate=.04)
            _,issues=self.report(self.source(scope,dict(tranches=[pref])))
            self.assertEqual(issues,[])
            for key in ("cash_rate","accrued_rate"):
                invalid=copy.deepcopy(pref);del invalid[key]
                _,issues=self.report(self.source(scope,dict(tranches=[invalid])))
                self.assertTrue(issues)
                self.assertTrue(all(i["code"]=="CS-02b" for i in issues))
            ordinary=self.tranche(accrual="cash",cash_rate=0)
            _,issues=self.report(self.source(scope,dict(tranches=[ordinary])))
            self.assertEqual([i["code"] for i in issues],["CS-02b"])

    def test_current_selection_history_and_external_payload_remain_separate_from_admission(self):
        bad=dict(tranches=[self.tranche(accrual=None)])
        good=dict(tranches=[self.tranche(accrual="cash")])
        for scope in ("top_level","component"):
            section="capital_stack" if scope=="top_level" else "components"
            header=HEADER if scope=="top_level" else HEADER.replace(
                b"asset_class: multifamily",b"asset_class: mixed_use")
            bad_body=parse(self.source(scope,bad)).source.blocks[0].parsed.value
            good_body=parse(self.source(scope,good)).source.blocks[0].parsed.value
            historical=copy.deepcopy(bad_body)
            historical["_meta"]["lifecycle"]["superseded"]=True
            external_payload={k:v for k,v in bad_body.items() if k!="_meta"}
            for raw in (
                    header+block(section,historical)+block(section,good_body),
                    header+block(section,bad_body)+block(section,good_body),
                    header+external(section,**external_payload)):
                result,issues=self.report(raw)
                self.assertEqual(issues,[])
                if b"external=true" in raw:
                    self.assertEqual(result["composition_assessment"]["status"],"unresolved")
            for raw in (
                    header+block(section,good_body)+block(section,bad_body),
                    header+block(section,historical)+block(section,bad_body)):
                _,issues=self.report(raw)
                self.assertEqual([i["code"] for i in issues],["CS-01"])

    def test_malformed_stack_and_tranche_containers_preserve_existing_structural_refusal(self):
        for scope in ("top_level","component"):
            for stack in ({},{"tranches":None},{"tranches":{}},{"tranches":[]},
                          {"tranches":[None]},{"tranches":[False]},{"tranches":[[]]}):
                with self.subTest(scope=scope,stack=stack):
                    _,issues=self.report(self.source(scope,stack))
                    self.assertEqual([i["code"] for i in issues],["CS-01"])


if __name__=="__main__":
    unittest.main()
