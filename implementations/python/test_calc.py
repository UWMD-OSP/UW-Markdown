"""Accepted expression/financial/selection controls, not capability certification."""
import copy
import gzip
import json
import math
from pathlib import Path
import unittest

from test_reader import HEADER, block
from uwmd_reader import parse
from uwmd_calc import evaluate_calc, evaluate_expression, parse_context
from uwmd_calc_errors import CalcError, CalcUnavailable
from uwmd_calc_builtins import BUILTINS, call_builtin
import uwmd_fdlibm as raw

ROOT = Path(__file__).resolve().parents[2]
LAB = ROOT / "experiments/numerical-0088"


def declared(formula, **options):
    return {"id": "probe", "formula": formula, "deterministic": True, **options}


class CalcExecutionTests(unittest.TestCase):
    def setUp(self):
        self.document = parse(HEADER + block("property", {"value": 7, "array": [3, 4],
            "nested": {"value": 8}, "a.b": 9}))

    def check(self, formula, expected, **options):
        result = evaluate_calc(declared(formula, **options), self.document)
        self.assertTrue(result["ok"], result)
        self.assertEqual(result["value"], expected, formula)
        return result

    def error(self, formula, code, **options):
        result = evaluate_calc(declared(formula, **options), self.document)
        self.assertFalse(result["ok"], result)
        self.assertIsNone(result["value"])
        self.assertEqual(result["error"]["code"], code, result)
        self.assertEqual(result["error"]["category"], "calc")

    def test_all_21_builtins_and_reporting_defaults(self):
        examples = {
            "sum": ("sum(1,null,2)", 3), "avg": ("avg(2,null,4)", 3),
            "min": ("min(null,4,2)", 2), "max": ("max(2,null,4)", 4),
            "coalesce": ("coalesce(null,0,3)", 0), "if": ("if(true,2,3)", 2),
            "round": ("round(-1.005,2)", -1.01), "abs": ("abs(-2)", 2),
            "floor": ("floor(-1.5)", -2), "ceil": ("ceil(-1.5)", -1),
            "sqrt": ("sqrt(4)", 2), "pow": ("pow(2,-2)", .25),
            "log": ("log(1)", 0), "exp": ("exp(0)", 1),
            "pmt": ("pmt(0,2,10)", 5), "fv": ("fv(0,2,3,4)", 10),
            "pv": ("pv(0,2,3,4)", 10), "nper": ("nper(0,2,10,4)", 3),
            "npv": ("npv(0,-100,60,60)", 20), "irr": ("irr(-1,11)", 10),
            "is_calendar_date": ("is_calendar_date('0000-02-29')", True),
        }
        self.assertEqual(set(examples), BUILTINS)
        for formula, expected in examples.values():
            with self.subTest(formula=formula):
                self.check(formula, expected)
        for unit, places in (("$", 2), ("%", 6), ("x", 4), ("other", 6)):
            self.assertEqual(self.check("1/3", round(1/3, places), unit=unit)["round_to"], places)
        self.check("avg(null)", None)
        self.check("min()", None)
        self.check("max()", None)
        self.check("sum()", 0)
        self.check("coalesce()", None)
        self.check("null+false", None)
        self.check("'a'+'b'", "ab")
        self.check("-5%3", -2)
        self.check("5%-3", 2)
        self.check("1==true", False)
        self.check("'b'>'a'", True)

    def test_lazy_syntax_eager_calls_null_and_type_boundaries(self):
        for formula, expected in (("false && (1/0)", False), ("true || (1/0)", True),
                ("true ? 2 : 1/0", 2), ("null && (1/0)", None),
                ("null || (1/0)", None), ("null ? 1/0 : 1/0", None),
                ("round(null,false)", None), ("pow(null,2)", None)):
            self.check(formula, expected)
        for formula in ("if(false,1/0,2)", "coalesce(1,1/0)", "is_calendar_date(1/0)"):
            self.error(formula, "CALC-DIV-ZERO")
        for formula in ("pow(null,false)", "if(null,1,2)", "1 && true", "true?1:false+2",
                        "avg('1')", "sum(false)", "pmt(null,2,3)", "pmt(0,0,1)",
                        "npv(null,2)", "nper(0,0,1)", "sqrt(-1)", "log(0)",
                        "round(1,1.5)", "round(1,13)", "is_calendar_date()", "irr(1)"):
            if formula == "true?1:false+2":
                self.check(formula, 1)
            else:
                self.error(formula, "CALC-TYPE-001")
        for formula, code in (("unknown(1/0)", "CALC-RESOLVE-001"),
                ("property.constructor", "CALC-FORBIDDEN-PROP"), ("constructor(1/0)", "CALC-FORBIDDEN-PROP"),
                ("1e3", "CALC-PARSE-001"), ("property[0]", "CALC-PARSE-001"),
                ("1%0", "CALC-DIV-ZERO")):
            self.error(formula, code)
        self.check("property.array['1']", 4)
        self.check("property.array['01']", None)
        self.error("property.array", "CALC-TYPE-001")
        self.error("property", "CALC-TYPE-001")
        self.error("1", "CALC-TYPE-001", round_to=-1)
        self.error("1", "CALC-TYPE-001", round_to=True)

    def test_raw_public_and_final_boundaries_and_irr_degeneracy(self):
        self.assertEqual(call_builtin("log", [math.inf]), math.inf)
        self.assertTrue(math.isnan(call_builtin("log", [math.nan])))
        self.assertEqual(call_builtin("pow", [math.inf, 0.0]), 1.0)
        with self.assertRaises(CalcError):
            call_builtin("pow", [1e155, 2.0])
        self.assertEqual(call_builtin("npv", [1e155, 0.0, 0.0, 1.0]), 0.0)
        self.assertTrue(math.isnan(call_builtin("npv", [-1.0, 0.0, 0.0, 1.0])))
        self.error("npv(-1,0,0,1)", "CALC-TYPE-001")
        self.check("irr(0,0)", -.999, round_to=12)
        document = parse(HEADER + b"tiny: not-frontmatter\n")
        result = evaluate_calc(declared("irr(tiny,tiny)", round_to=12), document,
                               context={"overrides": {"tiny": 1e-200}})
        self.assertEqual((result["ok"], result["value"]), (True, 4.5005))
        self.error("irr(-100,230,-132)", "CALC-IRR-DIVERGE")
        self.error("irr(-1,20)", "CALC-IRR-DIVERGE")
        self.assertEqual(raw.to_bits(call_builtin("sqrt", [-0.0])), "8000000000000000")
        self.assertEqual(raw.to_bits(evaluate_calc(declared("-0"), self.document)["value"]), "0000000000000000")

    def test_frozen_composed_periodic_and_annuity_results(self):
        inputs = json.loads((LAB / "financial-trajectories/inputs.json").read_bytes())["cases"]
        frozen = json.loads(gzip.decompress((LAB / "financial-trajectories/evidence/python.json.gz").read_bytes()))["cases"]
        references = {case["id"]: case for case in frozen}
        checked = 0
        for case in inputs:
            if case["op"] not in ("pmt", "fv", "pv", "npv", "irr"):
                continue
            if "args" in case:
                arguments = [raw.from_bits(bits) for bits in case["args"]]
            else:
                arguments = [raw.from_bits(bits) for bits in case["flows"]]
                if case["op"] == "npv":
                    arguments.insert(0, raw.from_bits(case["rate"]))
            expected = references[case["id"]]["result"]
            if expected["status"] == "refused":
                with self.assertRaises(CalcError) as caught:
                    call_builtin(case["op"], arguments)
                self.assertEqual(caught.exception.code, expected["code"])
            else:
                value = call_builtin(case["op"], arguments)
                if expected["raw"]["kind"] == "nan":
                    self.assertTrue(math.isnan(value))
                else:
                    self.assertEqual(raw.to_bits(value), expected["raw"]["bits"], case["id"])
            checked += 1
        self.assertGreaterEqual(checked, 15)
        nper_inputs = json.loads((LAB / "nper-log-quotient/inputs.json").read_bytes())["cases"]
        nper_reference = json.loads(gzip.decompress((LAB / "nper-log-quotient/evidence/python.json.gz").read_bytes()))["candidate"]
        self.assertEqual(len(nper_inputs), len(nper_reference))
        for case, row in zip(nper_inputs, nper_reference):
            self.assertEqual(case["id"], row["id"])
            expected = row["result"]
            if expected["status"] == "refused":
                with self.assertRaises(CalcError) as caught:
                    call_builtin("nper", [raw.from_bits(bits) for bits in case["args"]])
                self.assertEqual(caught.exception.code, expected["code"])
            else:
                value = call_builtin("nper", [raw.from_bits(bits) for bits in case["args"]])
                if expected["raw"]["kind"] == "nan":
                    self.assertTrue(math.isnan(value))
                else:
                    self.assertEqual(raw.to_bits(value), expected["raw"]["bits"], case["id"])

    def test_exact_selection_source_lifecycle_and_declared_roles(self):
        source = HEADER + block("debt_structure", {"loan_amount": 20}, variant="first", role="senior")
        source += block("debt_structure", {"loan_amount": 40}, variant="other", role="primary")
        source += block("debt_structure", {"loan_amount": 999}, variant="old", role="primary", superseded=True)
        document = parse(source)
        before = copy.deepcopy(document)
        calc = declared("debt_structure.loan_amount", section_roles={"debt_structure": "senior"})
        self.assertEqual(evaluate_calc(calc, document)["value"], 20)
        self.assertEqual(evaluate_calc(calc, document, context={"sectionVariants": {"debt_structure": "other"}})["value"], 40)
        refused = evaluate_calc(calc, document, context={"sectionVariants": {"debt_structure": "absent"}})
        self.assertEqual(refused["error"]["code"], "CALC-RESOLVE-002")
        component = parse(HEADER + block("debt_structure", {"loan_amount": 1}, variant="c", role="component")
                          + block("debt_structure", {"loan_amount": 2}, variant="base", role="detail"))
        self.assertEqual(evaluate_calc(calc, component)["value"], 2)
        self.assertEqual(evaluate_calc(calc, component, context={"sectionVariants": {"debt_structure": "c"}})["value"], 1)
        self.assertEqual(document, before)
        # Mutation changes current model values, not the original source bytes.
        document.source.blocks[0].parsed.value["loan_amount"] = 23.0
        self.assertEqual(evaluate_calc(calc, document)["value"], 23)
        self.assertEqual(document.source.raw, source)

    def test_period_identity_context_and_literal_key_overrides(self):
        document = parse(HEADER + block("cash_flow_series", {"series": [
            {"date": "2028-01-01", "amount": 10}, {"date": "2028-01-01", "amount": 20},
            {"date": "2028-02-01", "amount": 30}]}))
        good = declared("cash_flow_series.series@2028-02-01.amount")
        self.assertEqual(evaluate_calc(good, document)["value"], 30)
        duplicate = evaluate_calc(declared("cash_flow_series.series@2028-01-01.amount"), document)
        self.assertEqual(duplicate["error"]["code"], "CALC-PERIOD-002")
        missing = evaluate_calc(good, document, context={"sectionVariants": {"cash_flow_series": "missing"}})
        self.assertEqual(missing["error"]["code"], "CALC-PERIOD-003")
        context = {"overrides": {"cash_flow_series.series@2028-02-01.amount": None}}
        before = copy.deepcopy(context)
        self.assertIsNone(evaluate_calc(good, document, context=context)["value"])
        bad = evaluate_calc(declared("dcf.invalid@Y1.value"), document,
            context={"overrides": {"dcf.invalid@Y1.value": 1}})
        self.assertEqual(bad["error"]["code"], "CALC-PERIOD-001")
        self.assertEqual(context, before)
        context = {"overrides": {"property.a.b": 40, "property['a.b']": 50}}
        self.assertEqual(evaluate_calc(declared("property['a.b']"), self.document, context=context)["value"], 50)
        self.assertEqual(evaluate_calc(declared("property['a.b']"), self.document,
                         context={"overrides": {"property.a.b": 40}})["value"], 9)

    def test_ordinary_member_periods_keep_existing_first_match_and_own_key_priority(self):
        document = parse(HEADER + block("dcf", {"annual_cash_flows": [
            {"year": 1, "value": 11}, {"year": 1, "value": 99}, {"year": "2", "value": 22}]})
            + block("noi_model", {"projections": {"year_2": {"value": 22}, "Y1": {"value": 10}, "year_1": {"value": 999}}})
            + block("lease_up_schedule", {"schedule": [{"period": "2028-Q1", "value": 44}]})
            + block("cash_flow_series", {"series": [{"date": "2028-02-29", "amount": 55}]}))
        for formula, value in (("dcf.annual_cash_flows['Y1'].value", 11),
                ("dcf.annual_cash_flows.Y2.value", 22), ("dcf.annual_cash_flows['Y3'].value", None),
                ("noi_model.projections['Y2'].value", 22), ("noi_model.projections.Y1.value", 10),
                ("lease_up_schedule.schedule['2028-Q1'].value", 44),
                ("cash_flow_series.series['2028-02-29'].amount", 55)):
            result = evaluate_calc(declared(formula), document)
            self.assertEqual((result["ok"], result["value"]), (True, value), formula)
        strict = evaluate_calc(declared("dcf.annual_cash_flows@Y1.value"), document)
        self.assertEqual(strict["error"]["code"], "CALC-PERIOD-002")
        wrong_kind = evaluate_calc(declared("dcf.annual_cash_flows['2028-02-29'].value"), document)
        self.assertIsNone(wrong_kind["value"])

    def test_member_selector_override_aliases_keep_exact_leaf_identity_and_precedence(self):
        document = parse(HEADER + block("dcf", {"annual_cash_flows": [{"year": 1, "value": 11, "a.b": 12}]}))
        controls = [
            ("dcf.annual_cash_flows['Y1'].value", {"dcf.annual_cash_flows@Y1.value": 99}, 99),
            ("dcf.annual_cash_flows['Y1'].value", {"dcf.annual_cash_flows@Y1.value": None}, None),
            ("dcf.annual_cash_flows@Y1.value", {"dcf.annual_cash_flows.Y1.value": 88}, 88),
            ("dcf.annual_cash_flows@Y1.value", {"dcf.annual_cash_flows.Y1.value": None}, None),
            ("dcf.annual_cash_flows@Y1.value", {"dcf.annual_cash_flows@Y1.value": 1, "dcf.annual_cash_flows.Y1.value": 2}, 1),
            ("dcf.annual_cash_flows['Y1'].value", {"dcf.annual_cash_flows@Y1.value": 1, "dcf.annual_cash_flows.Y1.value": 2}, 2),
            ("dcf.annual_cash_flows@Y1['a.b']", {"dcf.annual_cash_flows.Y1['a.b']": 50}, 50),
            ("dcf.annual_cash_flows['Y1']['a.b']", {"dcf.annual_cash_flows@Y1['a.b']": 60}, 60),
            ("dcf.annual_cash_flows@Y1['a.b']", {"dcf.annual_cash_flows.Y1.a.b": 100}, 12),
            ("dcf.annual_cash_flows['Y1']['a.b']", {"dcf.annual_cash_flows@Y1.a.b": 100}, 12),
        ]
        before = copy.deepcopy(document)
        for formula, overrides, expected in controls:
            with self.subTest(formula=formula, overrides=overrides):
                result = evaluate_calc(declared(formula), document, context={"overrides": overrides})
                self.assertEqual((result["ok"], result["value"]), (True, expected), result)
        self.assertEqual(document, before)

    def test_declaration_role_admission_excludes_component_without_blocking_explicit_components(self):
        for role in ("primary", "senior", "junior", "summary", "detail"):
            self.check("property.value", 7, section_roles={"property": role})
        self.error("property.value", "CALC-TYPE-001", section_roles={"property": "component"})
        self.error("property.value", "CALC-TYPE-001", section_roles={"property": "unknown"})
        self.error("property.value", "CALC-TYPE-001", section_roles={"property": []})
        document = parse(HEADER + block("property", {"value": 5}, variant="part", role="component")
                         + block("property", {"value": 7}, variant="base", role="detail"))
        result = evaluate_calc(declared("property.value"), document, context={"sectionVariants": {"property": "part"}})
        self.assertEqual((result["ok"], result["value"]), (True, 5))

    def test_frontmatter_prior_terminal_shapes_context_and_limits(self):
        self.assertEqual(evaluate_calc(declared("deal_id"), self.document)["value"], "test")
        self.assertEqual(evaluate_calc(declared("prior"), self.document, prior_results={"prior": 12})["value"], 12)
        self.assertEqual(evaluate_calc(declared("property.value"), self.document,
                         prior_results={"property": {"value": 100}})["value"], 7)
        for value in (None, [], {"unknown": {}}, {"sectionVariants": {"property": None}},
                      {"sectionVariants": {"constructor": "x"}}, {"overrides": {"x": []}},
                      {"overrides": {"x": math.inf}}):
            with self.subTest(value=value), self.assertRaises(CalcError):
                parse_context(value)
        self.error("sum(" + ",".join(["1"] * 1100) + ")", "CALC-LIMIT-001")
        self.error("(" * 100 + "1" + ")" * 100, "CALC-LIMIT-001")
        self.check("false && property.constructor", False)
        self.error("1/0", "CALC-DIV-ZERO")


if __name__ == "__main__":
    unittest.main()
